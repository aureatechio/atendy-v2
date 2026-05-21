"use server";

import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessCS } from "@/lib/auth/guards";
import { getFunilDados } from "@/lib/api/funil";
import { parseDate } from "@/lib/utils";

export interface CandidateClient {
  id: string;
  nome: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  stageId: string;
  daysSinceStage: number;
  valor: number;
}

export interface StageStats {
  totalInStage: number;
  totalFunil: number;
  pctFunil: number;
  valorTotal: number;
  daysMin: number;
  daysAvg: number;
  daysMax: number;
}

export interface ListCandidatesInput {
  stageId: string;
  month?: string | null;
}

export interface ListCandidatesResult {
  ok: boolean;
  error?: string;
  candidates?: CandidateClient[];
  stats?: StageStats;
}

function monthRange(month: string | null | undefined): [Date | null, Date | null] {
  if (!month) return [null, null];
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return [null, null];
  const year = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(year) || m < 1 || m > 12) return [null, null];
  const from = new Date(year, m - 1, 1, 0, 0, 0, 0);
  const to = new Date(year, m, 0, 23, 59, 59, 999);
  return [from, to];
}

function isInsideRange(dateKey: string, range: [Date | null, Date | null]): boolean {
  const [from, to] = range;
  if (!from && !to) return true;
  const parsed = parseDate(dateKey);
  if (!parsed) return true;
  if (from && parsed < from) return false;
  if (to && parsed > to) return false;
  return true;
}

export async function listCandidates(input: ListCandidatesInput): Promise<ListCandidatesResult> {
  const snapshot = await getAuthSnapshot();
  if (!canAccessCS(snapshot)) {
    return { ok: false, error: "Sem permissão." };
  }
  if (!input.stageId) {
    return { ok: false, error: "Etapa não informada." };
  }

  let funil;
  try {
    funil = await getFunilDados();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao carregar funil." };
  }

  const stageMeta = funil.stages_meta.find((s) => s.id === input.stageId);
  if (!stageMeta) {
    return { ok: false, error: "Etapa não encontrada no funil ativo." };
  }
  const targetSlug = stageMeta.slug;
  const range = monthRange(input.month);

  const filteredRows = funil.rows.filter((r) => isInsideRange(r.a, range));

  const nonFinalSlugs = new Set(
    funil.stages_meta.filter((s) => !s.is_final).map((s) => s.slug),
  );
  const funilRows = filteredRows.filter((r) => nonFinalSlugs.has(r.s));
  const totalFunil = new Set(funilRows.map((r) => r.c)).size;

  const stageRows = filteredRows.filter((r) => r.s === targetSlug);

  const seen = new Set<string>();
  const candidates: CandidateClient[] = [];
  for (const r of stageRows) {
    if (seen.has(r.c)) continue;
    seen.add(r.c);
    const client = funil.clients_map[r.c];
    candidates.push({
      id: r.c,
      nome: client?.nome ?? "Sem nome",
      responsavelId: client?.responsavelId ?? null,
      responsavelNome: client?.responsavelNome ?? null,
      stageId: input.stageId,
      daysSinceStage: r.d ?? 0,
      valor: client?.valor ?? 0,
    });
  }
  candidates.sort((a, b) => b.daysSinceStage - a.daysSinceStage);

  const totalInStage = candidates.length;
  const valorTotal = candidates.reduce((sum, c) => sum + c.valor, 0);
  const daysArr = candidates.map((c) => c.daysSinceStage);
  const daysMin = daysArr.length ? Math.min(...daysArr) : 0;
  const daysMax = daysArr.length ? Math.max(...daysArr) : 0;
  const daysAvg = daysArr.length ? daysArr.reduce((s, n) => s + n, 0) / daysArr.length : 0;
  const pctFunil = totalFunil > 0 ? (totalInStage / totalFunil) * 100 : 0;

  return {
    ok: true,
    candidates,
    stats: { totalInStage, totalFunil, pctFunil, valorTotal, daysMin, daysAvg, daysMax },
  };
}
