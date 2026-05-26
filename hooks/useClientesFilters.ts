import { useMemo, useState } from "react";
import { isWithinRange, toDateRange } from "@/lib/period";
import { normalizeText } from "@/lib/utils";
import { parseClienteDate } from "@/lib/clientes/format";
import { getActiveParentClienteStages, getClienteStageRootId } from "@/lib/clientes/stages";
import type { SortDirection } from "@/lib/types";
import type {
  ClienteListItem,
  ClientesData,
  ClientesFiltersState,
  ClientesPeriodField,
  ClientesSortKey,
  ClientesVigenciaFilter,
} from "@/lib/clientes/types";

interface UseClientesFiltersOptions {
  now?: Date;
}

export interface ClienteFilterChip {
  key: keyof ClientesFiltersState;
  label: string;
}

const defaultState = (now = new Date()): ClientesFiltersState => ({
  search: "",
  period: "all",
  periodFrom: "",
  periodTo: "",
  monthIndex: now.getMonth(),
  periodField: "createdAt",
  stageId: "all",
  responsavelId: "all",
  status: "active",
  prazo: "all",
  vigencia: "all",
  segmento: "all",
  subsegmento: "all",
  celebridade: "all",
  praca: "all",
  classificacao: "all",
  valorMin: "",
  valorMax: "",
  diasMin: "",
  diasMax: "",
  tarefaUrgente: false,
  semResponsavel: false,
  comReuniao: false,
  sortKey: "lastActivityAt",
  sortDir: "desc",
});

const periodFieldLabels: Record<ClientesPeriodField, string> = {
  createdAt: "Cadastro do cliente",
  stageEnteredAt: "Entrada na etapa atual",
  prazoFinal: "Prazo final",
  contratoAssinadoAt: "Contrato assinado",
  inicioVigencia: "Início da vigência",
};

const vigenciaFilterLabels: Record<Exclude<ClientesVigenciaFilter, "all">, string> = {
  vencida: "Vigência: vencida",
  vigente: "Vigência: vigente",
  next15: "Vigência: próximos 15 dias",
  next30: "Vigência: próximos 30 dias",
  none: "Vigência: sem vigência",
};

function parseItemDate(value: string | null) {
  if (!value) return null;
  return parseClienteDate(value);
}

function dateValue(value: string | null) {
  const parsed = parseItemDate(value);
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
}

function getPeriodFieldDate(item: ClienteListItem, field: ClientesPeriodField) {
  if (field === "stageEnteredAt") return item.stageEnteredAt;
  if (field === "prazoFinal") return item.prazoFinal;
  if (field === "contratoAssinadoAt") return item.contratoAssinadoAt;
  if (field === "inicioVigencia") return item.inicioVigencia;
  return item.createdAt;
}

