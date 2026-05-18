"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  MessageCircle,
  Search,
  Settings2,
  SlidersHorizontal,
  UserRoundX,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ClienteQuickDrawer } from "@/components/cliente/cliente-quick-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useClientesFilters, clientesPeriodFieldOptions, clientesPeriodPresets } from "@/hooks/useClientesFilters";
import { usePaginatedTable } from "@/hooks/usePaginatedTable";
import { currencyFormatter, ptDateFormatter } from "@/lib/utils";
import type { SortDirection } from "@/lib/types";
import type { ClienteListItem, ClientesColumnKey, ClientesData, ClientesPeriodField, ClientesSortKey } from "@/lib/clientes/types";

interface Props {
  initialData: ClientesData;
}

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const STORAGE_KEY = "atendy:clientes:columns";

function parseDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function fmtDate(value: string | null) {
  const parsed = parseDate(value);
  return parsed ? ptDateFormatter.format(parsed) : "—";
}

function fmtDays(value: number | null) {
  if (value === null) return "—";
  if (value === 0) return "hoje";
  return `${value}d`;
}

function whatsappLink(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function prazoVariant(value: string | null) {
  const date = parseDate(value);
  if (!date) return "default" as const;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (target < today) return "danger" as const;
  if (target <= new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).getTime()) return "warning" as const;
  return "default" as const;
}

const columnLabels: Record<ClientesColumnKey, string> = {
  cliente: "Cliente",
  stage: "Etapa",
  responsavel: "Responsável",
  prazo: "Prazo",
  tempo: "Tempo",
  tarefas: "Tarefas",
  valor: "Valor",
  celebridade: "Celebridade",
  praca: "Praça",
  actions: "Ações",
};

const sortByColumn: Partial<Record<ClientesColumnKey, ClientesSortKey>> = {
  cliente: "nome",
  stage: "stageOrder",
  responsavel: "responsavelNome",
  prazo: "prazoFinal",
  tempo: "diasNaEtapa",
  valor: "valor",
};

const defaultVisibleColumns: Record<ClientesColumnKey, boolean> = {
  cliente: true,
  stage: true,
  responsavel: true,
  prazo: true,
  tempo: true,
  tarefas: true,
  valor: true,
  celebridade: true,
  praca: true,
  actions: true,
};

const columnOrder: ClientesColumnKey[] = [
  "cliente",
  "stage",
  "responsavel",
  "prazo",
  "tempo",
  "tarefas",
  "valor",
  "celebridade",
  "praca",
  "actions",
];

