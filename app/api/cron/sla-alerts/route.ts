import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSla } from "@/lib/sla/calculateDeadline";
import { diffAlerts, type CurrentAlert, type OpenAlert } from "@/lib/sla/diffAlerts";
import type { SlaUnit } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;

interface StageRow {
  id: string;
  sla_amount: number | null;
  sla_unit: string | null;
  warn_at_percent: number | null;
  is_final: boolean | null;
}

interface TaskRow {
  cliente_id: string | null;
  pipeline_stage_id: string | null;
  started_at: string | null;
  created_at: string | null;
}

interface HolidayRow {
  date: string;
}

async function fetchAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
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
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  let stages: StageRow[];
  let tasks: TaskRow[];
  let holidayRows: HolidayRow[];
  try {
    [stages, tasks, holidayRows] = await Promise.all([
      fetchAll<StageRow>((from, to) =>
        supabase
          .from("client_pipeline_stages")
          .select("id,sla_amount,sla_unit,warn_at_percent,is_final")
          .eq("is_active", true)
          .range(from, to),
      ),
      fetchAll<TaskRow>((from, to) =>
        supabase
          .from("production_tasks")
          .select("cliente_id,pipeline_stage_id,started_at,created_at")
          .not("pipeline_stage_id", "is", null)
          .neq("status", "finalizado")
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

  const snapshotByKey = new Map<string, CurrentAlert>();
  for (const task of tasks) {
    if (!task.cliente_id || !task.pipeline_stage_id) continue;
    const stage = stageById.get(task.pipeline_stage_id);
    if (!stage || stage.is_final) continue;
    if (stage.sla_amount == null) continue;

    const enteredAt = task.started_at ?? task.created_at;
    if (!enteredAt) continue;

    let evaluation;
    try {
      evaluation = evaluateSla({
        enteredAt,
        slaAmount: stage.sla_amount,
        slaUnit: (stage.sla_unit as SlaUnit | null) ?? "business_days",
        warnAtPercent: stage.warn_at_percent ?? 80,
        holidays: holidaySet,
      });
    } catch {
      continue;
    }

    if (evaluation.status !== "warning" && evaluation.status !== "overdue") continue;
    if (!evaluation.deadline) continue;

    const key = `${task.cliente_id}:${stage.id}`;
    snapshotByKey.set(key, {
      clienteId: task.cliente_id,
      stageId: stage.id,
      status: evaluation.status,
      enteredAt: new Date(enteredAt).toISOString(),
      deadline: evaluation.deadline.toISOString(),
    });
  }

  const snapshot = [...snapshotByKey.values()];

  const { data: openAlertsRaw, error: openErr } = await supabase
    .from("sla_alerts")
    .select("id,cliente_id,stage_id,status")
    .is("resolved_at", null);
  if (openErr) {
    return NextResponse.json(
      { error: "Failed to load open alerts", detail: openErr.message },
      { status: 500 },
    );
  }

  const openAlerts: OpenAlert[] = (openAlertsRaw ?? []).map((a) => ({
    id: a.id as string,
    cliente_id: a.cliente_id as string,
    stage_id: a.stage_id as string,
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
    snapshot: snapshot.length,
    inserted: ops.toInsert.length,
    updated: ops.toUpdate.length,
    touched: ops.toTouch.length,
    resolved: ops.toResolve.length,
  });
}
