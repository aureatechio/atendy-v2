import type { FunilClientDetail, FunilData, FunilRow, FunilStageMeta, SlaUnit } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { evaluateSla } from "@/lib/sla/calculateDeadline";
import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";
import { fetchSupabaseAll } from "@/lib/supabase/paginate";

type HolidayRecord = {
  date: string;
};

type StageRecord = {
  id: string;
  name: string | null;
  slug: string | null;
  color: string | null;
  order_index: number | null;
  is_final: boolean | null;
  parent_stage_id: string | null;
  sla_amount: number | null;
  sla_unit: string | null;
  warn_at_percent: number | null;
  followup_days: number | null;
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
  nomecliente?: string | null;
  nome?: string | null;
  whatsapp?: string | null;
  valor: string | number | null;
  deal_value: string | number | null;
  current_stage_id: string | null;
  stage_entered_at: string | null;
  created_at: string | null;
  is_archived: boolean | null;
  responsavel_atendimento?: string | null;
  assigned_to?: string | null;
  segmento_id?: string | null;
  subsegmento_id?: string | null;
  segment?: string | null;
  subsegment?: string | null;
  prazo_final?: string | null;
  celebridade?: string | null;
};

type ProfileRecord = {
  id: string;
  full_name: string | null;
};

type SegmentoRecord = {
  id: string;
  nome: string | null;
};

type SubsegmentoRecord = {
  id: string;
  nome: string | null;
};

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

export function buildFunilData(
  stages: StageRecord[],
  tasks: TaskRecord[],
  clients: ClientRecord[],
  profiles: ProfileRecord[] = [],
  segmentos: SegmentoRecord[] = [],
  subsegmentos: SubsegmentoRecord[] = [],
  holidays: HolidayRecord[] = [],
): FunilData {
  const activeStages = stages
    .filter((stage) => stage.slug && stage.order_index != null)
    .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));

  const stageById = new Map(activeStages.map((stage) => [stage.id, stage]));
  const rootStageOf = (stage: StageRecord): StageRecord => {
    let current = stage;
    const seen = new Set<string>();
    while (current.parent_stage_id) {
      if (seen.has(current.id)) break;
      seen.add(current.id);
      const parent = stageById.get(current.parent_stage_id);
      if (!parent) break;
      current = parent;
    }
    return current;
  };

  const holidaySet = new Set(holidays.map((h) => h.date));

  const computeSla = (stage: StageRecord, enteredAt: string | null) => {
    if (!enteredAt || stage.sla_amount == null) {
      return { slaStatus: "none" as const, slaDeadline: null, slaHoursRemaining: null };
    }
    try {
      const result = evaluateSla({
        enteredAt,
        slaAmount: stage.sla_amount,
        slaUnit: (stage.sla_unit as SlaUnit | null) ?? "business_days",
        warnAtPercent: stage.warn_at_percent ?? 80,
        holidays: holidaySet,
      });
      return {
        slaStatus: result.status,
        slaDeadline: result.deadline ? result.deadline.toISOString() : null,
        slaHoursRemaining: result.hoursRemaining,
      };
    } catch {
      return { slaStatus: "none" as const, slaDeadline: null, slaHoursRemaining: null };
    }
  };

  const clientById = new Map(clients.filter((client) => !client.is_archived).map((client) => [client.id, client]));
  const activeClientKeys = new Set<string>();
  const activeClientIds = new Set<string>();
  const rows: FunilRow[] = [];

  for (const task of tasks) {
    if (!task.cliente_id || !task.pipeline_stage_id) continue;
    if (task.status === COMPLETED_TASK_STATUS) continue;
    if (!clientById.has(task.cliente_id)) continue;

    const rawStage = stageById.get(task.pipeline_stage_id);
    if (!rawStage?.slug) continue;
    const stage = rootStageOf(rawStage);
    if (!stage.slug || stage.is_final) continue;

    const key = `${task.cliente_id}:${stage.id}`;
    if (activeClientKeys.has(key)) continue;

    activeClientKeys.add(key);
    activeClientIds.add(task.cliente_id);

    const activeSince = task.started_at ?? task.created_at;
    const sla = computeSla(stage, activeSince);
    rows.push({
      c: task.cliente_id,
      s: stage.slug,
      d: Number(daysSince(activeSince).toFixed(2)),
      a: toDateKey(activeSince),
      l: task.cliente_id,
      ...sla,
    });
  }

  for (const client of clientById.values()) {
    if (!client.current_stage_id || activeClientIds.has(client.id)) continue;
    const rawStage = stageById.get(client.current_stage_id);
    if (!rawStage?.slug) continue;
    const stage = rootStageOf(rawStage);
    if (!stage.slug) continue;

    const activeSince = client.stage_entered_at ?? client.created_at;
    const sla = computeSla(stage, activeSince);
    rows.push({
      c: client.id,
      s: stage.slug,
      d: Number(daysSince(activeSince).toFixed(2)),
      a: toDateKey(activeSince),
      l: client.id,
      ...sla,
    });
  }

  const valor_map = Object.fromEntries(
    [...clientById.values()].map((client) => [
      client.id,
      numberValue(client.valor) || numberValue(client.deal_value),
    ]),
  );

  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const segmentoById = new Map(segmentos.map((segmento) => [segmento.id, segmento]));
  const subsegmentoById = new Map(subsegmentos.map((sub) => [sub.id, sub]));

  const clients_map: Record<string, FunilClientDetail> = {};
  for (const client of clientById.values()) {
    const responsavelId = client.responsavel_atendimento ?? client.assigned_to ?? null;
    const responsavel = responsavelId ? profileById.get(responsavelId) ?? null : null;
    const segmento = client.segmento_id ? segmentoById.get(client.segmento_id) ?? null : null;
    const subsegmento = client.subsegmento_id ? subsegmentoById.get(client.subsegmento_id) ?? null : null;
    const segmentoNome = segmento?.nome ?? client.segment ?? null;
    const subsegmentoNome = subsegmento?.nome ?? client.subsegment ?? null;

    clients_map[client.id] = {
      id: client.id,
      nome: client.nomecliente ?? client.nome ?? "Sem nome",
      whatsapp: client.whatsapp ?? null,
      valor: numberValue(client.valor) || numberValue(client.deal_value),
      responsavelId,
      responsavelNome: responsavel?.full_name ?? null,
      segmentoId: client.segmento_id ?? null,
      segmentoNome,
      subsegmentoNome,
      prazoFinal: client.prazo_final ?? null,
      celebridade: client.celebridade ?? null,
    };
  }

  const stageToMeta = (stage: StageRecord): FunilStageMeta => ({
    id: stage.id,
    slug: String(stage.slug),
    name: stage.name ?? String(stage.slug),
    order_index: Number(stage.order_index ?? 0),
    color: stage.color ?? "#64748b",
    is_final: Boolean(stage.is_final),
    parent_stage_id: stage.parent_stage_id,
    sla_amount: stage.sla_amount,
    sla_unit: (stage.sla_unit as SlaUnit | null) ?? "business_days",
    warn_at_percent: stage.warn_at_percent ?? 80,
    followup_days: stage.followup_days,
  });

  const rootStages = activeStages.filter((stage) => stage.parent_stage_id === null);
  const substagesByParent = new Map<string, StageRecord[]>();
  for (const stage of activeStages) {
    if (!stage.parent_stage_id) continue;
    const list = substagesByParent.get(stage.parent_stage_id) ?? [];
    list.push(stage);
    substagesByParent.set(stage.parent_stage_id, list);
  }

  const stages_meta: FunilStageMeta[] = rootStages.map((stage) => {
    const meta = stageToMeta(stage);
    const children = substagesByParent.get(stage.id);
    if (children && children.length > 0) {
      meta.substages = children
        .slice()
        .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))
        .map(stageToMeta);
    }
    return meta;
  });

  return { stages_meta, rows, valor_map, clients_map };
}

