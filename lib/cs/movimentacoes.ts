import { formatPeriodLabel, toDateRange } from "@/lib/period";
import type { DateRange, PeriodPreset } from "@/lib/types";

export type CsMovementStage = {
  id: string;
  name: string;
  slug: string | null;
  color: string;
  order_index: number;
  isUnknown?: boolean;
};

export type CsMovementHistoryRecord = {
  id: string;
  cliente_id: string | null;
  from_stage_id: string | null;
  to_stage_id: string | null;
  changed_by: string | null;
  action_type: string | null;
  created_at: string | null;
};

export type CsMovementClientRecord = {
  id: string;
  nomecliente: string | null;
  nome: string | null;
  nome_fantasia: string | null;
  code: string | null;
};

export type CsMovementProfileRecord = {
  id: string;
  full_name: string | null;
};

export type CsStageMovementEvent = {
  id: string;
  clienteId: string | null;
  clienteNome: string;
  clienteCode: string | null;
  fromStage: CsMovementStage;
  toStage: CsMovementStage;
  changedByName: string;
  createdAt: string | null;
};

export type CsStageMovementFlow = {
  key: string;
  label: string;
  fromStage: CsMovementStage;
  toStage: CsMovementStage;
  count: number;
  uniqueClients: number;
  percentage: number;
  lastMovedAt: string | null;
};

export type CsStageMovementBalance = {
  stage: CsMovementStage;
  entries: number;
  exits: number;
  net: number;
};

export type CsStageMovementData = {
  periodLabel: string;
  range: {
    from: string | null;
    to: string | null;
  };
  totalMovements: number;
  uniqueClients: number;
  flows: CsStageMovementFlow[];
  balances: CsStageMovementBalance[];
  events: CsStageMovementEvent[];
  topFlow: CsStageMovementFlow | null;
  biggestPositiveBalance: CsStageMovementBalance | null;
};

export type BuildCsStageMovementDataInput = {
  periodLabel: string;
  range: {
    from: string | null;
    to: string | null;
  };
  stages: CsMovementStage[];
  clients: CsMovementClientRecord[];
  profiles: CsMovementProfileRecord[];
  history: CsMovementHistoryRecord[];
};

export type ParsedCsMovementsPeriod = {
  period: Exclude<PeriodPreset, "all" | "monthPick">;
  custom: DateRange;
  label: string;
  range: {
    from: Date | null;
    to: Date | null;
  };
};

const VALID_PERIODS: Array<ParsedCsMovementsPeriod["period"]> = [
  "today",
  "last7",
  "last30",
  "month",
  "lastMonth",
  "year",
  "custom",
];

const NO_STAGE: CsMovementStage = {
  id: "__no_stage__",
  name: "Sem etapa anterior",
  slug: null,
  color: "#94a3b8",
  order_index: -2,
  isUnknown: true,
};

const UNKNOWN_STAGE: CsMovementStage = {
  id: "__unknown_stage__",
  name: "Etapa desconhecida",
  slug: null,
  color: "#64748b",
  order_index: 9999,
  isUnknown: true,
};

function asString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function clientName(client: CsMovementClientRecord | undefined, clienteId: string | null) {
  return client?.nomecliente ?? client?.nome ?? client?.nome_fantasia ?? clienteId ?? "Cliente não identificado";
}

function resolveStage(stageById: Map<string, CsMovementStage>, stageId: string | null, isFromStage: boolean) {
  if (!stageId) return isFromStage ? NO_STAGE : UNKNOWN_STAGE;
  return stageById.get(stageId) ?? { ...UNKNOWN_STAGE, id: stageId };
}

export function parseCsMovementsPeriod(
  searchParams: Record<string, string | string[] | undefined>,
  now = new Date(),
): ParsedCsMovementsPeriod {
  const rawPeriod = asString(searchParams.period);
  const period = VALID_PERIODS.includes(rawPeriod as ParsedCsMovementsPeriod["period"])
    ? (rawPeriod as ParsedCsMovementsPeriod["period"])
    : "month";
  const custom = {
    from: asString(searchParams.from) ?? "",
    to: asString(searchParams.to) ?? "",
  };
  let [from, to] = toDateRange(period, custom, { now });
  if (period === "custom" && custom.from && custom.to) {
    const fromDate = new Date(`${custom.from}T00:00:00`);
    const toDate = new Date(`${custom.to}T00:00:00`);
    if (!Number.isNaN(fromDate.getTime()) && !Number.isNaN(toDate.getTime())) {
      const start = fromDate <= toDate ? fromDate : toDate;
      const end = fromDate <= toDate ? toDate : fromDate;
      from = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0);
      to = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);
    }
  }

  return {
    period,
    custom,
    label: formatPeriodLabel(period, custom),
    range: { from, to },
  };
}

