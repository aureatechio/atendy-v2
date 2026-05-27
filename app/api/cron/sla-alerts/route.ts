import { NextResponse } from "next/server";
import {
  createAuditOperationId,
  createSystemAuditActor,
  logAuditEvent,
  logAuditEvents,
  type AuditEventInput,
} from "@/lib/audit/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateStageSla,
  type StageRow,
  type TaskRow,
} from "@/lib/alerts/evaluateStageSla";
import {
  evaluateTaskOverdue,
  type TaskOverdueRow,
} from "@/lib/alerts/evaluateTaskOverdue";
import {
  evaluateFollowup,
  type FollowupClienteRow,
  type FollowupStageRow,
} from "@/lib/alerts/evaluateFollowup";
import {
  evaluateContractExpiry,
  type ContractExpiryClienteRow,
} from "@/lib/alerts/evaluateContractExpiry";
import {
  diffAlerts,
  type CurrentAlert,
  type OpenAlert,
  type AlertType,
} from "@/lib/sla/diffAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const alertColumns =
  "id,type,cliente_id,stage_id,task_id,status,entered_at,deadline,fired_at,last_seen_at,resolved_at,resolved_by,snoozed_until";

interface HolidayRow {
  date: string;
}

interface ClienteRow {
  id: string;
  current_stage_id: string | null;
  stage_entered_at: string | null;
}

interface LastInteractionRow {
  cliente_id: string;
  last_interaction_at: string | null;
}

type AlertAuditRow = OpenAlert & {
  fired_at?: string | null;
  last_seen_at?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  snoozed_until?: string | null;
};

function alertAuditSnapshot(alert: Partial<AlertAuditRow>) {
  return {
    cliente_id: alert.cliente_id ?? null,
    deadline: alert.deadline ?? null,
    entered_at: alert.entered_at ?? null,
    id: alert.id ?? null,
    stage_id: alert.stage_id ?? null,
    status: alert.status ?? null,
    task_id: alert.task_id ?? null,
    type: alert.type ?? null,
  };
}

