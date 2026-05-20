import type { CurrentAlert } from "@/lib/sla/diffAlerts";

export interface TaskOverdueRow {
  id: string;
  cliente_id: string | null;
  pipeline_stage_id: string | null;
  status: string | null;
  deadline: string | null;
  started_at: string | null;
  created_at: string | null;
}

export interface EvaluateTaskOverdueInput {
  tasks: TaskOverdueRow[];
  now?: Date;
}

/**
 * Task-level overdue alert: independent of the stage SLA. Triggers when a task
 * has a deadline in the past and hasn't been completed (`concluido`).
 */
export function evaluateTaskOverdue({
  tasks,
  now = new Date(),
}: EvaluateTaskOverdueInput): CurrentAlert[] {
  const out: CurrentAlert[] = [];
  for (const task of tasks) {
    if (!task.cliente_id || !task.id) continue;
    if (task.status === "concluido") continue;
    if (!task.deadline) continue;

    const deadline = new Date(task.deadline);
    if (Number.isNaN(deadline.getTime())) continue;
    if (deadline.getTime() >= now.getTime()) continue;

    out.push({
      type: "task_overdue",
      clienteId: task.cliente_id,
      stageId: task.pipeline_stage_id ?? null,
      taskId: task.id,
      status: "overdue",
      enteredAt: new Date(
        task.started_at ?? task.created_at ?? task.deadline,
      ).toISOString(),
      deadline: deadline.toISOString(),
    });
  }
  return out;
}