export function buildCsStageMovementData(input: BuildCsStageMovementDataInput): CsStageMovementData {
  const stageById = new Map(input.stages.map((stage) => [stage.id, stage]));
  const clientById = new Map(input.clients.map((client) => [client.id, client]));
  const profileById = new Map(input.profiles.map((profile) => [profile.id, profile]));
  const stageChanges = input.history.filter((entry) => entry.action_type === "stage_change");

  const events = stageChanges
    .map((entry) => {
      const fromStage = resolveStage(stageById, entry.from_stage_id, true);
      const toStage = resolveStage(stageById, entry.to_stage_id, false);
      const client = entry.cliente_id ? clientById.get(entry.cliente_id) : undefined;
      const profile = entry.changed_by ? profileById.get(entry.changed_by) : undefined;

      return {
        id: entry.id,
        clienteId: entry.cliente_id,
        clienteNome: clientName(client, entry.cliente_id),
        clienteCode: client?.code ?? null,
        fromStage,
        toStage,
        changedByName: profile?.full_name ?? "Não informado",
        createdAt: entry.created_at,
      };
    })
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

  const uniqueClients = new Set(events.map((event) => event.clienteId).filter(Boolean)).size;
  const flowAccumulator = new Map<
    string,
    CsStageMovementFlow & { clientIds: Set<string> }
  >();
  const balanceAccumulator = new Map<string, CsStageMovementBalance>();

  for (const stage of input.stages) {
    balanceAccumulator.set(stage.id, { stage, entries: 0, exits: 0, net: 0 });
  }

  for (const event of events) {
    const key = `${event.fromStage.id}->${event.toStage.id}`;
    const existing = flowAccumulator.get(key);
    const clientIds = existing?.clientIds ?? new Set<string>();
    if (event.clienteId) clientIds.add(event.clienteId);

    flowAccumulator.set(key, {
      key,
      label: `${event.fromStage.name} → ${event.toStage.name}`,
      fromStage: event.fromStage,
      toStage: event.toStage,
      count: (existing?.count ?? 0) + 1,
      uniqueClients: clientIds.size,
      percentage: 0,
      lastMovedAt: existing?.lastMovedAt && event.createdAt
        ? existing.lastMovedAt > event.createdAt ? existing.lastMovedAt : event.createdAt
        : existing?.lastMovedAt ?? event.createdAt,
      clientIds,
    });

    if (!event.fromStage.isUnknown) {
      const current = balanceAccumulator.get(event.fromStage.id) ?? { stage: event.fromStage, entries: 0, exits: 0, net: 0 };
      current.exits += 1;
      current.net = current.entries - current.exits;
      balanceAccumulator.set(event.fromStage.id, current);
    }

    if (!event.toStage.isUnknown) {
      const current = balanceAccumulator.get(event.toStage.id) ?? { stage: event.toStage, entries: 0, exits: 0, net: 0 };
      current.entries += 1;
      current.net = current.entries - current.exits;
      balanceAccumulator.set(event.toStage.id, current);
    }
  }

  const totalMovements = events.length;
  const flows = [...flowAccumulator.values()]
    .map(({ clientIds, ...flow }) => ({
      ...flow,
      uniqueClients: clientIds.size,
      percentage: totalMovements > 0 ? roundPercent((flow.count / totalMovements) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || String(b.lastMovedAt ?? "").localeCompare(String(a.lastMovedAt ?? "")));

  const balances = [...balanceAccumulator.values()]
    .filter((balance) => balance.entries > 0 || balance.exits > 0)
    .sort((a, b) => a.stage.order_index - b.stage.order_index);
  const biggestPositiveBalance = [...balances]
    .filter((balance) => balance.net > 0)
    .sort((a, b) => b.net - a.net || b.entries - a.entries)[0] ?? null;

  return {
    periodLabel: input.periodLabel,
    range: input.range,
    totalMovements,
    uniqueClients,
    flows,
    balances,
    events,
    topFlow: flows[0] ?? null,
    biggestPositiveBalance,
  };
}

export function toCsMovementDataRange(range: ParsedCsMovementsPeriod["range"]) {
  return {
    from: toIso(range.from),
    to: toIso(range.to),
  };
}
