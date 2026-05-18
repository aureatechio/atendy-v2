import type { FunilData, FunilRow, FunilStageMeta } from "@/lib/types";

type StageRecord = {
  id: string;
  name: string | null;
  slug: string | null;
  color: string | null;
  order_index: number | null;
  is_final: boolean | null;
};

type TaskRecord = {
  id: string;
  cliente_id: string | null;
  pipeline_stage_id: string | null;
  status: string | null;
  started_at: string | null;
  created_at: string | null;
};

type ClientRecord = {
  id: string;
  valor: string | number | null;
  deal_value: string | number | null;
  current_stage_id: string | null;
  stage_entered_at: string | null;
  created_at: string | null;
  is_archived: boolean | null;
};

const PAGE_SIZE = 1000;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase env vars are not configured for Funil de Producao.");
  }

  return { url: url.replace(/\/$/, ""), key };
}

async function fetchSupabasePage<T>(path: string, from: number, to: number): Promise<T[]> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase env vars are not configured");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      Range: `${from}-${to}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${details}`);
  }

  return response.json() as Promise<T[]>;
}

async function fetchSupabaseAll<T>(path: string): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const page = await fetchSupabasePage<T>(path, from, from + PAGE_SIZE - 1);
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysSince(value: string | null | undefined) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max((Date.now() - date.getTime()) / 86_400_000, 0);
}

function toDateKey(value: string | null | undefined) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function buildFunilData(stages: StageRecord[], tasks: TaskRecord[], clients: ClientRecord[]): FunilData {
  const activeStages = stages
    .filter((stage) => stage.slug && stage.order_index != null)
    .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));

  const stageById = new Map(activeStages.map((stage) => [stage.id, stage]));
  const clientById = new Map(clients.filter((client) => !client.is_archived).map((client) => [client.id, client]));
  const activeClientKeys = new Set<string>();
  const activeClientIds = new Set<string>();
  const rows: FunilRow[] = [];

  for (const task of tasks) {
    if (!task.cliente_id || !task.pipeline_stage_id) continue;
    if (!clientById.has(task.cliente_id)) continue;

    const stage = stageById.get(task.pipeline_stage_id);
    if (!stage?.slug || stage.is_final) continue;

    const key = `${task.cliente_id}:${task.pipeline_stage_id}`;
    if (activeClientKeys.has(key)) continue;

    activeClientKeys.add(key);
    activeClientIds.add(task.cliente_id);

    const activeSince = task.started_at ?? task.created_at;
    rows.push({
      c: task.cliente_id,
      s: stage.slug,
      d: Number(daysSince(activeSince).toFixed(2)),
      a: toDateKey(activeSince),
      l: task.cliente_id,
    });
  }

  for (const client of clientById.values()) {
    if (!client.current_stage_id || activeClientIds.has(client.id)) continue;
    const stage = stageById.get(client.current_stage_id);
    if (!stage?.slug) continue;

    const activeSince = client.stage_entered_at ?? client.created_at;
    rows.push({
      c: client.id,
      s: stage.slug,
      d: Number(daysSince(activeSince).toFixed(2)),
      a: toDateKey(activeSince),
      l: client.id,
    });
  }

  const valor_map = Object.fromEntries(
    [...clientById.values()].map((client) => [
      client.id,
      numberValue(client.valor) || numberValue(client.deal_value),
    ]),
  );

  const stages_meta: FunilStageMeta[] = activeStages.map((stage) => ({
    slug: String(stage.slug),
    name: stage.name ?? String(stage.slug),
    order_index: Number(stage.order_index ?? 0),
    color: stage.color ?? "#64748b",
    is_final: Boolean(stage.is_final),
  }));

  return { stages_meta, rows, valor_map };
}

export async function getFunilDados(): Promise<FunilData> {
  const [stages, tasks, clients] = await Promise.all([
    fetchSupabaseAll<StageRecord>(
      "client_pipeline_stages?select=id,name,slug,color,order_index,is_final&is_active=eq.true&order=order_index.asc",
    ),
    fetchSupabaseAll<TaskRecord>(
      "production_tasks?select=id,cliente_id,pipeline_stage_id,status,started_at,created_at&pipeline_stage_id=not.is.null&status=neq.finalizado",
    ),
    fetchSupabaseAll<ClientRecord>(
      "clientes_cadastro?select=id,valor,deal_value,current_stage_id,stage_entered_at,created_at,is_archived&is_archived=eq.false",
    ),
  ]);

  return buildFunilData(stages, tasks, clients);
}
