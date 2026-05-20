import type { CurrentAlert } from "@/lib/sla/diffAlerts";

export interface FollowupClienteRow {
  id: string;
  current_stage_id: string | null;
  stage_entered_at: string | null;
}

export interface FollowupStageRow {
  id: string;
  followup_days: number | null;
  is_final: boolean | null;
}

export interface EvaluateFollowupInput {
  clientes: FollowupClienteRow[];
  stageById: Map<string, FollowupStageRow>;
  lastInteractionByCliente: Map<string, string | null>;
  warnAtPercent?: number;
  now?: Date;
}

const DAY_MS = 86_400_000;

/**
 * Follow-up alert: triggers when a cliente sits in a stage for longer than the
 * stage's `followup_days` budget without any interaction. The "interaction
 * clock" resets on comments, stage moves, meetings, adjustments, and task
 * activity (see view `cliente_last_interaction`).
 */
export function evaluateFollowup({
  clientes,
  stageById,
  lastInteractionByCliente,
  warnAtPercent = 80,
  now = new Date(),
}: EvaluateFollowupInput): CurrentAlert[] {
  const out: CurrentAlert[] = [];
  const nowMs = now.getTime();
  for (const cliente of clientes) {
    if (!cliente.current_stage_id) continue;
    const stage = stageById.get(cliente.current_stage_id);
    if (!stage || stage.is_final) continue;
    if (!stage.followup_days || stage.followup_days <= 0) continue;

    const lastInteractionIso =
      lastInteractionByCliente.get(cliente.id) ?? cliente.stage_entered_at;
    if (!lastInteractionIso) continue;

    const lastInteractionMs = new Date(lastInteractionIso).getTime();
    if (Number.isNaN(lastInteractionMs)) continue;

    const budgetMs = stage.followup_days * DAY_MS;
    const elapsedMs = nowMs - lastInteractionMs;
    if (elapsedMs <= 0) continue;

    const deadlineMs = lastInteractionMs + budgetMs;
    const percent = (elapsedMs / budgetMs) * 100;

    let status: "warning" | "overdue" | null = null;
    if (percent >= 100) status = "overdue";
    else if (percent >= warnAtPercent) status = "warning";
    if (!status) continue;

    out.push({
      type: "followup",
      clienteId: cliente.id,
      stageId: stage.id,
      taskId: null,
      status,
      enteredAt: new Date(lastInteractionMs).toISOString(),
      deadline: new Date(deadlineMs).toISOString(),
    });
  }
  return out;
}
