'use client';

import { Download, Settings2, ArrowUpDown, Filter, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useComprasFilters, periodPresets } from "@/hooks/useComprasFilters";
import { usePaginatedTable } from "@/hooks/usePaginatedTable";
import { computeComprasKpis } from "@/lib/compras/computeMetrics";
import { currencyFormatter, formatDate } from "@/lib/utils";
import type { Compra, CompraColumnKey } from "@/lib/types";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SortKey = CompraColumnKey;

interface Props {
  initialData: Compra[];
}

const COLUMN_DEFS: Array<{
  key: CompraColumnKey;
  label: string;
  align?: "left" | "center" | "right";
  render: (row: Compra) => React.ReactNode;
}> = [
  {
    key: "dataCompra",
    label: "Data",
    render: (row) => formatDate(row.dataCompra),
  },
  { key: "numProposta", label: "Nº", render: (row) => row.numProposta },
  { key: "cliente", label: "Cliente", render: (row) => row.cliente },
  { key: "vendedor", label: "Vendedor", render: (row) => row.vendedor },
  { key: "celebridade", label: "Celebridade", render: (row) => row.celebridade },
  { key: "segmento", label: "Segmento", render: (row) => row.segmento },
  { key: "tipoVenda", label: "Tipo", render: (row) => row.tipoVenda },
  { key: "statusPagamento", label: "Pagamento", render: (row) => row.statusPagamento },
  { key: "clickSignStatus", label: "Contrato", render: (row) => row.clickSignStatus ?? "-" },
  { key: "statusProducao", label: "Produção", render: (row) => row.statusProducao },
  { key: "atendyStageName", label: "Etapa Atendy", render: (row) => row.atendyStageName },
  {
    key: "atendySynced",
    label: "Sync",
    align: "center",
    render: (row) => {
      if (row.atendySynced === true) return <Badge variant="success">Sincronizado</Badge>;
      if (row.atendySynced === false) return <Badge variant="warning">Pendente</Badge>;
      return <Badge>Não informado</Badge>;
    },
  },
  { key: "cidade", label: "Local", render: (row) => row.cidade || "-" },
  { key: "prazo", label: "Prazo", render: (row) => row.prazo },
  {
    key: "valorTotalCompra",
    label: "Valor",
    align: "right",
    render: (row) => currencyFormatter.format(Number(row.valorTotalCompra ?? 0)),
  },
  {
    key: "linkPdf",
    label: "PDF",
    align: "center",
    render: (row) =>
      row.linkPdf ? (
        <a
          className="ds-link-action"
          href={row.linkPdf}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir
        </a>
      ) : (
        "-"
      ),
  },
];

const baseVisibleState = COLUMN_DEFS.reduce(
  (acc, col) => ({ ...acc, [col.key]: true }),
  {} as Record<CompraColumnKey, boolean>,
);

const syncOptions = [
  { label: "Todos", value: "all" },
  { label: "Sincronizado", value: "true" },
  { label: "Não sincronizado", value: "false" },
];

