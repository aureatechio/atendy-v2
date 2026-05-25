"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  Columns3,
  ExternalLink,
  List,
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
import { ClientesKanbanView } from "@/components/cliente/clientes-kanban-view";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { changeStage } from "@/app/(protected)/clientes/[id]/actions";
import { useClientesFilters, clientesPeriodFieldOptions, clientesPeriodPresets } from "@/hooks/useClientesFilters";
import { usePaginatedTable } from "@/hooks/usePaginatedTable";
import { buildWhatsappHref, formatNullableDate, parseClienteDate } from "@/lib/clientes/format";
import { currencyFormatter } from "@/lib/utils";
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
const VIEW_STORAGE_KEY = "atendy:clientes:view";

type ClientesViewMode = "list" | "kanban";

type StageOverride = {
  stageId: string;
  stageEnteredAt: string;
};

function fmtDays(value: number | null) {
  if (value === null) return "—";
  if (value === 0) return "hoje";
  return `${value}d`;
}

function prazoVariant(value: string | null) {
  const date = parseClienteDate(value);
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
  if (column === "prazo") return <Badge variant={prazoVariant(row.prazoFinal)}>{formatNullableDate(row.prazoFinal)}</Badge>;
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

  const wa = buildWhatsappHref(row.whatsapp);
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

function getStoredViewMode(): ClientesViewMode {
  if (typeof window === "undefined") return "list";
  try {
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === "kanban" ? "kanban" : "list";
  } catch {
    return "list";
  }
}

export function ClientesDashboard({ initialData }: Props) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteListItem | null>(null);
  const [viewMode, setViewMode] = useState<ClientesViewMode>(() => getStoredViewMode());
  const [movingIds, setMovingIds] = useState<Set<string>>(() => new Set());
  const [stageOverrides, setStageOverrides] = useState<Record<string, StageOverride>>({});
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);

  const optimisticData = useMemo<ClientesData>(() => {
    const stageById = new Map(initialData.stages.map((stage) => [stage.id, stage]));
    const items = initialData.items.map((item) => {
      const override = stageOverrides[item.id];
      if (!override) return item;
      const stage = stageById.get(override.stageId);
      return {
        ...item,
        stageId: override.stageId,
        stageName: stage?.name ?? item.stageName,
        stageColor: stage?.color ?? item.stageColor,
        stageOrder: stage?.order_index ?? item.stageOrder,
        stageEnteredAt: override.stageEnteredAt,
        diasNaEtapa: 0,
        lastActivityAt: override.stageEnteredAt,
      };
    });
    return { ...initialData, items };
  }, [initialData, stageOverrides]);

  const { state, setFilter, options, rows, kpis, activeFilterChips, clearFilter, clearAllFilters } =
    useClientesFilters(optimisticData);
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
    window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
  }, [viewMode]);

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

  const moveCliente = async (clienteId: string, stageId: string) => {
    const current = optimisticData.items.find((item) => item.id === clienteId);
    if (!current || current.stageId === stageId) return;
    if (current.isArchived) {
      toast.error("Clientes arquivados não podem ser movidos no Kanban.");
      return;
    }

    const previous = stageOverrides[clienteId];
    const enteredAt = new Date().toISOString();
    setMovingIds((ids) => new Set(ids).add(clienteId));
    setStageOverrides((overrides) => ({ ...overrides, [clienteId]: { stageId, stageEnteredAt: enteredAt } }));

    const rollback = () => {
      setStageOverrides((overrides) => {
        const next = { ...overrides };
        if (previous) next[clienteId] = previous;
        else delete next[clienteId];
        return next;
      });
    };

    try {
      const result = await changeStage(clienteId, stageId);
      if (!result.ok) {
        rollback();
        toast.error(result.error ?? "Falha ao mover cliente.");
        return;
      }
      toast.success("Cliente movido de etapa.");
      router.refresh();
    } catch {
      rollback();
      toast.error("Falha ao mover cliente.");
    } finally {
      setMovingIds((ids) => {
        const next = new Set(ids);
        next.delete(clienteId);
        return next;
      });
    }
  };

  return (
    <div className="clientes-page">
      <div className="clientes-kpi-grid">
        <KpiTile icon={Users} label="Clientes filtrados" value={String(kpis.total)} />
        <KpiTile icon={CalendarClock} label="Prazo crítico" value={String(kpis.prazoCritico)} tone={kpis.prazoCritico > 0 ? "danger" : "default"} />
        <KpiTile icon={UserRoundX} label="Sem responsável" value={String(kpis.semResponsavel)} tone={kpis.semResponsavel > 0 ? "warning" : "default"} />
        <KpiTile icon={Wallet} label="Valor ativo" value={currencyFormatter.format(kpis.valorAtivo)} />
      </div>

      <div className="clientes-filter-bar">
        <div className="clientes-toolbar">
          <div className="clientes-search-input clientes-search-field">
            <Search className="h-4 w-4" />
            <Input
              ref={searchRef}
              placeholder="Buscar cliente, CNPJ, WhatsApp…  (⌘/Ctrl + K)"
              value={state.search}
              onChange={(event) => setFilter("search", event.target.value)}
              aria-label="Busca"
            />
          </div>

          <Select
            value={state.period}
            onChange={(event) => setFilter("period", event.target.value as typeof state.period)}
            aria-label="Período"
            className="clientes-toolbar-select"
          >
            {clientesPeriodPresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </Select>

          {state.period === "monthPick" ? (
            <Select
              value={String(state.monthIndex)}
              onChange={(event) => setFilter("monthIndex", Number(event.target.value))}
              aria-label="Mês"
              className="clientes-toolbar-select"
            >
              {monthOptions.map((label, idx) => (
                <option key={label} value={idx}>
                  {label} {currentYear}
                </option>
              ))}
            </Select>
          ) : null}

          {state.period === "custom" ? (
            <>
              <Input
                type="date"
                value={state.periodFrom}
                onChange={(event) => setFilter("periodFrom", event.target.value)}
                aria-label="De"
                className="clientes-toolbar-date"
              />
              <Input
                type="date"
                value={state.periodTo}
                onChange={(event) => setFilter("periodTo", event.target.value)}
                aria-label="Até"
                className="clientes-toolbar-date"
              />
            </>
          ) : null}

          <Select
            value={state.stageId}
            onChange={(event) => setFilter("stageId", event.target.value)}
            aria-label="Etapa"
            className="clientes-toolbar-select"
          >
            <option value="all">Etapa: todas</option>
            {options.stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </Select>

          <Select
            value={state.responsavelId}
            onChange={(event) => setFilter("responsavelId", event.target.value)}
            aria-label="Responsável"
            className="clientes-toolbar-select"
          >
            <option value="all">Responsável: todos</option>
            {options.responsaveis.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>

          <div className="clientes-view-toggle" role="group" aria-label="Alternar visualização de clientes">
            <button
              type="button"
              className={viewMode === "list" ? "is-active" : ""}
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              <List className="h-3.5 w-3.5" aria-hidden />
              Lista
            </button>
            <button
              type="button"
              className={viewMode === "kanban" ? "is-active" : ""}
              aria-pressed={viewMode === "kanban"}
              onClick={() => setViewMode("kanban")}
            >
              <Columns3 className="h-3.5 w-3.5" aria-hidden />
              Kanban
            </button>
          </div>

          <div className="clientes-toolbar-actions">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdvancedOpen((value) => !value)}
              aria-expanded={advancedOpen}
              aria-label="Filtros avançados"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="clientes-toolbar-label">Filtros</span>
              {activeFilterChips.length > 0 ? (
                <span className="clientes-chip-count">{activeFilterChips.length}</span>
              ) : null}
              <ChevronDown className={`h-3.5 w-3.5 ${advancedOpen ? "clientes-rotate" : ""}`} />
            </Button>
            <div className="relative">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setColumnsOpen((value) => !value)}
                aria-label="Colunas"
              >
                <Settings2 className="h-4 w-4" />
                <span className="clientes-toolbar-label">Colunas</span>
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
            {activeFilterChips.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>
                <X className="h-3.5 w-3.5" />
                <span className="clientes-toolbar-label">Limpar</span>
              </Button>
            ) : null}
          </div>
        </div>

        {advancedOpen ? (
          <div className="clientes-advanced-grid">
            <Select value={state.periodField} onChange={(event) => setFilter("periodField", event.target.value as ClientesPeriodField)} aria-label="Filtrar por data de">
              {clientesPeriodFieldOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Data: {option.label}
                </option>
              ))}
            </Select>
            <Select value={state.status} onChange={(event) => setFilter("status", event.target.value as typeof state.status)} aria-label="Status">
              <option value="active">Status: ativos</option>
              <option value="archived">Status: arquivados</option>
              <option value="all">Status: todos</option>
            </Select>
            <Select value={state.prazo} onChange={(event) => setFilter("prazo", event.target.value as typeof state.prazo)} aria-label="Prazo">
              <option value="all">Prazo: todos</option>
              <option value="overdue">Prazo: vencidos</option>
              <option value="today">Prazo: hoje</option>
              <option value="next7">Prazo: próximos 7 dias</option>
              <option value="none">Prazo: sem prazo</option>
            </Select>
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
      </div>

      {viewMode === "list" ? (
        <>
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
        </>
      ) : (
        <ClientesKanbanView
          rows={rows}
          stages={optimisticData.stages}
          movingIds={movingIds}
          onOpenCliente={setSelectedCliente}
          onMoveCliente={(clienteId, stageId) => {
            void moveCliente(clienteId, stageId);
          }}
        />
      )}

      <ClienteQuickDrawer cliente={selectedCliente} onClose={() => setSelectedCliente(null)} />
    </div>
  );
}
