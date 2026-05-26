"use server";

import { revalidatePath } from "next/cache";
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

  await supabase.from("client_stage_history").insert({
    cliente_id: clienteId,
    from_stage_id: clienteAtual.current_stage_id,
    to_stage_id: clienteAtual.current_stage_id,
    from_assigned_to: clienteAtual.responsavel_atendimento,
    to_assigned_to: responsavelId,
    changed_by: snapshot.user.id,
    action_type: "reassignment",
  });

  revalidatePath("/");
  revalidatePath("/funil");
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clienteId}`);

  return { ok: true };
}
