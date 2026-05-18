import { useMemo, useState } from "react";
import { currencyFormatter, normalizeText, parseDate } from "@/lib/utils";
import { toDateRange, isWithinRange } from "@/lib/period";
import type { Compra, PeriodPreset, CompraColumnKey, SortDirection } from "@/lib/types";

interface ComprasFiltersState {
  search: string;
  period: PeriodPreset;
  periodFrom: string;
  periodTo: string;
  tipoVenda: string;
  statusPagamento: string;
  statusCompra: string;
  statusProducao: string;
  vendedor: string;
  celebridade: string;
  segmento: string;
  etapa: string;
  sync: string;
  sortKey: CompraColumnKey;
  sortDir: SortDirection;
}

const defaultState: ComprasFiltersState = {
  search: "",
  period: "all",
  periodFrom: "",
  periodTo: "",
  tipoVenda: "all",
  statusPagamento: "all",
  statusCompra: "all",
  statusProducao: "all",
  vendedor: "all",
  celebridade: "all",
  segmento: "all",
  etapa: "all",
  sync: "all",
  sortKey: "dataCompra",
  sortDir: "desc",
};

export function useComprasFilters(data: Compra[]) {
  const [state, setState] = useState<ComprasFiltersState>(defaultState);

  const options = useMemo(() => {
    const unique = (key: keyof Compra) =>
      Array.from(new Set(data.map((item) => String(item[key] ?? "")).filter(Boolean))).sort();

    return {
      tipos: unique("tipoVenda"),
      statusPagamento: unique("statusPagamento"),
      statusCompra: unique("statusCompra"),
      statusProducao: unique("statusProducao"),
      vendedores: unique("vendedor"),
      celebridades: unique("celebridade"),
      segmentos: unique("segmento"),
      etapas: unique("atendyStageName"),
    };
  }, [data]);

  const periodRange = useMemo(() => {
    if (state.period !== "custom") return toDateRange(state.period, { from: "", to: "" });
    return toDateRange("custom", { from: state.periodFrom, to: state.periodTo });
  }, [state.period, state.periodFrom, state.periodTo]);

  const filtered = useMemo(() => {
    const query = normalizeText(state.search);
    return data.filter((row) => {
      const date = parseDate(row.dataCompra);
      if (!isWithinRange(date, periodRange)) return false;

      if (state.tipoVenda !== "all" && row.tipoVenda !== state.tipoVenda) return false;
      if (state.statusPagamento !== "all" && row.statusPagamento !== state.statusPagamento) return false;
      if (state.statusCompra !== "all" && row.statusCompra !== state.statusCompra) return false;
      if (state.statusProducao !== "all" && row.statusProducao !== state.statusProducao) return false;
      if (state.vendedor !== "all" && row.vendedor !== state.vendedor) return false;
      if (state.celebridade !== "all" && row.celebridade !== state.celebridade) return false;
      if (state.segmento !== "all" && row.segmento !== state.segmento) return false;
      if (state.etapa !== "all" && row.atendyStageName !== state.etapa) return false;
      if (state.sync !== "all" && String(row.atendySynced) !== state.sync) return false;

      if (!query) return true;
      const haystack = [
        row.dataCompra,
        row.dataPagamento,
        row.numProposta,
        row.cliente,
        row.razaoSocial,
        row.cnpjCpf,
        row.email,
        row.telefone,
        row.vendedor,
        row.agencia,
        row.celebridade,
        row.segmento,
        row.subsegmento,
        row.negocio,
        row.cidade,
        row.estado,
      ]
        .map(normalizeText)
        .join(" ");
      return haystack.includes(query);
    });
  }, [data, state, periodRange]);

  const sorted = useMemo(() => {
    const withIndex = filtered.map((row, index) => ({ row, index }));
    const compare = (a: Compra, b: Compra) => {
      const key = state.sortKey;
      let av: unknown = a[key];
      let bv: unknown = b[key];
      if (key === "atendySynced") {
        av = a.atendySynced === true ? 1 : 0;
        bv = b.atendySynced === true ? 1 : 0;
      }
      if (key === "valorTotalCompra" || key === "prazo" || key === "atendyStageOrder") {
        av = Number(av ?? 0);
        bv = Number(bv ?? 0);
      }
      if (key === "dataCompra" || key === "dataPagamento") {
        av = parseDate(String(av ?? ""))?.getTime() ?? 0;
        bv = parseDate(String(bv ?? ""))?.getTime() ?? 0;
      }
      const left = typeof av === "string" ? av.toLowerCase() : Number(av ?? 0);
      const right = typeof bv === "string" ? bv.toLowerCase() : Number(bv ?? 0);

      if (left === right) return 0;
      if (state.sortDir === "asc") return left < right ? -1 : 1;
      return left < right ? 1 : -1;
    };
    return withIndex
      .sort((i1, i2) => {
        if (state.sortDir === "none") return i1.index - i2.index;
        const cmp = compare(i1.row, i2.row);
        return cmp === 0 ? i1.index - i2.index : cmp;
      })
      .map((item) => item.row);
  }, [filtered, state.sortDir, state.sortKey]);

  const setFilter = <K extends keyof ComprasFiltersState>(key: K, value: ComprasFiltersState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  return {
    state,
    setFilter,
    options,
    filteredCount: filtered.length,
    rows: sorted,
    periodRange,
  };
}

export type { ComprasFiltersState };

export function formatMoney(value: number) {
  return currencyFormatter.format(Number(value || 0));
}

export const periodPresets = [
  { value: "all", label: "Todo o período" },
  { value: "month", label: "Mês atual" },
  { value: "lastMonth", label: "Mês anterior" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
] as const;