async function fetchAll<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const operationId = createAuditOperationId();
  const actor = createSystemAuditActor("cron:sla-alerts");
  const context = {
    requestPath: "/api/cron/sla-alerts",
    userAgent: req.headers.get("user-agent"),
  };

  async function fail(stage: string, message: string, status = 500, metadata: Record<string, unknown> = {}) {
    await logAuditEvent({
      action: "alert.cron_failed",
      actor,
      context,
      entityType: "sla_alerts_cron",
      errorMessage: message,
      metadata: { stage, ...metadata },
      operationId,
      status: "failure",
    });
    return NextResponse.json({ error: metadata.publicError ?? message, detail: message }, { status });
  }

  let stages: (StageRow & FollowupStageRow)[];
  let stageTasks: TaskRow[];
  let overdueTasks: TaskOverdueRow[];
  let clientes: ClienteRow[];
  let lastInteractions: LastInteractionRow[];
  let holidayRows: HolidayRow[];
  let contractClientes: ContractExpiryClienteRow[];

  try {
    [
      stages,
      stageTasks,
      overdueTasks,
      clientes,
      lastInteractions,
      holidayRows,
      contractClientes,
    ] =
      await Promise.all([
        fetchAll<StageRow & FollowupStageRow>((from, to) =>
          supabase
            .from("client_pipeline_stages")
            .select(
              "id,sla_amount,sla_unit,warn_at_percent,is_final,followup_days",
            )
            .eq("is_active", true)
            .range(from, to),
        ),
        fetchAll<TaskRow>((from, to) =>
          supabase
            .from("production_tasks")
            .select("cliente_id,pipeline_stage_id,started_at,created_at")
            .not("pipeline_stage_id", "is", null)
            .neq("status", "concluido")
            .range(from, to),
        ),
        fetchAll<TaskOverdueRow>((from, to) =>
          supabase
            .from("production_tasks")
            .select(
              "id,cliente_id,pipeline_stage_id,status,deadline,started_at,created_at",
            )
            .not("deadline", "is", null)
            .neq("status", "concluido")
            .range(from, to),
        ),
        fetchAll<ClienteRow>((from, to) =>
          supabase
            .from("clientes_cadastro")
            .select("id,current_stage_id,stage_entered_at")
            .not("current_stage_id", "is", null)
            .range(from, to),
        ),
        fetchAll<LastInteractionRow>((from, to) =>
          supabase
            .from("cliente_last_interaction")
            .select("cliente_id,last_interaction_at")
            .range(from, to),
        ),
        fetchAll<HolidayRow>((from, to) =>
          supabase.from("business_holidays").select("date").range(from, to),
        ),
        fetchAll<ContractExpiryClienteRow>((from, to) =>
          supabase
            .from("clientes_cadastro")
            .select("id,vigencia,inicio_vigencia,data_contrato_assinado")
            .not("vigencia", "is", null)
            .range(from, to),
        ),
      ]);
  } catch (err) {
    return fail("load_source_data", (err as Error).message, 500, {
      publicError: "Failed to load source data",
    });
  }

  const holidaySet = new Set(holidayRows.map((h) => h.date));
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const lastInteractionByCliente = new Map(
    lastInteractions.map((r) => [r.cliente_id, r.last_interaction_at]),
  );

  const stageSlaAlerts = evaluateStageSla({
    tasks: stageTasks,
    stageById,
    holidays: holidaySet,
  });

  const taskOverdueAlerts = evaluateTaskOverdue({ tasks: overdueTasks });

  const followupAlerts = evaluateFollowup({
    clientes,
    stageById,
    lastInteractionByCliente,
  });

  const contractExpiryAlerts = evaluateContractExpiry({
    clientes: contractClientes,
  });

  const snapshot: CurrentAlert[] = [
    ...stageSlaAlerts,
    ...taskOverdueAlerts,
    ...followupAlerts,
    ...contractExpiryAlerts,
  ];

  const { data: openAlertsRaw, error: openErr } = await supabase
    .from("sla_alerts")
    .select("id,type,cliente_id,stage_id,task_id,status,entered_at,deadline")
    .is("resolved_at", null);
  if (openErr) {
    return fail("load_open_alerts", openErr.message, 500, {
      publicError: "Failed to load open alerts",
    });
  }

  const openAlerts: OpenAlert[] = (openAlertsRaw ?? []).map((a) => ({
    id: a.id as string,
    type: (a.type as AlertType) ?? "stage_sla",
    cliente_id: a.cliente_id as string,
    stage_id: (a.stage_id as string | null) ?? null,
    task_id: (a.task_id as string | null) ?? null,
    status: a.status as "warning" | "overdue",
    entered_at: a.entered_at as string,
    deadline: a.deadline as string,
  }));

  const ops = diffAlerts(snapshot, openAlerts);
  const now = new Date().toISOString();
  const auditEvents: AuditEventInput[] = [];

  if (ops.toInsert.length > 0) {
    const insertRows = ops.toInsert.map((row) => ({
      ...row,
      fired_at: now,
      last_seen_at: now,
    }));
    const { data: insertedAlerts, error } = await supabase.from("sla_alerts").insert(
      insertRows,
    ).select(alertColumns);
    if (error) {
      return fail("insert_alerts", error.message, 500, {
        insert_count: ops.toInsert.length,
        publicError: "Failed to insert alerts",
      });
    }
    for (const alert of (insertedAlerts ?? []) as AlertAuditRow[]) {
      auditEvents.push({
        action: "alert.created",
        actor,
        after: alertAuditSnapshot(alert),
        clienteId: alert.cliente_id,
        context,
        entityId: alert.id,
        entityType: "sla_alert",
        operationId,
      });
    }
    if ((insertedAlerts ?? []).length === 0) {
      auditEvents.push(
        ...insertRows.map((row) => ({
          action: "alert.created",
          actor,
          after: alertAuditSnapshot(row as AlertAuditRow),
          clienteId: row.cliente_id,
          context,
          entityType: "sla_alert",
          operationId,
        })),
      );
    }
  }

  for (const upd of ops.toUpdate) {
    const before = openAlerts.find((alert) => alert.id === upd.id) ?? null;
    const { error } = await supabase
      .from("sla_alerts")
      .update({
        status: upd.status,
        entered_at: upd.entered_at,
        deadline: upd.deadline,
        last_seen_at: now,
      })
      .eq("id", upd.id);
    if (error) {
      return fail("update_alert", error.message, 500, {
        alert_id: upd.id,
        publicError: "Failed to update alert",
      });
    }
    auditEvents.push({
      action: "alert.status_changed",
      actor,
      after: alertAuditSnapshot({
        ...(before ?? {}),
        deadline: upd.deadline,
        entered_at: upd.entered_at,
        id: upd.id,
        status: upd.status,
      } as AlertAuditRow),
      before: before ? alertAuditSnapshot(before as AlertAuditRow) : null,
      clienteId: before?.cliente_id ?? null,
      context,
      entityId: upd.id,
      entityType: "sla_alert",
      operationId,
    });
  }

  if (ops.toTouch.length > 0) {
    const { error } = await supabase
      .from("sla_alerts")
      .update({ last_seen_at: now })
      .in("id", ops.toTouch);
    if (error) {
      return fail("touch_alerts", error.message, 500, {
        publicError: "Failed to touch alerts",
        touched_count: ops.toTouch.length,
      });
    }
  }

  if (ops.toResolve.length > 0) {
    const { error } = await supabase
      .from("sla_alerts")
      .update({ resolved_at: now })
      .in("id", ops.toResolve);
    if (error) {
      return fail("resolve_alerts", error.message, 500, {
        publicError: "Failed to resolve alerts",
        resolved_count: ops.toResolve.length,
      });
    }
    for (const id of ops.toResolve) {
      const before = openAlerts.find((alert) => alert.id === id) ?? null;
      auditEvents.push({
        action: "alert.auto_resolved",
        actor,
        after: before ? { ...alertAuditSnapshot(before as AlertAuditRow), resolved_at: now } : { id, resolved_at: now },
        before: before ? alertAuditSnapshot(before as AlertAuditRow) : null,
        clienteId: before?.cliente_id ?? null,
        context,
        entityId: id,
        entityType: "sla_alert",
        operationId,
      });
    }
  }

  auditEvents.unshift({
    action: "alert.cron_run",
    actor,
    context,
    entityType: "sla_alerts_cron",
    metadata: {
      inserted: ops.toInsert.length,
      resolved: ops.toResolve.length,
      snapshot_total: snapshot.length,
      stage_sla: stageSlaAlerts.length,
      status_updated: ops.toUpdate.length,
      task_overdue: taskOverdueAlerts.length,
      followup: followupAlerts.length,
      contract_expiry: contractExpiryAlerts.length,
      touched_count: ops.toTouch.length,
    },
    operationId,
  });
  await logAuditEvents(auditEvents);

  return NextResponse.json({
    ok: true,
    snapshot: {
      total: snapshot.length,
      stage_sla: stageSlaAlerts.length,
      task_overdue: taskOverdueAlerts.length,
      followup: followupAlerts.length,
      contract_expiry: contractExpiryAlerts.length,
    },
    inserted: ops.toInsert.length,
    updated: ops.toUpdate.length,
    touched: ops.toTouch.length,
    resolved: ops.toResolve.length,
  });
}
