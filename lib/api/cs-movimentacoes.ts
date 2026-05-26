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

export type CsMovementsSearchParams = Record<string, string | string[] | undefined>;

type StageRecord = {
  id: string;
  name: string | null;
  slug: string | null;
  color: string | null;
  order_index: number | null;
};

type RpcEvent = {
  id: string;
  cliente_id: string | null;
  from_stage_id: string | null;
  to_stage_id: string | null;
  changed_by: string | null;
  created_at: string | null;
};

type RpcClient = {
  id: string;
  code: string | null;
  nomecliente: string | null;
  nome: string | null;
  nome_fantasia: string | null;
};

type RpcProfile = {
  id: string;
  full_name: string | null;
};

type RpcFlow = {
  from_stage_id: string | null;
  to_stage_id: string | null;
  count: number;
  unique_clients: number;
  last_moved_at: string | null;
  percentage: number;
};

type RpcBalance = {
  stage_id: string;
  entries: number;
  exits: number;
  net: number;
};

type RpcResponse = {
  range_from: string | null;
  range_to: string | null;
  total_movements: number;
  unique_clients: number;
  event_count: number;
  event_limit: number;
  flows: RpcFlow[] | null;
  balances: RpcBalance[] | null;
  events: RpcEvent[] | null;
  stages: StageRecord[] | null;
  clients: RpcClient[] | null;
  profiles: RpcProfile[] | null;
};

const RPC_EVENT_LIMIT = 5000;

function normalizeStage(stage: StageRecord): CsMovementStage {
  return {
    id: stage.id,
    name: stage.name ?? "Etapa sem nome",
    slug: stage.slug,
    color: stage.color ?? "#64748b",
    order_index: Number(stage.order_index ?? 9999),
  };
}

export async function getCsStageMovements(searchParams: CsMovementsSearchParams = {}): Promise<CsStageMovementData> {
  const supabase = await createClient();
  const parsedPeriod = parseCsMovementsPeriod(searchParams);
  const range = toCsMovementDataRange(parsedPeriod.range);

  const { data, error } = await supabase.rpc("get_cs_stage_movements", {
    range_from: range.from,
    range_to: range.to,
    event_limit: RPC_EVENT_LIMIT,
  });

  if (error) {
    throw new Error(`Erro ao buscar movimentações via RPC: ${error.message}`);
  }

  const payload = (data ?? {}) as RpcResponse;

  const stages: CsMovementStage[] = (payload.stages ?? []).map(normalizeStage);
  const clients: CsMovementClientRecord[] = (payload.clients ?? []).map((client) => ({
    id: client.id,
    code: client.code,
    nomecliente: client.nomecliente,
    nome: client.nome,
    nome_fantasia: client.nome_fantasia,
  }));
  const profiles: CsMovementProfileRecord[] = (payload.profiles ?? []).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
  }));

  const history: CsMovementHistoryRecord[] = (payload.events ?? []).map((entry) => ({
    id: entry.id,
    cliente_id: entry.cliente_id,
    from_stage_id: entry.from_stage_id,
    to_stage_id: entry.to_stage_id,
    changed_by: entry.changed_by,
    action_type: "stage_change",
    created_at: entry.created_at,
  }));

  return buildCsStageMovementData({
    periodLabel: parsedPeriod.label,
    range,
    stages,
    clients,
    profiles,
    history,
    precomputed: {
      totalMovements: Number(payload.total_movements ?? 0),
      uniqueClients: Number(payload.unique_clients ?? 0),
      flows: (payload.flows ?? []).map((flow) => ({
        from_stage_id: flow.from_stage_id,
        to_stage_id: flow.to_stage_id,
        count: Number(flow.count ?? 0),
        unique_clients: Number(flow.unique_clients ?? 0),
        last_moved_at: flow.last_moved_at,
        percentage: Number(flow.percentage ?? 0),
      })),
      balances: (payload.balances ?? []).map((balance) => ({
        stage_id: balance.stage_id,
        entries: Number(balance.entries ?? 0),
        exits: Number(balance.exits ?? 0),
        net: Number(balance.net ?? 0),
      })),
    },
  });
}