function exportCsvBlob(rows: Compra[], columns: Record<CompraColumnKey, boolean>) {
  const visible = COLUMN_DEFS.filter((col) => columns[col.key]);
  const header = visible.map((col) => JSON.stringify(col.label)).join(",");
  const body = rows
    .map((row) =>
      visible
        .map((col) => {
          const value = row[col.key];
          if (value === undefined || value === null) return "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  const content = `${header}\n${body}\n`;
  return new Blob([content], { type: "text/csv;charset=utf-8;" });
}

function renderStatusBadge(value: string | undefined) {
  if (!value) return <span className="ds-text-muted">-</span>;
  return <Badge variant={value === "Concluido" ? "success" : value === "Cancelado" ? "danger" : "default"}>{value}</Badge>;
}

export function ComprasDashboard({ initialData }: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [openPopover, setOpenPopover] = useState(false);
  const [openFilters, setOpenFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(baseVisibleState);

  const { state, setFilter, options, rows, filteredCount } = useComprasFilters(initialData);
  const sortKey: SortKey = state.sortKey;
  const sortDir = state.sortDir;
  const { pagedItems, page, pageSize, pageCount, startIndex, endIndex, pageSizeOptions, setPage, setPageSize } =
    usePaginatedTable(rows);

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [rows, setPage]);

  const kpis = useMemo(() => computeComprasKpis(rows), [rows]);

  const visibleColumnsKeys = useMemo(() => COLUMN_DEFS.filter((col) => visibleColumns[col.key]), [visibleColumns]);

  const activeFilterCount =
    (state.tipoVenda !== "all" ? 1 : 0) +
    (state.statusPagamento !== "all" ? 1 : 0) +
    (state.vendedor !== "all" ? 1 : 0) +
    (state.celebridade !== "all" ? 1 : 0) +
    (state.segmento !== "all" ? 1 : 0) +
    (state.etapa !== "all" ? 1 : 0) +
    (state.sync !== "all" ? 1 : 0);

  const clearAdvancedFilters = () => {
    setFilter("tipoVenda", "all");
    setFilter("statusPagamento", "all");
    setFilter("vendedor", "all");
    setFilter("celebridade", "all");
    setFilter("segmento", "all");
    setFilter("etapa", "all");
    setFilter("sync", "all");
  };

  const handleSort = (key: SortKey) => {
    const next = key !== sortKey ? "asc" : sortDir === "asc" ? "desc" : sortDir === "desc" ? "none" : "asc";
    setFilter("sortDir", next);
    setFilter("sortKey", key);
  };

  const onExport = () => {
    if (rows.length === 0) return;
    const blob = exportCsvBlob(rows, visibleColumns);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compras.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortIcon = (key: SortKey) =>
    sortKey === key && sortDir !== "none" ? (sortDir === "asc" ? "▲" : "▼") : <ArrowUpDown className="h-3.5 w-3.5 ds-text-muted" />;

  return (
    <div className="space-y-4">
      <div className="kpi-grid">
        <KpiCard title="Compras" value={String(rows.length)} subtitle={`${initialData.length} no total`} />
        <KpiCard title="Valor total" value={kpis.totalValorLabel} />
        <KpiCard title="Ticket médio" value={kpis.valorMedioLabel} />
        <KpiCard title="Sync Atendy" value={`${kpis.syncCount}`} subtitle="registros sincronizados" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 ds-text-muted" />
          <Input
            ref={searchRef}
            className="pl-8"
            placeholder="Buscar cliente, email, proposta… (Cmd/Ctrl + K)"
            value={state.search}
            onChange={(event) => setFilter("search", event.target.value)}
          />
        </div>
        <div className="w-[180px]">
          <Select
            value={state.period}
            onChange={(event) =>
              setFilter("period", event.target.value as "all" | "month" | "lastMonth" | "year" | "custom")
            }
          >
            {periodPresets.map((preset) => (
              <option key={preset.value} value={preset.value}>
                {preset.label}
              </option>
            ))}
          </Select>
        </div>
        {state.period === "custom" && (
          <>
            <div className="w-[150px]">
              <Input
                type="date"
                value={state.periodFrom}
                onChange={(event) => setFilter("periodFrom", event.target.value)}
              />
            </div>
            <div className="w-[150px]">
              <Input
                type="date"
                value={state.periodTo}
                onChange={(event) => setFilter("periodTo", event.target.value)}
              />
            </div>
          </>
        )}
        <div className="relative">
          <Button type="button" variant="secondary" onClick={() => setOpenFilters((value) => !value)}>
            <Filter className="h-4 w-4" /> Filtros
            {activeFilterCount > 0 ? (
              <Badge variant="default" className="ml-1">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
          {openFilters ? (
            <div className="ds-popover-content w-72 space-y-2">
              <div>
                <label className="label">Tipo</label>
                <Select value={state.tipoVenda} onChange={(event) => setFilter("tipoVenda", event.target.value)}>
                  <option value="all">Todos</option>
                  {options.tipos.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="label">Pagamento</label>
                <Select value={state.statusPagamento} onChange={(event) => setFilter("statusPagamento", event.target.value)}>
                  <option value="all">Todos</option>
                  {options.statusPagamento.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Vendedor</label>
                <Select value={state.vendedor} onChange={(event) => setFilter("vendedor", event.target.value)}>
                  <option value="all">Todos</option>
                  {options.vendedores.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Celebridade</label>
                <Select value={state.celebridade} onChange={(event) => setFilter("celebridade", event.target.value)}>
                  <option value="all">Todas</option>
                  {options.celebridades.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Segmento</label>
                <Select value={state.segmento} onChange={(event) => setFilter("segmento", event.target.value)}>
                  <option value="all">Todos</option>
                  {options.segmentos.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Etapa Atendy</label>
                <Select value={state.etapa} onChange={(event) => setFilter("etapa", event.target.value)}>
                  <option value="all">Todas</option>
                  {options.etapas.map((item) => <option key={item} value={item}>{item}</option>)}
                </Select>
              </div>
              <div>
                <label className="label">Sync</label>
                <Select value={state.sync} onChange={(event) => setFilter("sync", event.target.value)}>
                  {syncOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </Select>
              </div>
              {activeFilterCount > 0 ? (
                <Button className="mt-1 w-full" variant="outline" type="button" onClick={clearAdvancedFilters}>
                  <X className="h-4 w-4" /> Limpar filtros
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="relative">
          <Button type="button" variant="secondary" onClick={() => setOpenPopover((value) => !value)}>
            <Settings2 className="h-4 w-4" /> Colunas
          </Button>
          {openPopover ? (
            <div className="ds-popover-content">
              {COLUMN_DEFS.map((col) => (
                <label key={col.key} className="mb-2 block cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="mr-2 ds-check"
                    checked={visibleColumns[col.key]}
                    onChange={(event) => setVisibleColumns((prev) => ({ ...prev, [col.key]: event.target.checked }))}
                  />
                  {col.label}
                </label>
              ))}
              <Button className="mt-2 w-full" variant="outline" type="button" onClick={() => setVisibleColumns(baseVisibleState)}>
                Restaurar
              </Button>
            </div>
          ) : null}
        </div>
        <Button variant="outline" type="button" onClick={onExport}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card className="panel-card">
        <CardHeader>
          <CardTitle>Compras</CardTitle>
          <p className="text-xs ds-text-muted">
            {filteredCount} resultados • exibindo {startIndex}-{endIndex}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-4 text-sm ds-text-muted">Nenhuma compra encontrada.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumnsKeys.map((column) => (
                    <TableHead
                      key={column.key}
                      className={column.align === "right" ? "text-right" : "text-left"}
                      onClick={() => handleSort(column.key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {column.label}
                        {sortIcon(column.key)}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map((row, index) => (
                  <TableRow key={`${row.compraId ?? row.numProposta}-${row.dataCompra}-${index}`}>
                    {visibleColumnsKeys.map((column) => {
                      const align =
                        column.align === "right"
                          ? "text-right"
                          : column.align === "center"
                            ? "text-center"
                            : "text-left";
                      return (
                        <TableCell className={align} key={column.key}>
                          {column.key === "statusPagamento" ? renderStatusBadge(row.statusPagamento) : column.render(row)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs ds-text-muted">
          Página {page} de {pageCount} • {rows.length} itens
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" type="button" variant="outline" onClick={() => setPage(page - 1)} disabled={page <= 1}>
            Anterior
          </Button>
          <Button size="sm" type="button" variant="outline" onClick={() => setPage(page + 1)} disabled={page >= pageCount}>
            Próxima
          </Button>
          <Select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))} className="w-28">
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / página
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}
