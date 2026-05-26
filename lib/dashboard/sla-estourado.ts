import type { FunilData } from "@/lib/types";

export interface SlaEstouradoClienteItem {
  id: string;
  nome: string;
  segmentoNome: string | null;
  responsavelNome: string | null;
  diasNaEtapa: number;
  slaHoursRemaining: number | null;
  stageSlug: string;
  stageName: string;
  stageColor: string;
}

type RankedSlaEstouradoClienteItem = SlaEstouradoClienteItem & {
  stageOrder: number;
};

function hoursRank(value: number | null | undefined) {
  return typeof value === "number" ? value : Number.POSITIVE_INFINITY;
}

function compareSlaPriority(
  a: RankedSlaEstouradoClienteItem,
  b: RankedSlaEstouradoClienteItem,
) {
  const hoursDiff = hoursRank(a.slaHoursRemaining) - hoursRank(b.slaHoursRemaining);
  if (hoursDiff !== 0) return hoursDiff;
  if (b.diasNaEtapa !== a.diasNaEtapa) return b.diasNaEtapa - a.diasNaEtapa;
  if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder;
  return a.nome.localeCompare(b.nome, "pt-BR");
}

export function buildSlaEstouradoClientes(data: FunilData): SlaEstouradoClienteItem[] {
  const stageBySlug = new Map(data.stages_meta.map((stage) => [stage.slug, stage]));
  const byCliente = new Map<string, RankedSlaEstouradoClienteItem>();

  for (const row of data.rows) {
    if (row.slaStatus !== "overdue") continue;
    const cliente = data.clients_map[row.c];
    const stage = stageBySlug.get(row.s);
    if (!cliente || !stage) continue;

    const item: RankedSlaEstouradoClienteItem = {
      id: cliente.id,
      nome: cliente.nome,
      segmentoNome: cliente.segmentoNome,
      responsavelNome: cliente.responsavelNome,
      diasNaEtapa: row.d,
      slaHoursRemaining: row.slaHoursRemaining ?? null,
      stageSlug: stage.slug,
      stageName: stage.name,
      stageColor: stage.color,
      stageOrder: stage.order_index,
    };

    const current = byCliente.get(cliente.id);
    if (!current || compareSlaPriority(item, current) < 0) {
      byCliente.set(cliente.id, item);
    }
  }

  return [...byCliente.values()]
    .sort(compareSlaPriority)
    .map(({ stageOrder: _stageOrder, ...item }) => item);
}