export async function getFunilDados(): Promise<FunilData> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Authenticated Supabase session is required for Funil de Producao.");
  }

  const [stages, tasks, clients, profiles, segmentos, subsegmentos, holidays] = await Promise.all([
    fetchSupabaseAll<StageRecord>(
      (from, to) =>
        supabase
          .from("client_pipeline_stages")
          .select("id,name,slug,color,order_index,is_final,parent_stage_id,sla_amount,sla_unit,warn_at_percent,followup_days")
          .eq("is_active", true)
          .order("order_index", { ascending: true })
          .range(from, to),
    ),
    fetchSupabaseAll<TaskRecord>(
      (from, to) =>
        supabase
          .from("production_tasks")
          .select("id,cliente_id,pipeline_stage_id,status,started_at,created_at")
          .not("pipeline_stage_id", "is", null)
          .neq("status", COMPLETED_TASK_STATUS)
          .range(from, to),
    ),
    fetchSupabaseAll<ClientRecord>(
      (from, to) =>
        supabase
          .from("clientes_cadastro")
          .select(
            "id,nomecliente,nome,whatsapp,valor,deal_value,current_stage_id,stage_entered_at,created_at,is_archived,responsavel_atendimento,assigned_to,segmento_id,subsegmento_id,segment,subsegment,prazo_final,celebridade",
          )
          .eq("is_archived", false)
          .range(from, to),
    ),
    fetchSupabaseAll<ProfileRecord>(
      (from, to) => supabase.from("profiles").select("id,full_name").range(from, to),
    ),
    fetchSupabaseAll<SegmentoRecord>(
      (from, to) => supabase.from("segmentos").select("id,nome").range(from, to),
    ),
    fetchSupabaseAll<SubsegmentoRecord>(
      (from, to) => supabase.from("subsegmentos").select("id,nome").range(from, to),
    ),
    fetchSupabaseAll<HolidayRecord>(
      (from, to) => supabase.from("business_holidays").select("date").range(from, to),
    ),
  ]);

  return buildFunilData(stages, tasks, clients, profiles, segmentos, subsegmentos, holidays);
}
