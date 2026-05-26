export type AlertType = "stage_sla" | "task_overdue" | "followup" | "contract_expiry";

export interface CurrentAlert {
  type: AlertType;
  clienteId: string;
  stageId: string | null;
  taskId: string | null;
  status: "warning" | "overdue";
  enteredAt: string;
  deadline: string;
}

export interface OpenAlert {
  id: string;
  type: AlertType;
  cliente_id: string;
  stage_id: string | null;
  task_id: string | null;
  status: "warning" | "overdue";
  entered_at: string;
  deadline: string;
}

export interface InsertOp {
  type: AlertType;
  cliente_id: string;
  stage_id: string | null;
  task_id: string | null;
  status: "warning" | "overdue";
  entered_at: string;
  deadline: string;
}

export interface UpdateOp {
  id: string;
  status: "warning" | "overdue";
  entered_at: string;
  deadline: string;
}

export interface DiffResult {
  toInsert: InsertOp[];
  toUpdate: UpdateOp[];
  toResolve: string[];
  toTouch: string[];
}

function keyOf(
  type: AlertType,
  clienteId: string,
  stageId: string | null,
  taskId: string | null,
) {
  return `${type}:${clienteId}:${stageId ?? "-"}:${taskId ?? "-"}`;
}

function sameInstant(a: string, b: string) {
  const aMs = new Date(a).getTime();
  const bMs = new Date(b).getTime();
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return a === b;
  return aMs === bMs;
}

/**
 * Compares a fresh snapshot of alerts against the set of currently-open
 * alerts in the database, returning the minimal set of operations needed
 * to reconcile state. Alerts are keyed by (type, cliente, stage, task) so
 * different alert sources never collide.
 */
export function diffAlerts(
  snapshot: CurrentAlert[],
  openAlerts: OpenAlert[],
): DiffResult {
  const snapshotByKey = new Map<string, CurrentAlert>();
  for (const a of snapshot) {
    snapshotByKey.set(keyOf(a.type, a.clienteId, a.stageId, a.taskId), a);
  }

  const openByKey = new Map<string, OpenAlert>();
  for (const a of openAlerts) {
    openByKey.set(keyOf(a.type, a.cliente_id, a.stage_id, a.task_id), a);
  }

  const toInsert: InsertOp[] = [];
  const toUpdate: UpdateOp[] = [];
  const toResolve: string[] = [];
  const toTouch: string[] = [];

  for (const [key, current] of snapshotByKey) {
    const open = openByKey.get(key);
    if (!open) {
      toInsert.push({
        type: current.type,
        cliente_id: current.clienteId,
        stage_id: current.stageId,
        task_id: current.taskId,
        status: current.status,
        entered_at: current.enteredAt,
        deadline: current.deadline,
      });
    } else if (
      open.status !== current.status ||
      !sameInstant(open.entered_at, current.enteredAt) ||
      !sameInstant(open.deadline, current.deadline)
    ) {
      toUpdate.push({
        id: open.id,
        status: current.status,
        entered_at: current.enteredAt,
        deadline: current.deadline,
      });
    } else {
      toTouch.push(open.id);
    }
  }

  for (const [key, open] of openByKey) {
    if (!snapshotByKey.has(key)) {
      toResolve.push(open.id);
    }
  }

  return { toInsert, toUpdate, toResolve, toTouch };
}
