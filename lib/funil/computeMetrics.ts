import { currencyFormatter } from "@/lib/utils";
import type { FunilData } from "@/lib/types";

export type ScaleMode = "sqrt" | "linear";

export interface FunilKpi {
  clientesUnicos: number;
  valorTotal: number;
  valorTotalLabel: string;
  finalizados: number;
  leadTime: number;
  leadTimeLabel: string;
}

export interface StageSummary {
  slug: string;
  name: string;
  color: string;
  order_index: number;
  is_final: boolean;
  clientes: number;
  valor: number;
  valorLabel: string;
  leadTimes: number[];
  meanDays: number;
  medianDays: number;
  minDays: number;
  maxDays: number;
  bottleneck: boolean;
}

const MEDIAN_LIMIT = 2;

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[m];
  return (sorted[m - 1] + sorted[m]) / 2;
}

export function isBottleneck(stage: {
  clientes: number;
  meanDays: number;
  medianDays: number;
}) {
  if (stage.clientes === 0) return false;
  if (stage.meanDays > 30 && stage.clientes >= MEDIAN_LIMIT) return true;
  if (stage.medianDays > 0 && stage.meanDays > stage.medianDays * 1.8) return true;
  return false;
}

export function computeFunilKpis(data: FunilData, rows: FunilData["rows"]) {
  const stageBySlug = new Map(data.stages_meta.map((s) => [s.slug, s]));
  const finalStageSlugs = data.stages_meta.filter((s) => s.is_final).map((s) => s.slug);
  const leadTimeValues: number[] = [];
  const valorClientes = new Map<string, number>();
  const clientesSet = new Set<string>();

  const valueForRow = (row: FunilData["rows"][number]) => {
    const key = row.l ?? row.c;
    return Number(data.valor_map[key] ?? data.valor_map[row.c] ?? 0);
  };
  const valueKeyForRow = (row: FunilData["rows"][number]) => row.l ?? row.c;

  for (const row of rows) {
    if (!row.c) continue;
    clientesSet.add(row.c);
    leadTimeValues.push(row.d ?? 0);

    const value = valueForRow(row);
    const valueKey = valueKeyForRow(row);
    if (!Number.isNaN(value) && !valorClientes.has(valueKey)) {
      valorClientes.set(valueKey, value);
    }
  }

  let finalizados = 0;
  for (const stage of finalStageSlugs) {
    const inFinal = rows.filter((r) => r.s === stage && r.c);
    const uniq = new Set(inFinal.map((r) => r.c));
    finalizados += uniq.size;
  }

  const valorTotal = [...valorClientes.values()].reduce((sum, value) => sum + value, 0);
  const leadTime = leadTimeValues.length ? leadTimeValues.reduce((sum, value) => sum + value, 0) / leadTimeValues.length : 0;

  const stageSummary: StageSummary[] = data.stages_meta
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((stage) => {
      const inStage = rows.filter((r) => r.s === stage.slug);
      const leadTimes = inStage.map((r) => r.d ?? 0);
      const ids = new Set(inStage.map((r) => r.c).filter(Boolean));
      const valueKeys = new Set<string>();
      let valor = 0;
      for (const row of inStage) {
        if (!row.c) continue;
        const valueKey = valueKeyForRow(row);
        if (valueKeys.has(valueKey)) continue;

        valueKeys.add(valueKey);
        const value = valueForRow(row);
        if (!Number.isNaN(value)) valor += value;
      }

      const stageKpi = {
        slug: stage.slug,
        name: stage.name,
        color: stage.color,
        order_index: stage.order_index,
        is_final: stage.is_final,
        clientes: ids.size,
        valor,
        valorLabel: currencyFormatter.format(valor),
        leadTimes,
        meanDays: leadTimes.length ? leadTimes.reduce((sum, v) => sum + v, 0) / leadTimes.length : 0,
        medianDays: median(leadTimes),
        minDays: leadTimes.length ? Math.min(...leadTimes) : 0,
        maxDays: leadTimes.length ? Math.max(...leadTimes) : 0,
        bottleneck: false,
      } as StageSummary;

      stageKpi.bottleneck = isBottleneck(stageKpi);
      return stageKpi;
    });

  const kpis: FunilKpi = {
    clientesUnicos: clientesSet.size,
    valorTotal,
    valorTotalLabel: currencyFormatter.format(valorTotal),
    finalizados,
    leadTime,
    leadTimeLabel: `${leadTime.toFixed(2).replace(".", ",")} dias`,
  };

  return { kpis, stageSummary, stageBySlug };
}
