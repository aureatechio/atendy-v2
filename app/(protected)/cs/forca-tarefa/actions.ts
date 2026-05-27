"use server";

import { revalidatePath } from "next/cache";
import { getAuditActor, logAuditEvents } from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { createClient } from "@/lib/supabase/server";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessCS } from "@/lib/auth/guards";

export interface BulkAssignment {
  clienteId: string;
  toAssigneeId: string;
  fromAssigneeId: string | null;
  stageId: string | null;
}

export interface ReassignBatchInput {
  assignments: BulkAssignment[];
  reason?: string;
}

export interface ReassignBatchResult {
  ok: boolean;
  error?: string;
  operationId?: string;
  updated?: number;
}

export async function reassignBatch(input: ReassignBatchInput): Promise<ReassignBatchResult> {
  const snapshot = await getAuthSnapshot();
  if (!canAccessCS(snapshot) || snapshot.status !== "active") {
    return { ok: false, error: "Sem permissão para executar Força-Tarefa." };
  }

  const { assignments, reason } = input;
  if (!assignments?.length) {
    return { ok: false, error: "Nenhum cliente selecionado." };
  }
  if (assignments.length > 500) {
    return { ok: false, error: "Lote acima do limite (500 clientes). Divida em lotes menores." };
  }

  const supabase = await createClient();
  const userId = snapshot.user.id;
  const operationId = crypto.randomUUID();
  const now = new Date().toISOString();
  const trimmedReason = reason?.trim() || null;

  // Agrupa updates por novo responsável para reduzir round-trips
  const grouped = new Map<string, string[]>();
  for (const a of assignments) {
    if (!a.clienteId || !a.toAssigneeId) continue;
    const list = grouped.get(a.toAssigneeId) ?? [];
    list.push(a.clienteId);
    grouped.set(a.toAssigneeId, list);
  }

  if (grouped.size === 0) {
    return { ok: false, error: "Atribuições inválidas." };
  }

  for (const [assigneeId, clienteIds] of grouped) {
    const { error } = await supabase
      .from("clientes_cadastro")
      .update({
        responsavel_atendimento: assigneeId,
        assigned_to: assigneeId,
        updated_at: now,
      })
      .in("id", clienteIds);
    if (error) {
      return {
        ok: false,
        error: `Falha ao atribuir lote para ${assigneeId}: ${error.message}`,
        operationId,
      };
    }
  }

  const historyRows = assignments.map((a) => ({
    cliente_id: a.clienteId,
    from_stage_id: a.stageId,
    to_stage_id: a.stageId,
    from_assigned_to: a.fromAssigneeId,
    to_assigned_to: a.toAssigneeId,
    changed_by: userId,
    action_type: "bulk_reassignment",
    reason: trimmedReason,
    metadata: {
      operation_id: operationId,
      batch_size: assignments.length,
      source_stage_id: a.stageId,
    },
  }));

  const { error: historyError } = await supabase.from("client_stage_history").insert(historyRows);
  if (historyError) {
    return {
      ok: false,
      error: `Lote aplicado, porém histórico falhou: ${historyError.message}`,
      operationId,
      updated: assignments.length,
    };
  }

  const [actor, context] = await Promise.all([getAuditActor(snapshot.user), getAuditRequestContext()]);
  await logAuditEvents([
    {
      action: "cliente.bulk_reassigned",
      actor,
      context,
      entityType: "cliente_batch",
      metadata: {
        batch_size: assignments.length,
        grouped_assignees: grouped.size,
        reason: trimmedReason,
      },
      operationId,
    },
    ...assignments.map((assignment) => ({
      action: "cliente.responsavel_changed",
      actor,
      after: {
        assigned_to: assignment.toAssigneeId,
        responsavel_atendimento: assignment.toAssigneeId,
      },
      before: {
        assigned_to: assignment.fromAssigneeId,
        responsavel_atendimento: assignment.fromAssigneeId,
      },
      clienteId: assignment.clienteId,
      context,
      entityId: assignment.clienteId,
      entityType: "cliente",
      metadata: {
        batch_size: assignments.length,
        source_stage_id: assignment.stageId,
      },
      operationId,
    })),
  ]);

  revalidatePath("/funil");
  revalidatePath("/cs/forca-tarefa");
  for (const a of assignments) {
    revalidatePath(`/clientes/${a.clienteId}`);
  }

  return { ok: true, operationId, updated: assignments.length };
}
