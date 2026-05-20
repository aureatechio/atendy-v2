import { evaluateSla } from "@/lib/sla/calculateDeadline";
import type { CurrentAlert } from "@/lib/sla/diffAlerts";
import type { SlaUnit } from "@/lib/types";

export interface StageRow {
  id: string;
  sla_amount: number | null;
  sla_unit: string | null;
  warn_at_percent: number | null;
  is_final: boolean | null;
}

export interface TaskRow {
  cliente_id: string | null;
  pipeline_stage_id: string | null;
  started_at: string | null;
  created_at: string | null;
}

export interface EvaluateStageSlaInput {
  tasks: TaskRow[];
  stageById: Map<string, StageRow>;
  holidays: ReadonlySet<string>;
}

export function evaluateStageSla({
  tasks,
  stageById,
  holidays,
}: EvaluateStageSlaInput): CurrentAlert[] {
  const byKey = new Map<string, CurrentAlert>();
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
        holidays,
      });
    } catch {
      continue;
    }

    if (evaluation.status !== "warning" && evaluation.status !== "overdue") continue;
    if (!evaluation.deadline) continue;

    const key = `${task.cliente_id}:${stage.id}`;
    byKey.set(key, {
      type: "stage_sla",
      clienteId: task.cliente_id,
      stageId: stage.id,
      taskId: null,
      status: evaluation.status,
      enteredAt: new Date(enteredAt).toISOString(),
      deadline: evaluation.deadline.toISOString(),
    });
  }
  return [...byKey.values()];
}
