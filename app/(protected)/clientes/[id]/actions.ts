"use server";

import { revalidatePath } from "next/cache";
import { buildClientStageHistoryRow } from "@/lib/audit/history";
import { createAuditOperationId, getAuditActor, logAuditEvent } from "@/lib/audit/logger";
import { getAuditRequestContext } from "@/lib/audit/request-context";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function addComment(clienteId: string, content: string): Promise<ActionResult> {
  const trimmed = content.trim();
  if (!trimmed) return { ok: false, error: "Comentário vazio." };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessão inválida." };

  const { data: comment, error } = await supabase
    .from("client_comments")
    .insert({
      cliente_id: clienteId,
      author_id: user.id,
      content: trimmed,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const [actor, context] = await Promise.all([getAuditActor(user), getAuditRequestContext()]);
  await logAuditEvent({
    action: "cliente.comment_added",
    actor,
    clienteId,
    context,
    entityId: comment?.id ?? null,
    entityType: "client_comment",
    metadata: {
      content_length: trimmed.length,
      preview: trimmed.slice(0, 140),
    },
  });

  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

export async function changeStage(clienteId: string, newStageId: string): Promise<ActionResult> {
  if (!newStageId) return { ok: false, error: "Etapa não informada." };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessão inválida." };

  const { data: current, error: readError } = await supabase
    .from("clientes_cadastro")
    .select("current_stage_id")
    .eq("id", clienteId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!current) return { ok: false, error: "Cliente não encontrado." };
  if (current.current_stage_id === newStageId) return { ok: true };

  const operationId = createAuditOperationId();
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("clientes_cadastro")
    .update({ current_stage_id: newStageId, stage_entered_at: now, updated_at: now })
    .eq("id", clienteId);
  if (updateError) return { ok: false, error: updateError.message };

  await supabase.from("client_stage_history").insert(
    buildClientStageHistoryRow({
      actionType: "stage_change",
      changedBy: user.id,
      clienteId,
      fromStageId: current.current_stage_id,
      operationId,
      toStageId: newStageId,
    }),
  );

  const [actor, context] = await Promise.all([getAuditActor(user), getAuditRequestContext()]);
  await logAuditEvent({
    action: "cliente.stage_changed",
    actor,
    after: {
      current_stage_id: newStageId,
    },
    before: {
      current_stage_id: current.current_stage_id,
    },
    clienteId,
    context,
    entityId: clienteId,
    entityType: "cliente",
    operationId,
  });

  revalidatePath("/clientes");
  revalidatePath("/funil");
  revalidatePath("/funil/v1");
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

export async function setArchived(clienteId: string, archived: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, error: "Sessão inválida." };

  const { data: current, error: readError } = await supabase
    .from("clientes_cadastro")
    .select("is_archived,archived_at,archived_by,current_stage_id,responsavel_atendimento,email,whatsapp,company_cnpj")
    .eq("id", clienteId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!current) return { ok: false, error: "Cliente não encontrado." };
  if (Boolean(current.is_archived) === archived) return { ok: true };

  const operationId = createAuditOperationId();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("clientes_cadastro")
    .update({
      is_archived: archived,
      archived_at: archived ? now : null,
      archived_by: archived ? user.id : null,
      updated_at: now,
    })
    .eq("id", clienteId);
  if (error) return { ok: false, error: error.message };

  const actionType = archived ? "archived" : "unarchived";
  const before = {
    archived_at: current.archived_at,
    archived_by: current.archived_by,
    company_cnpj: current.company_cnpj,
    current_stage_id: current.current_stage_id,
    email: current.email,
    is_archived: Boolean(current.is_archived),
    responsavel_atendimento: current.responsavel_atendimento,
    whatsapp: current.whatsapp,
  };
  const after = {
    ...before,
    archived_at: archived ? now : null,
    archived_by: archived ? user.id : null,
    is_archived: archived,
  };

  await supabase.from("client_stage_history").insert(
    buildClientStageHistoryRow({
      actionType,
      changedBy: user.id,
      clienteId,
      fromStageId: current.current_stage_id,
      operationId,
      toStageId: current.current_stage_id,
    }),
  );

  const [actor, context] = await Promise.all([getAuditActor(user), getAuditRequestContext()]);
  await logAuditEvent({
    action: archived ? "cliente.archived" : "cliente.unarchived",
    actor,
    after,
    before,
    clienteId,
    context,
    entityId: clienteId,
    entityType: "cliente",
    operationId,
  });

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/funil");
  revalidatePath("/funil/v1");
  return { ok: true };
}
