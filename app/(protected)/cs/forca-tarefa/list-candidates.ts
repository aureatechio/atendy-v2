"use server";

import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessCS } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export interface CandidateClient {
  id: string;
  nome: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  stageId: string;
  daysSinceStage: number;
}

export interface ListCandidatesInput {
  stageId: string;
  minDays?: number;
}

export interface ListCandidatesResult {
  ok: boolean;
  error?: string;
  candidates?: CandidateClient[];
}

export async function listCandidates(input: ListCandidatesInput): Promise<ListCandidatesResult> {
  const snapshot = await getAuthSnapshot();
  if (!canAccessCS(snapshot)) {
    return { ok: false, error: "Sem permissão." };
  }

  if (!input.stageId) {
    return { ok: false, error: "Etapa não informada." };
  }

  const minDays = Math.max(0, Number(input.minDays ?? 0));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes_cadastro")
    .select(
      "id, nomecliente, nome, current_stage_id, stage_entered_at, created_at, responsavel_atendimento, assigned_to",
    )
    .eq("is_archived", false)
    .eq("current_stage_id", input.stageId)
    .limit(2000);

  if (error) {
    return { ok: false, error: error.message };
  }

  const rows = data ?? [];
  const responsavelIds = Array.from(
    new Set(rows.map((r) => r.responsavel_atendimento ?? r.assigned_to).filter(Boolean)),
  ) as string[];

  let profilesMap = new Map<string, string>();
  if (responsavelIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", responsavelIds);
    profilesMap = new Map((profiles ?? []).map((p) => [p.id as string, (p.full_name as string) ?? ""]));
  }

  const now = Date.now();
  const candidates: CandidateClient[] = rows
    .map((r) => {
      const enteredAt = r.stage_entered_at ?? r.created_at;
      const days = enteredAt ? Math.max(0, (now - new Date(enteredAt).getTime()) / 86_400_000) : 0;
      const responsavelId = (r.responsavel_atendimento ?? r.assigned_to) as string | null;
      return {
        id: r.id as string,
        nome: ((r.nomecliente as string | null) ?? (r.nome as string | null) ?? "Sem nome") as string,
        responsavelId,
        responsavelNome: responsavelId ? profilesMap.get(responsavelId) ?? null : null,
        stageId: r.current_stage_id as string,
        daysSinceStage: Number(days.toFixed(2)),
      };
    })
    .filter((c) => c.daysSinceStage >= minDays)
    .sort((a, b) => b.daysSinceStage - a.daysSinceStage);

  return { ok: true, candidates };
}
