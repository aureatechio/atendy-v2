'use client';

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import type { FunilClientDetail, FunilData, FunilRow, SlaStatus } from "@/lib/types";
import type { StageSummary } from "@/lib/funil/computeMetrics";
import { currencyFormatter, normalizeText, parseDate, ptDateFormatter } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SortKey = "name" | "valor" | "dias" | "desde";
type SortDir = "asc" | "desc";

interface Props {
  stage: StageSummary | null;
  rows: FunilRow[];
  clients: FunilData["clients_map"];
  onClose: () => void;
}

interface DrawerRow {
  clienteId: string;
  detail: FunilClientDetail | null;
  dias: number;
  desde: string;
  desdeMs: number;
  valor: number;
  slaStatus: SlaStatus;
  slaDeadline: string | null;
  slaHoursRemaining: number | null;
}

function formatHoursRemaining(hours: number | null) {
  if (hours == null) return null;
  const abs = Math.abs(hours);
  const sign = hours < 0 ? "-" : "";
  if (abs >= 48) return `${sign}${Math.round(abs / 24)}d`;
  if (abs >= 1) return `${sign}${Math.round(abs)}h`;
  return `${sign}${Math.max(1, Math.round(abs * 60))}min`;
}

function slaPillLabel(status: SlaStatus, hoursRemaining: number | null): string | null {
  if (status === "overdue") {
    const txt = formatHoursRemaining(hoursRemaining);
    return txt ? `atrasado ${txt}` : "atrasado";
  }
  if (status === "warning") {
    const txt = formatHoursRemaining(hoursRemaining);
    return txt ? `vence em ${txt}` : "em alerta";
  }
  if (status === "ok") {
    const txt = formatHoursRemaining(hoursRemaining);
    return txt ? `${txt} restante` : "no prazo";
  }
  return null;
}

const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

function formatDateBr(value: string | null) {
  if (!value) return "—";
  const parsed = parseDate(value) ?? new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return ptDateFormatter.format(parsed);
}

function formatShortDate(value: string | null) {
  if (!value) return "—";
  const parsed = parseDate(value) ?? new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return SHORT_DATE.format(parsed);
}

