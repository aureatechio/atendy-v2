"use server";

import { revalidatePath } from "next/cache";
import { buildClientStageHistoryRow } from "@/lib/audit/history";
import { createAuditOperationId, getAuditActor, logAuditEvent } from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { createClient } from "@/lib/supabase/server";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";

export interface AssignResponsavelInput {
  clienteId: string;
  responsavelId: string | null;
}

export interface AssignResponsavelResult {
  ok: boolean;
  error?: string;
}

export async function assignResponsavel(
  input: AssignResponsavelInput,
): Promise<AssignResponsavelResult> {
  const snapshot = await getAuthSnapshot();
  if (snapshot.status !== "active") {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }

  const { clienteId, responsavelId } = input;
  if (!clienteId) {
    return { ok: false, error: "Cliente não informado." };
  }

  const supabase = await createClient();

  const { data: clienteAtual, error: fetchError } = await supabase
    .from("clientes_cadastro")
    .select("id, responsavel_atendimento, current_stage_id")
    .eq("id", clienteId)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: `Erro ao carregar cliente: ${fetchError.message}` };
  }
  if (!clienteAtual) {
    return { ok: false, error: "Cliente não encontrado." };
  }

  const operationId = createAuditOperationId();
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("clientes_cadastro")
    .update({
      responsavel_atendimento: responsavelId,
      assigned_to: responsavelId,
      updated_at: now,
    })
    .eq("id", clienteId);

  if (updateError) {
    return { ok: false, error: `Falha ao atribuir: ${updateError.message}` };
  }

  await supabase.from("client_stage_history").insert(
    buildClientStageHistoryRow({
      actionType: "reassignment",
      changedBy: snapshot.user.id,
      clienteId,
      fromAssignedTo: clienteAtual.responsavel_atendimento,
      fromStageId: clienteAtual.current_stage_id,
      operationId,
      toAssignedTo: responsavelId,
      toStageId: clienteAtual.current_stage_id,
    }),
  );

  const [actor, context] = await Promise.all([getAuditActor(snapshot.user), getAuditRequestContext()]);
  await logAuditEvent({
    action: "cliente.responsavel_changed",
    actor,
    after: {
      assigned_to: responsavelId,
      responsavel_atendimento: responsavelId,
    },
    before: {
      assigned_to: clienteAtual.responsavel_atendimento,
      responsavel_atendimento: clienteAtual.responsavel_atendimento,
    },
    clienteId,
    context,
    entityId: clienteId,
    entityType: "cliente",
    operationId,
  });

  revalidatePath("/");
  revalidatePath("/funil");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);

  return { ok: true };
}
