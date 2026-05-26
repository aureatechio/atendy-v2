"use server";

import { revalidatePath } from "next/cache";
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

  const { error } = await supabase.from("client_comments").insert({
    cliente_id: clienteId,
    author_id: user.id,
    content: trimmed,
  });
  if (error) return { ok: false, error: error.message };

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

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("clientes_cadastro")
    .update({ current_stage_id: newStageId, stage_entered_at: now, updated_at: now })
    .eq("id", clienteId);
  if (updateError) return { ok: false, error: updateError.message };

  await supabase.from("client_stage_history").insert({
    cliente_id: clienteId,
    from_stage_id: current.current_stage_id,
    to_stage_id: newStageId,
    changed_by: user.id,
    action_type: "stage_change",
    reason: null,
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

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("clientes_cadastro")
    .update({
      is_archived: archived,
      archived_at: archived ? now : null,
      updated_at: now,
    })
    .eq("id", clienteId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath("/clientes");
  revalidatePath("/funil");
  revalidatePath("/funil/v1");
  return { ok: true };
}