function formatDays(value: number) {
  return `${value.toFixed(1).replace(".", ",")}d`;
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}M`;
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function FunilStageDrawer({ stage, rows, clients, onClose }: Props) {
  const open = stage !== null;

  const [search, setSearch] = useState("");
  const [responsavelFilter, setResponsavelFilter] = useState<string>("all");
  const [segmentoFilter, setSegmentoFilter] = useState<string>("all");
  const [valorMin, setValorMin] = useState<string>("");
  const [valorMax, setValorMax] = useState<string>("");
  const [diasMin, setDiasMin] = useState<string>("");
  const [diasMax, setDiasMax] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("dias");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResponsavelFilter("all");
    setSegmentoFilter("all");
    setValorMin("");
    setValorMax("");
    setDiasMin("");
    setDiasMax("");
    setSortKey("dias");
    setSortDir("desc");
    setFiltersExpanded(false);
  }, [stage?.slug, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stageRows: DrawerRow[] = useMemo(() => {
    if (!stage) return [];
    return rows
      .filter((row) => row.s === stage.slug)
      .map((row) => {
        const detail = clients[row.c] ?? null;
        const parsed = parseDate(row.a) ?? new Date(row.a);
        const desdeMs = Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
        return {
          clienteId: row.c,
          detail,
          dias: row.d ?? 0,
          desde: row.a,
          desdeMs,
          valor: detail?.valor ?? 0,
          slaStatus: row.slaStatus ?? "none",
          slaDeadline: row.slaDeadline ?? null,
          slaHoursRemaining: row.slaHoursRemaining ?? null,
        };
      });
  }, [stage, rows, clients]);

  const responsavelOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of stageRows) {
      const id = r.detail?.responsavelId;
      if (!id) continue;
      map.set(id, r.detail?.responsavelNome ?? "Sem nome");
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [stageRows]);

  const segmentoOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of stageRows) {
      const nome = r.detail?.segmentoNome;
      if (!nome) continue;
      const id = r.detail?.segmentoId ?? nome;
      map.set(id, nome);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [stageRows]);

  const activeAdvancedFilters = useMemo(() => {
    let n = 0;
    if (responsavelFilter !== "all") n++;
    if (segmentoFilter !== "all") n++;
    if (valorMin !== "" || valorMax !== "") n++;
    if (diasMin !== "" || diasMax !== "") n++;
    return n;
  }, [responsavelFilter, segmentoFilter, valorMin, valorMax, diasMin, diasMax]);

  const filteredRows = useMemo(() => {
    const searchNorm = normalizeText(search);
    const valorMinNum = valorMin === "" ? null : Number(valorMin);
    const valorMaxNum = valorMax === "" ? null : Number(valorMax);
    const diasMinNum = diasMin === "" ? null : Number(diasMin);
    const diasMaxNum = diasMax === "" ? null : Number(diasMax);

    const result = stageRows.filter((row) => {
      if (searchNorm) {
        const haystack = normalizeText(
          [row.detail?.nome, row.detail?.whatsapp, row.detail?.celebridade, row.detail?.responsavelNome]
            .filter(Boolean)
            .join(" "),
        );
        if (!haystack.includes(searchNorm)) return false;
      }

      if (responsavelFilter !== "all") {
        if ((row.detail?.responsavelId ?? "") !== responsavelFilter) return false;
      }

      if (segmentoFilter !== "all") {
        const id = row.detail?.segmentoId ?? row.detail?.segmentoNome ?? "";
        if (id !== segmentoFilter) return false;
      }

      if (valorMinNum !== null && Number.isFinite(valorMinNum) && row.valor < valorMinNum) return false;
      if (valorMaxNum !== null && Number.isFinite(valorMaxNum) && row.valor > valorMaxNum) return false;
      if (diasMinNum !== null && Number.isFinite(diasMinNum) && row.dias < diasMinNum) return false;
      if (diasMaxNum !== null && Number.isFinite(diasMaxNum) && row.dias > diasMaxNum) return false;

      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = (a.detail?.nome ?? "").localeCompare(b.detail?.nome ?? "", "pt-BR");
      } else if (sortKey === "valor") {
        cmp = a.valor - b.valor;
      } else if (sortKey === "desde") {
        cmp = a.desdeMs - b.desdeMs;
      } else {
        cmp = a.dias - b.dias;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [
    stageRows,
    search,
    responsavelFilter,
    segmentoFilter,
    valorMin,
    valorMax,
    diasMin,
    diasMax,
    sortKey,
    sortDir,
  ]);

  const totalValor = useMemo(
    () => filteredRows.reduce((sum, r) => sum + r.valor, 0),
    [filteredRows],
  );

  const slaSummary = useMemo(
    () =>
      filteredRows.reduce(
        (acc, r) => {
          if (r.slaStatus === "overdue") acc.overdue += 1;
          else if (r.slaStatus === "warning") acc.warning += 1;
          return acc;
        },
        { overdue: 0, warning: 0 },
      ),
    [filteredRows],
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const clearFilters = () => {
    setResponsavelFilter("all");
    setSegmentoFilter("all");
    setValorMin("");
    setValorMax("");
    setDiasMin("");
    setDiasMax("");
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span aria-hidden>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  if (!open || !stage) return null;

  return (
    <div className="fv2-drawer-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="fv2-drawer-backdrop"
        onClick={onClose}
        aria-label="Fechar painel"
      />
      <aside className="fv2-drawer" style={{ ["--drawer-color" as string]: stage.color }}>
        <header className="fv2-drawer-head">
          <div className="fv2-drawer-head-main">
            <span className="fv2-drawer-dot" style={{ background: stage.color }} aria-hidden />
            <div>
              <p className="fv2-drawer-eyebrow">Etapa do funil</p>
              <h2 className="fv2-drawer-title">{stage.name}</h2>
              <p className="fv2-drawer-sub">
                <strong>{filteredRows.length}</strong>
                {filteredRows.length !== stageRows.length ? ` de ${stageRows.length}` : ""}{" "}
                {stageRows.length === 1 ? "cliente" : "clientes"} ·{" "}
                {currencyFormatter.format(totalValor)}
                {slaSummary.overdue > 0 ? (
                  <>
                    {" · "}
                    <span className="fv2-sla-pill fv2-sla-pill--overdue">
                      {slaSummary.overdue} atrasado{slaSummary.overdue === 1 ? "" : "s"}
                    </span>
                  </>
                ) : null}
                {slaSummary.warning > 0 ? (
                  <>
                    {" · "}
                    <span className="fv2-sla-pill fv2-sla-pill--warning">
                      {slaSummary.warning} em alerta
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="fv2-drawer-toolbar">
          <div className="fv2-drawer-search">
            <Search className="h-4 w-4" aria-hidden />
            <Input
              type="search"
              placeholder="Buscar cliente, telefone, responsável…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button
            type="button"
            className={`fv2-drawer-filter-toggle ${filtersExpanded ? "is-open" : ""}`}
            onClick={() => setFiltersExpanded((v) => !v)}
            aria-expanded={filtersExpanded}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            Filtros
            {activeAdvancedFilters > 0 ? (
              <span className="fv2-drawer-filter-badge">{activeAdvancedFilters}</span>
            ) : null}
            <ChevronDown className="h-3.5 w-3.5 fv2-drawer-filter-chev" aria-hidden />
          </button>
        </div>

        {filtersExpanded ? (
          <div className="fv2-drawer-filters-panel">
            <div className="fv2-drawer-filter-row">
              <Select
                aria-label="Responsável"
                value={responsavelFilter}
                onChange={(event) => setResponsavelFilter(event.target.value)}
              >
                <option value="all">Responsável: todos</option>
                {responsavelOptions.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </Select>
              <Select
                aria-label="Segmento"
                value={segmentoFilter}
                onChange={(event) => setSegmentoFilter(event.target.value)}
              >
                <option value="all">Segmento: todos</option>
                {segmentoOptions.map(([id, nome]) => (
                  <option key={id} value={id}>
                    {nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="fv2-drawer-filter-row">
              <div className="fv2-drawer-range" aria-label="Valor">
                <span>Valor</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="min"
                  value={valorMin}
                  onChange={(event) => setValorMin(event.target.value)}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="max"
                  value={valorMax}
                  onChange={(event) => setValorMax(event.target.value)}
                />
              </div>
              <div className="fv2-drawer-range" aria-label="Dias na etapa">
                <span>Dias</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="min"
                  value={diasMin}
                  onChange={(event) => setDiasMin(event.target.value)}
                />
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="max"
                  value={diasMax}
                  onChange={(event) => setDiasMax(event.target.value)}
                />
              </div>
            </div>
            {activeAdvancedFilters > 0 ? (
              <button
                type="button"
                className="fv2-drawer-clear"
                onClick={clearFilters}
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="fv2-drawer-table" role="table">
          <div className="fv2-drawer-thead" role="row">
            <button
              type="button"
              className="fv2-drawer-th fv2-drawer-th--name"
              role="columnheader"
              onClick={() => toggleSort("name")}
            >
              Cliente {sortIndicator("name")}
            </button>
            <button
              type="button"
              className="fv2-drawer-th fv2-drawer-th--num"
              role="columnheader"
              onClick={() => toggleSort("valor")}
            >
              Valor {sortIndicator("valor")}
            </button>
            <button
              type="button"
              className="fv2-drawer-th fv2-drawer-th--num"
              role="columnheader"
              onClick={() => toggleSort("dias")}
            >
              Tempo {sortIndicator("dias")}
            </button>
            <div className="fv2-drawer-th fv2-drawer-th--resp" role="columnheader">
              SLA
            </div>
            <div className="fv2-drawer-th fv2-drawer-th--resp" role="columnheader">
              Responsável
            </div>
            <button
              type="button"
              className="fv2-drawer-th fv2-drawer-th--num"
              role="columnheader"
              onClick={() => toggleSort("desde")}
            >
              Desde {sortIndicator("desde")}
            </button>
          </div>

          <div className="fv2-drawer-tbody" role="rowgroup">
            {filteredRows.length === 0 ? (
              <p className="fv2-drawer-empty">Nenhum cliente atende aos filtros.</p>
            ) : (
              filteredRows.map((row) => {
                const nome = row.detail?.nome ?? "Cliente sem nome";
                const responsavel = row.detail?.responsavelNome ?? "—";
                return (
                  <a
                    key={row.clienteId}
                    className="fv2-drawer-tr"
                    role="row"
                    href={`/clientes/${row.clienteId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Abrir detalhes de ${nome}`}
                  >
                    <div className="fv2-drawer-td fv2-drawer-td--name" role="cell" title={nome}>
                      {nome}
                    </div>
                    <div
                      className="fv2-drawer-td fv2-drawer-td--num"
                      role="cell"
                      title={currencyFormatter.format(row.valor)}
                    >
                      {formatCompactCurrency(row.valor)}
                    </div>
                    <div className="fv2-drawer-td fv2-drawer-td--num" role="cell">
                      {formatDays(row.dias)}
                    </div>
                    <div className="fv2-drawer-td fv2-drawer-td--resp" role="cell">
                      {(() => {
                        const label = slaPillLabel(row.slaStatus, row.slaHoursRemaining);
                        if (!label) return <span style={{ color: "var(--muted)" }}>—</span>;
                        return (
                          <span className={`fv2-sla-pill fv2-sla-pill--${row.slaStatus}`}>
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    <div
                      className="fv2-drawer-td fv2-drawer-td--resp"
                      role="cell"
                      title={responsavel}
                    >
                      {responsavel}
                    </div>
                    <div
                      className="fv2-drawer-td fv2-drawer-td--num"
                      role="cell"
                      title={formatDateBr(row.desde)}
                    >
                      {formatShortDate(row.desde)}
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
