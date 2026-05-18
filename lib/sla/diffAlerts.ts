export interface CurrentAlert {
  clienteId: string;
  stageId: string;
  status: "warning" | "overdue";
  enteredAt: string;
  deadline: string;
}

export interface OpenAlert {
  id: string;
  cliente_id: string;
  stage_id: string;
  status: "warning" | "overdue";
}

export interface InsertOp {
  cliente_id: string;
  stage_id: string;
  status: "warning" | "overdue";
  entered_at: string;
  deadline: string;
}

export interface UpdateOp {
  id: string;
  status: "warning" | "overdue";
}

export interface DiffResult {
  toInsert: InsertOp[];
  toUpdate: UpdateOp[];
  toResolve: string[];
  toTouch: string[];
}

function keyOf(clienteId: string, stageId: string) {
  return `${clienteId}:${stageId}`;
}

/**
 * Compares a fresh snapshot of alerts (computed from production_tasks + SLA rules)
 * against the set of currently-open alerts in the database, returning the minimal
 * set of operations needed to reconcile state.
 *
 * - toInsert: brand-new alerts (no open alert exists for this cliente/stage pair).
 * - toUpdate: status changed (e.g., warning -> overdue) on an existing open alert.
 * - toResolve: open alerts no longer present in the snapshot (back to ok or moved stage).
 * - toTouch: open alerts present in snapshot with same status — just bump last_seen_at.
 */
export function diffAlerts(
  snapshot: CurrentAlert[],
  openAlerts: OpenAlert[],
): DiffResult {
  const snapshotByKey = new Map<string, CurrentAlert>();
  for (const a of snapshot) {
    snapshotByKey.set(keyOf(a.clienteId, a.stageId), a);
  }

  const openByKey = new Map<string, OpenAlert>();
  for (const a of openAlerts) {
    openByKey.set(keyOf(a.cliente_id, a.stage_id), a);
  }

  const toInsert: InsertOp[] = [];
  const toUpdate: UpdateOp[] = [];
  const toResolve: string[] = [];
  const toTouch: string[] = [];

  for (const [key, current] of snapshotByKey) {
    const open = openByKey.get(key);
    if (!open) {
      toInsert.push({
        cliente_id: current.clienteId,
        stage_id: current.stageId,
        status: current.status,
        entered_at: current.enteredAt,
        deadline: current.deadline,
      });
    } else if (open.status !== current.status) {
      toUpdate.push({ id: open.id, status: current.status });
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