function uniqueOptions(items: ClienteListItem[], key: keyof ClienteListItem) {
  return Array.from(new Set(items.map((item) => String(item[key] ?? "")).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function compareValues(a: ClienteListItem, b: ClienteListItem, key: ClientesSortKey) {
  if (key === "stageOrder" || key === "diasNaEtapa" || key === "valor") {
    return Number(a[key] ?? 0) - Number(b[key] ?? 0);
  }
  if (key === "prazoFinal" || key === "lastActivityAt") {
    return dateValue(a[key]) - dateValue(b[key]);
  }
  return String(a[key] ?? "").localeCompare(String(b[key] ?? ""), "pt-BR");
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function matchesPrazo(item: ClienteListItem, prazo: ClientesFiltersState["prazo"], now: Date) {
  if (prazo === "all") return true;
  const parsed = parseItemDate(item.prazoFinal);
  if (prazo === "none") return !parsed || Number.isNaN(parsed.getTime());
  if (!parsed || Number.isNaN(parsed.getTime())) return false;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();

  if (prazo === "overdue") return targetStart < todayStart;
  if (prazo === "today") return isSameDay(parsed, now);
  if (prazo === "next7") {
    const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999).getTime();
    return targetStart >= todayStart && targetStart <= max;
  }
  return true;
}

function matchesVigencia(item: ClienteListItem, vigencia: ClientesVigenciaFilter, now: Date) {
  if (vigencia === "all") return true;
  const parsed = parseItemDate(item.vigenciaFinal);
  if (vigencia === "none") return !parsed || Number.isNaN(parsed.getTime());
  if (!parsed || Number.isNaN(parsed.getTime())) return false;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();

  if (vigencia === "vencida") return targetStart < todayStart;
  if (vigencia === "vigente") return targetStart >= todayStart;
  if (vigencia === "next15" || vigencia === "next30") {
    const days = vigencia === "next15" ? 15 : 30;
    const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59, 999).getTime();
    return targetStart >= todayStart && targetStart <= max;
  }
  return true;
}

export function useClientesFilters(data: ClientesData, options: UseClientesFiltersOptions = {}) {
  const now = options.now ?? new Date();
  const [state, setState] = useState(() => defaultState(now));
  const stageById = useMemo(() => new Map(data.stages.map((stage) => [stage.id, stage])), [data.stages]);

  const optionLists = useMemo(() => {
    const responsaveis = new Map<string, string>();
    for (const item of data.items) {
      if (item.responsavelId) responsaveis.set(item.responsavelId, item.responsavelNome ?? "Sem nome");
    }

    return {
      stages: getActiveParentClienteStages(data.stages).map((stage) => ({ id: stage.id, name: stage.name })),
      responsaveis: [...responsaveis.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
      segmentos: uniqueOptions(data.items, "segmentoNome"),
      subsegmentos: uniqueOptions(data.items, "subsegmentoNome"),
      celebridades: uniqueOptions(data.items, "celebridade"),
      pracas: uniqueOptions(data.items, "praca"),
      classificacoes: uniqueOptions(data.items, "classificacao"),
    };
  }, [data.items, data.stages]);

  const periodRange = useMemo(
    () =>
      toDateRange(
        state.period,
        { from: state.periodFrom, to: state.periodTo },
        { monthIndex: state.monthIndex, now },
      ),
    [state.monthIndex, state.period, state.periodFrom, state.periodTo, now],
  );

  const filtered = useMemo(() => {
    const query = normalizeText(state.search);
    const valorMin = state.valorMin === "" ? null : Number(state.valorMin);
    const valorMax = state.valorMax === "" ? null : Number(state.valorMax);
    const diasMin = state.diasMin === "" ? null : Number(state.diasMin);
    const diasMax = state.diasMax === "" ? null : Number(state.diasMax);

    return data.items.filter((item) => {
      if (state.status === "active" && item.isArchived) return false;
      if (state.status === "archived" && !item.isArchived) return false;

      const itemDate = parseItemDate(getPeriodFieldDate(item, state.periodField));
      if (!isWithinRange(itemDate, periodRange)) return false;

      if (state.stageId !== "all" && getClienteStageRootId(item.stageId, stageById) !== state.stageId) return false;
      if (state.responsavelId !== "all" && item.responsavelId !== state.responsavelId) return false;
      if (state.segmento !== "all" && item.segmentoNome !== state.segmento) return false;
      if (state.subsegmento !== "all" && item.subsegmentoNome !== state.subsegmento) return false;
      if (state.celebridade !== "all" && item.celebridade !== state.celebridade) return false;
      if (state.praca !== "all" && item.praca !== state.praca) return false;
      if (state.classificacao !== "all" && item.classificacao !== state.classificacao) return false;
      if (state.tarefaUrgente && item.tarefasUrgentes <= 0) return false;
      if (state.semResponsavel && item.responsavelId) return false;
      if (state.comReuniao && !item.nextMeetingAt) return false;
      if (!matchesPrazo(item, state.prazo, now)) return false;
      if (!matchesVigencia(item, state.vigencia, now)) return false;
      if (valorMin !== null && Number.isFinite(valorMin) && item.valor < valorMin) return false;
      if (valorMax !== null && Number.isFinite(valorMax) && item.valor > valorMax) return false;
      if (diasMin !== null && Number.isFinite(diasMin) && Number(item.diasNaEtapa ?? 0) < diasMin) return false;
      if (diasMax !== null && Number.isFinite(diasMax) && Number(item.diasNaEtapa ?? 0) > diasMax) return false;

      if (!query) return true;
      const haystack = [
        item.nome,
        item.code,
        item.nomeFantasia,
        item.companyName,
        item.companyCnpj,
        item.whatsapp,
        item.email,
        item.instagram,
        item.celebridade,
        item.praca,
        item.segmentoNome,
        item.subsegmentoNome,
        item.responsavelNome,
      ]
        .map(normalizeText)
        .join(" ");

      return haystack.includes(query);
    });
  }, [data.items, now, periodRange, stageById, state]);

  const rows = useMemo(() => {
    const withIndex = filtered.map((item, index) => ({ item, index }));
    return withIndex
      .sort((a, b) => {
        if (state.sortDir === "none") return a.index - b.index;
        const cmp = compareValues(a.item, b.item, state.sortKey);
        if (cmp === 0) return a.index - b.index;
        return state.sortDir === "asc" ? cmp : -cmp;
      })
      .map(({ item }) => item);
  }, [filtered, state.sortDir, state.sortKey]);

  const kpis = useMemo(() => {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return {
      total: rows.length,
      ativos: rows.filter((item) => !item.isArchived).length,
      prazoCritico: rows.filter((item) => {
        const parsed = parseItemDate(item.prazoFinal);
        if (!parsed || Number.isNaN(parsed.getTime())) return false;
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime() <= todayStart;
      }).length,
      semResponsavel: rows.filter((item) => !item.responsavelId).length,
      valorAtivo: rows.filter((item) => !item.isArchived).reduce((sum, item) => sum + item.valor, 0),
    };
  }, [now, rows]);

  const activeFilterChips = useMemo<ClienteFilterChip[]>(() => {
    const chips: ClienteFilterChip[] = [];
    if (state.search) chips.push({ key: "search", label: `Busca: ${state.search}` });
    if (state.period !== "all") chips.push({ key: "period", label: "Período ativo" });
    if (state.periodField !== "createdAt") chips.push({ key: "periodField", label: `Data: ${periodFieldLabels[state.periodField]}` });
    if (state.stageId !== "all") chips.push({ key: "stageId", label: `Etapa: ${optionLists.stages.find((s) => s.id === state.stageId)?.name ?? state.stageId}` });
    if (state.responsavelId !== "all") chips.push({ key: "responsavelId", label: `Responsável: ${optionLists.responsaveis.find(([id]) => id === state.responsavelId)?.[1] ?? state.responsavelId}` });
    if (state.status !== "active") chips.push({ key: "status", label: state.status === "archived" ? "Arquivados" : "Todos os status" });
    if (state.prazo !== "all") chips.push({ key: "prazo", label: "Prazo filtrado" });
    if (state.vigencia !== "all") chips.push({ key: "vigencia", label: vigenciaFilterLabels[state.vigencia] });
    if (state.segmento !== "all") chips.push({ key: "segmento", label: `Segmento: ${state.segmento}` });
    if (state.subsegmento !== "all") chips.push({ key: "subsegmento", label: `Subsegmento: ${state.subsegmento}` });
    if (state.celebridade !== "all") chips.push({ key: "celebridade", label: `Celebridade: ${state.celebridade}` });
    if (state.praca !== "all") chips.push({ key: "praca", label: `Praça: ${state.praca}` });
    if (state.classificacao !== "all") chips.push({ key: "classificacao", label: `Classificação: ${state.classificacao}` });
    if (state.valorMin || state.valorMax) chips.push({ key: "valorMin", label: "Valor filtrado" });
    if (state.diasMin || state.diasMax) chips.push({ key: "diasMin", label: "Tempo na etapa filtrado" });
    if (state.tarefaUrgente) chips.push({ key: "tarefaUrgente", label: "Com tarefa urgente" });
    if (state.semResponsavel) chips.push({ key: "semResponsavel", label: "Sem responsável" });
    if (state.comReuniao) chips.push({ key: "comReuniao", label: "Com reunião" });
    return chips;
  }, [optionLists.responsaveis, optionLists.stages, state]);

  const setFilter = <K extends keyof ClientesFiltersState>(key: K, value: ClientesFiltersState[K]) => {
    setState((current) => ({ ...current, [key]: value }));
  };

  const clearFilter = (key: keyof ClientesFiltersState) => {
    setState((current) => {
      const next = { ...current };
      const base = defaultState(now);
      if (key === "valorMin" || key === "valorMax") {
        next.valorMin = "";
        next.valorMax = "";
        return next;
      }
      if (key === "diasMin" || key === "diasMax") {
        next.diasMin = "";
        next.diasMax = "";
        return next;
      }
      return { ...next, [key]: base[key] };
    });
  };

  const clearAllFilters = () => {
    setState((current) => ({
      ...defaultState(now),
      sortKey: current.sortKey,
      sortDir: current.sortDir,
    }));
  };

  return {
    state,
    setFilter,
    options: optionLists,
    periodRange,
    rows,
    filteredCount: filtered.length,
    kpis,
    activeFilterChips,
    clearFilter,
    clearAllFilters,
  };
}

export const clientesPeriodPresets = [
  { value: "all", label: "Todo o período" },
  { value: "today", label: "Hoje" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "month", label: "Mês atual" },
  { value: "lastMonth", label: "Mês anterior" },
  { value: "monthPick", label: "Selecionar mês" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
] as const;

export const clientesPeriodFieldOptions = [
  { value: "createdAt", label: "Cadastro do cliente" },
  { value: "stageEnteredAt", label: "Entrada na etapa atual" },
  { value: "prazoFinal", label: "Prazo final" },
  { value: "contratoAssinadoAt", label: "Contrato assinado" },
  { value: "inicioVigencia", label: "Início da vigência" },
] as const;

export type { SortDirection };