function KpiTile({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div className={`clientes-kpi clientes-kpi--${tone}`}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function renderCell(column: ClientesColumnKey, row: ClienteListItem, openDrawer: (row: ClienteListItem) => void) {
  if (column === "cliente") {
    return (
      <button type="button" className="clientes-table-client" onClick={() => openDrawer(row)}>
        <strong>{row.nome}</strong>
        <span>{[row.code, row.companyName].filter(Boolean).join(" · ") || "Sem empresa vinculada"}</span>
      </button>
    );
  }

  if (column === "stage") {
    return row.stageName ? (
      <span className="clientes-stage-pill" style={{ ["--stage-color" as string]: row.stageColor ?? "#64748b" }}>
        {row.stageName}
      </span>
    ) : (
      <span className="ds-text-muted">—</span>
    );
  }

  if (column === "responsavel") return row.responsavelNome ?? <span className="ds-text-muted">Sem responsável</span>;
  if (column === "prazo") return <Badge variant={prazoVariant(row.prazoFinal)}>{fmtDate(row.prazoFinal)}</Badge>;
  if (column === "tempo") return fmtDays(row.diasNaEtapa);
  if (column === "tarefas") {
    return (
      <span className="clientes-task-count">
        {row.tarefasAbertas} aberta{row.tarefasAbertas === 1 ? "" : "s"}
        {row.tarefasUrgentes > 0 ? <Badge variant="danger">{row.tarefasUrgentes} urgente</Badge> : null}
      </span>
    );
  }
  if (column === "valor") return currencyFormatter.format(row.valor);
  if (column === "celebridade") return row.celebridade ?? "—";
  if (column === "praca") return row.praca ?? "—";

  const wa = whatsappLink(row.whatsapp);
  return (
    <div className="clientes-row-actions" onClick={(event) => event.stopPropagation()}>
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" aria-label={`Abrir WhatsApp de ${row.nome}`}>
          <MessageCircle className="h-4 w-4" />
        </a>
      ) : null}
      {row.linkPastaDrive ? (
        <a href={row.linkPastaDrive} target="_blank" rel="noopener noreferrer" aria-label={`Abrir Drive de ${row.nome}`}>
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
      <Link href={`/clientes/${row.id}`} aria-label={`Abrir página de ${row.nome}`}>
        <ExternalLink className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function ClientesDashboard({ initialData }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteListItem | null>(null);
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);

  const { state, setFilter, options, rows, kpis, activeFilterChips, clearFilter, clearAllFilters } =
    useClientesFilters(initialData);
  const { pagedItems, page, pageSize, pageCount, startIndex, endIndex, pageSizeOptions, setPage, setPageSize } =
    usePaginatedTable(rows, [25, 50, 100]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setVisibleColumns({ ...defaultVisibleColumns, ...JSON.parse(stored) });
    } catch {
      setVisibleColumns(defaultVisibleColumns);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    setPage(1);
  }, [rows, setPage]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const visibleColumnKeys = useMemo(() => columnOrder.filter((key) => visibleColumns[key]), [visibleColumns]);
  const currentYear = new Date().getFullYear();
  const monthOptions = MONTH_LABELS.slice(0, new Date().getMonth() + 1);

  const handleSort = (column: ClientesColumnKey) => {
    const sortKey = sortByColumn[column];
    if (!sortKey) return;
    const nextDir: SortDirection =
      state.sortKey !== sortKey ? "asc" : state.sortDir === "asc" ? "desc" : state.sortDir === "desc" ? "none" : "asc";
    setFilter("sortKey", sortKey);
    setFilter("sortDir", nextDir);
  };

  const sortIcon = (column: ClientesColumnKey) => {
    const sortKey = sortByColumn[column];
    if (!sortKey || state.sortKey !== sortKey || state.sortDir === "none") {
      return sortKey ? <ArrowUpDown className="h-3.5 w-3.5 ds-text-muted" /> : null;
    }
    return <span aria-hidden>{state.sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  return (
    <div className="clientes-page">
      <div className="clientes-kpi-grid">
        <KpiTile icon={Users} label="Clientes filtrados" value={String(kpis.total)} />
        <KpiTile icon={CalendarClock} label="Prazo crítico" value={String(kpis.prazoCritico)} tone={kpis.prazoCritico > 0 ? "danger" : "default"} />
        <KpiTile icon={UserRoundX} label="Sem responsável" value={String(kpis.semResponsavel)} tone={kpis.semResponsavel > 0 ? "warning" : "default"} />
        <KpiTile icon={Wallet} label="Valor ativo" value={currencyFormatter.format(kpis.valorAtivo)} />
      </div>

      <Card className="panel-card clientes-filter-card">
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="clientes-filter-grid">
            <div className="clientes-search-field">
              <label className="label">Busca (Cmd/Ctrl + K)</label>
              <div className="clientes-search-input">
                <Search className="h-4 w-4" />
                <Input
                  ref={searchRef}
                  placeholder="Cliente, CNPJ, WhatsApp, e-mail, celebridade..."
                  value={state.search}
                  onChange={(event) => setFilter("search", event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label">Período</label>
              <Select value={state.period} onChange={(event) => setFilter("period", event.target.value as typeof state.period)}>
                {clientesPeriodPresets.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="label">Filtrar por data de</label>
              <Select value={state.periodField} onChange={(event) => setFilter("periodField", event.target.value as ClientesPeriodField)}>
                {clientesPeriodFieldOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            {state.period === "monthPick" ? (
              <div>
                <label className="label">Mês</label>
                <Select value={String(state.monthIndex)} onChange={(event) => setFilter("monthIndex", Number(event.target.value))}>
                  {monthOptions.map((label, idx) => (
                    <option key={label} value={idx}>
                      {label} {currentYear}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {state.period === "custom" ? (
              <>
                <div>
                  <label className="label">De</label>
                  <Input type="date" value={state.periodFrom} onChange={(event) => setFilter("periodFrom", event.target.value)} />
                </div>
                <div>
                  <label className="label">Até</label>
                  <Input type="date" value={state.periodTo} onChange={(event) => setFilter("periodTo", event.target.value)} />
                </div>
              </>
            ) : null}

            <div>
              <label className="label">Etapa</label>
              <Select value={state.stageId} onChange={(event) => setFilter("stageId", event.target.value)}>
                <option value="all">Todas</option>
                {options.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="label">Responsável</label>
              <Select value={state.responsavelId} onChange={(event) => setFilter("responsavelId", event.target.value)}>
                <option value="all">Todos</option>
                {options.responsaveis.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="label">Status</label>
              <Select value={state.status} onChange={(event) => setFilter("status", event.target.value as typeof state.status)}>
                <option value="active">Ativos</option>
                <option value="archived">Arquivados</option>
                <option value="all">Todos</option>
              </Select>
            </div>

            <div>
              <label className="label">Prazo</label>
              <Select value={state.prazo} onChange={(event) => setFilter("prazo", event.target.value as typeof state.prazo)}>
                <option value="all">Todos</option>
                <option value="overdue">Vencidos</option>
                <option value="today">Hoje</option>
                <option value="next7">Próximos 7 dias</option>
                <option value="none">Sem prazo</option>
              </Select>
            </div>
          </div>

          <div className="clientes-filter-actions">
            <Button type="button" variant="secondary" onClick={() => setAdvancedOpen((value) => !value)}>
              <SlidersHorizontal className="h-4 w-4" />
              Filtros avançados
              <ChevronDown className={`h-4 w-4 ${advancedOpen ? "clientes-rotate" : ""}`} />
            </Button>
            <div className="relative">
              <Button type="button" variant="outline" onClick={() => setColumnsOpen((value) => !value)}>
                <Settings2 className="h-4 w-4" /> Colunas
              </Button>
              {columnsOpen ? (
                <div className="ds-popover-content clientes-columns-popover">
                  {columnOrder.map((key) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        className="ds-check"
                        checked={visibleColumns[key]}
                        onChange={(event) => setVisibleColumns((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                      {columnLabels[key]}
                    </label>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setVisibleColumns(defaultVisibleColumns)}>
                    Restaurar
                  </Button>
                </div>
              ) : null}
            </div>
            <Button type="button" variant="ghost" onClick={clearAllFilters}>
              Limpar filtros
            </Button>
          </div>

          {advancedOpen ? (
            <div className="clientes-advanced-grid">
              <Select value={state.segmento} onChange={(event) => setFilter("segmento", event.target.value)} aria-label="Segmento">
                <option value="all">Segmento: todos</option>
                {options.segmentos.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={state.subsegmento} onChange={(event) => setFilter("subsegmento", event.target.value)} aria-label="Subsegmento">
                <option value="all">Subsegmento: todos</option>
                {options.subsegmentos.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={state.celebridade} onChange={(event) => setFilter("celebridade", event.target.value)} aria-label="Celebridade">
                <option value="all">Celebridade: todas</option>
                {options.celebridades.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={state.praca} onChange={(event) => setFilter("praca", event.target.value)} aria-label="Praça">
                <option value="all">Praça: todas</option>
                {options.pracas.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Select value={state.classificacao} onChange={(event) => setFilter("classificacao", event.target.value)} aria-label="Classificação">
                <option value="all">Classificação: todas</option>
                {options.classificacoes.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
              <Input type="number" placeholder="Valor mínimo" value={state.valorMin} onChange={(event) => setFilter("valorMin", event.target.value)} />
              <Input type="number" placeholder="Valor máximo" value={state.valorMax} onChange={(event) => setFilter("valorMax", event.target.value)} />
              <Input type="number" placeholder="Dias mín. na etapa" value={state.diasMin} onChange={(event) => setFilter("diasMin", event.target.value)} />
              <Input type="number" placeholder="Dias máx. na etapa" value={state.diasMax} onChange={(event) => setFilter("diasMax", event.target.value)} />
              <label className="clientes-check">
                <input type="checkbox" checked={state.tarefaUrgente} onChange={(event) => setFilter("tarefaUrgente", event.target.checked)} />
                Com tarefa urgente
              </label>
              <label className="clientes-check">
                <input type="checkbox" checked={state.semResponsavel} onChange={(event) => setFilter("semResponsavel", event.target.checked)} />
                Sem responsável
              </label>
              <label className="clientes-check">
                <input type="checkbox" checked={state.comReuniao} onChange={(event) => setFilter("comReuniao", event.target.checked)} />
                Com reunião agendada
              </label>
            </div>
          ) : null}

          {activeFilterChips.length > 0 ? (
            <div className="clientes-filter-chips">
              {activeFilterChips.map((chip) => (
                <button key={`${chip.key}-${chip.label}`} type="button" onClick={() => clearFilter(chip.key)}>
                  {chip.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="panel-card clientes-table-card">
        <CardHeader>
          <CardTitle>Clientes</CardTitle>
          <p className="text-xs ds-text-muted">
            {rows.length} resultado{rows.length === 1 ? "" : "s"} · exibindo {startIndex}-{endIndex}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="clientes-empty">Nenhum cliente encontrado com os filtros atuais.</div>
          ) : (
            <Table className="clientes-table-wrap">
              <TableHeader>
                <TableRow>
                  {visibleColumnKeys.map((column) => (
                    <TableHead key={column} onClick={() => handleSort(column)} className={column === "valor" || column === "actions" ? "text-right" : ""}>
                      <span className="clientes-th-content">
                        {columnLabels[column]}
                        {sortIcon(column)}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map((row) => (
                  <TableRow key={row.id} className="clientes-table-row" onClick={() => setSelectedCliente(row)}>
                    {visibleColumnKeys.map((column) => (
                      <TableCell key={column} className={column === "valor" || column === "actions" ? "text-right" : ""}>
                        {renderCell(column, row, setSelectedCliente)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="clientes-pagination">
        <span>
          Página {page} de {pageCount} · {rows.length} itens
        </span>
        <div>
          <Button size="sm" type="button" variant="outline" onClick={() => setPage(page - 1)} disabled={page <= 1}>
            Anterior
          </Button>
          <Button size="sm" type="button" variant="outline" onClick={() => setPage(page + 1)} disabled={page >= pageCount}>
            Próxima
          </Button>
          <Select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))} className="w-32">
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / página
              </option>
            ))}
          </Select>
        </div>
      </div>

      <ClienteQuickDrawer cliente={selectedCliente} onClose={() => setSelectedCliente(null)} />
    </div>
  );
}
