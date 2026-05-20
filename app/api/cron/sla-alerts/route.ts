import { NextResponse } from "next/server";
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
  diffAlerts,
  type CurrentAlert,
  type OpenAlert,
  type AlertType,
} from "@/lib/sla/diffAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

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

  let stages: (StageRow & FollowupStageRow)[];
  let stageTasks: TaskRow[];
  let overdueTasks: TaskOverdueRow[];
  let clientes: ClienteRow[];
  let lastInteractions: LastInteractionRow[];
  let holidayRows: HolidayRow[];

  try {
    [stages, stageTasks, overdueTasks, clientes, lastInteractions, holidayRows] =
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
      ]);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load source data", detail: (err as Error).message },
      { status: 500 },
    );
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

  const snapshot: CurrentAlert[] = [
    ...stageSlaAlerts,
    ...taskOverdueAlerts,
    ...followupAlerts,
  ];

  const { data: openAlertsRaw, error: openErr } = await supabase
    .from("sla_alerts")
    .select("id,type,cliente_id,stage_id,task_id,status")
    .is("resolved_at", null);
  if (openErr) {
    return NextResponse.json(
      { error: "Failed to load open alerts", detail: openErr.message },
      { status: 500 },
    );
  }

  const openAlerts: OpenAlert[] = (openAlertsRaw ?? []).map((a) => ({
    id: a.id as string,
    type: (a.type as AlertType) ?? "stage_sla",
    cliente_id: a.cliente_id as string,
    stage_id: (a.stage_id as string | null) ?? null,
    task_id: (a.task_id as string | null) ?? null,
    status: a.status as "warning" | "overdue",
  }));

  const ops = diffAlerts(snapshot, openAlerts);
  const now = new Date().toISOString();

  if (ops.toInsert.length > 0) {
    const { error } = await supabase.from("sla_alerts").insert(
      ops.toInsert.map((row) => ({
        ...row,
        fired_at: now,
        last_seen_at: now,
      })),
    );
    if (error) {
      return NextResponse.json(
        { error: "Failed to insert alerts", detail: error.message },
        { status: 500 },
      );
    }
  }

  for (const upd of ops.toUpdate) {
    const { error } = await supabase
      .from("sla_alerts")
      .update({ status: upd.status, last_seen_at: now })
      .eq("id", upd.id);
    if (error) {
      return NextResponse.json(
        { error: "Failed to update alert", detail: error.message, id: upd.id },
        { status: 500 },
      );
    }
  }

  if (ops.toTouch.length > 0) {
    const { error } = await supabase
      .from("sla_alerts")
      .update({ last_seen_at: now })
      .in("id", ops.toTouch);
    if (error) {
      return NextResponse.json(
        { error: "Failed to touch alerts", detail: error.message },
        { status: 500 },
      );
    }
  }

  if (ops.toResolve.length > 0) {
    const { error } = await supabase
      .from("sla_alerts")
      .update({ resolved_at: now })
      .in("id", ops.toResolve);
    if (error) {
      return NextResponse.json(
        { error: "Failed to resolve alerts", detail: error.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    ok: true,
    snapshot: {
      total: snapshot.length,
      stage_sla: stageSlaAlerts.length,
      task_overdue: taskOverdueAlerts.length,
      followup: followupAlerts.length,
    },
    inserted: ops.toInsert.length,
    updated: ops.toUpdate.length,
    touched: ops.toTouch.length,
    resolved: ops.toResolve.length,
  });
}
