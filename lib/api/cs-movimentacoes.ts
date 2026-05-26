import {
  buildCsStageMovementData,
  parseCsMovementsPeriod,
  toCsMovementDataRange,
  type CsMovementClientRecord,
  type CsMovementHistoryRecord,
  type CsMovementProfileRecord,
  type CsMovementStage,
  type CsStageMovementData,
} from "@/lib/cs/movimentacoes";
import { createClient } from "@/lib/supabase/server";
import { fetchSupabaseAll } from "@/lib/supabase/paginate";

export type CsMovementsSearchParams = Record<string, string | string[] | undefined>;

type StageRecord = {
  id: string;
  name: string | null;
  slug: string | null;
  color: string | null;
  order_index: number | null;
};

type ClientRecord = {
  id: string;
  code: string | null;
  nomecliente: string | null;
  nome: string | null;
  nome_fantasia: string | null;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
};

type RawTaskHistoryRecord = {
  id: string;
  action_type: string | null;
  from_stage_id: string | null;
  to_stage_id: string | null;
  changed_by: string | null;
  created_at: string | null;
  task_id?: string | null;
  task?: { cliente_id: string | null } | Array<{ cliente_id: string | null }> | null;
};

const ID_CHUNK_SIZE = 500;

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function normalizeStage(stage: StageRecord): CsMovementStage {
  return {
    id: stage.id,
    name: stage.name ?? "Etapa sem nome",
    slug: stage.slug,
    color: stage.color ?? "#64748b",
    order_index: Number(stage.order_index ?? 9999),
  };
}

async function fetchClientsByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<CsMovementClientRecord[]> {
  if (ids.length === 0) return [];
  const rows: ClientRecord[] = [];

  for (let index = 0; index < ids.length; index += ID_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + ID_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("clientes_cadastro")
      .select("id, code, nomecliente, nome, nome_fantasia")
      .in("id", chunk);
    if (error) throw new Error(`Erro ao buscar clientes das movimentações: ${error.message}`);
    rows.push(...((data ?? []) as ClientRecord[]));
  }

  return rows;
}

async function fetchProfilesByIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
): Promise<CsMovementProfileRecord[]> {
  if (ids.length === 0) return [];
  const rows: ProfileRecord[] = [];

  for (let index = 0; index < ids.length; index += ID_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + ID_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", chunk);
    if (error) throw new Error(`Erro ao buscar responsáveis das movimentações: ${error.message}`);
    rows.push(...((data ?? []) as ProfileRecord[]));
  }

  return rows;
}

function taskClienteId(task: RawTaskHistoryRecord["task"]) {
  if (!task) return null;
  if (Array.isArray(task)) return task[0]?.cliente_id ?? null;
  return task.cliente_id ?? null;
}

export async function getCsStageMovements(searchParams: CsMovementsSearchParams = {}): Promise<CsStageMovementData> {
  const supabase = await createClient();
  const parsedPeriod = parseCsMovementsPeriod(searchParams);
  const range = toCsMovementDataRange(parsedPeriod.range);

  const [stagesRes, history] = await Promise.all([
    supabase
      .from("client_pipeline_stages")
      .select("id, name, slug, color, order_index")
      .order("order_index", { ascending: true }),
    fetchSupabaseAll<RawTaskHistoryRecord>((from, to) => {
      let query = supabase
        .from("task_history")
        .select("id, task_id, from_stage_id, to_stage_id, changed_by, action_type, created_at, task:production_tasks!task_history_task_id_fkey(cliente_id)")
        .eq("action_type", "stage_change");

      if (range.from) query = query.gte("created_at", range.from);
      if (range.to) query = query.lte("created_at", range.to);

      return query.order("created_at", { ascending: false }).range(from, to);
    }),
  ]);

  if (stagesRes.error) {
    throw new Error(`Erro ao buscar etapas das movimentações: ${stagesRes.error.message}`);
  }

  const normalizedHistory: CsMovementHistoryRecord[] = history.map((entry) => ({
    id: entry.id,
    cliente_id: taskClienteId(entry.task),
    from_stage_id: entry.from_stage_id,
    to_stage_id: entry.to_stage_id,
    changed_by: entry.changed_by,
    action_type: entry.action_type,
    created_at: entry.created_at,
  }));

  const clientIds = uniqueValues(normalizedHistory.map((entry) => entry.cliente_id));
  const profileIds = uniqueValues(normalizedHistory.map((entry) => entry.changed_by));
  const [clients, profiles] = await Promise.all([
    fetchClientsByIds(supabase, clientIds),
    fetchProfilesByIds(supabase, profileIds),
  ]);

  return buildCsStageMovementData({
    periodLabel: parsedPeriod.label,
    range,
    stages: ((stagesRes.data ?? []) as StageRecord[]).map(normalizeStage),
    clients,
    profiles,
    history: normalizedHistory,
  });
}
