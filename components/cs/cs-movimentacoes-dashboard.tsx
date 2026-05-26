"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, Loader2, MoveRight, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import type { PeriodPreset } from "@/lib/types";
import type { CsMovementStage, CsStageMovementData } from "@/lib/cs/movimentacoes";
import { usePaginatedTable } from "@/hooks/usePaginatedTable";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StageCombobox } from "@/components/cs/stage-combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CsMovementsPeriod = Exclude<PeriodPreset, "all" | "monthPick">;

type Props = {
  initialData: CsStageMovementData;
};

const periodOptions: Array<{ value: CsMovementsPeriod; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "month", label: "Mês atual" },
  { value: "lastMonth", label: "Mês anterior" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

const validPeriods = new Set(periodOptions.map((option) => option.value));

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDateTime(value: string | null) {
  if (!value) return "Não informado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return dateTimeFormatter.format(parsed);
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function getCurrentPeriod(searchParams: URLSearchParams): CsMovementsPeriod {
  const value = searchParams.get("period") as CsMovementsPeriod | null;
  return value && validPeriods.has(value) ? value : "month";
}

function StageChip({ stage }: { stage: CsMovementStage }) {
  return (
    <span className="cs-mov-stage-chip" style={{ ["--stage-color" as string]: stage.color } as CSSProperties}>
      {stage.name}
    </span>
  );
}

export function CsMovimentacoesDashboard({ initialData }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = getCurrentPeriod(searchParams);
  const fromValue = searchParams.get("from") ?? dateInputValue(initialData.range.from);
  const toValue = searchParams.get("to") ?? dateInputValue(initialData.range.to);
  const { pagedItems, page, pageSize, pageCount, startIndex, endIndex, pageSizeOptions, setPage, setPageSize } =
    usePaginatedTable(initialData.events, [15, 30, 60, 100]);

  const [isPending, startTransition] = useTransition();
  const [flowFromId, setFlowFromId] = useState<string>("all");
  const [flowToId, setFlowToId] = useState<string>("all");

  const flowFromStages = useMemo(() => {
    const map = new Map<string, CsMovementStage>();
    for (const flow of initialData.flows) map.set(flow.fromStage.id, flow.fromStage);
    return [...map.values()].sort((a, b) => a.order_index - b.order_index);
  }, [initialData.flows]);

  const flowToStages = useMemo(() => {
    const map = new Map<string, CsMovementStage>();
    for (const flow of initialData.flows) map.set(flow.toStage.id, flow.toStage);
    return [...map.values()].sort((a, b) => a.order_index - b.order_index);
  }, [initialData.flows]);

  const filteredFlows = useMemo(
    () =>
      initialData.flows.filter(
        (flow) =>
          (flowFromId === "all" || flow.fromStage.id === flowFromId) &&
          (flowToId === "all" || flow.toStage.id === flowToId),
      ),
    [initialData.flows, flowFromId, flowToId],
  );

  const maxFlowCount = Math.max(...filteredFlows.map((flow) => flow.count), 1);
  const hasFlowFilter = flowFromId !== "all" || flowToId !== "all";

  useEffect(() => {
    setPage(1);
  }, [initialData.events, setPage]);

  useEffect(() => {
    setFlowFromId("all");
    setFlowToId("all");
  }, [initialData.flows]);

  function updateParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const query = params.toString();
    startTransition(() => {
      router.push((query ? `${pathname}?${query}` : pathname) as Route);
    });
  }

  function changePeriod(value: CsMovementsPeriod) {
    updateParams({
      period: value,
      from: value === "custom" ? fromValue : null,
      to: value === "custom" ? toValue : null,
    });
  }

  return (
    <div className={cn("cs-mov-page", isPending && "is-pending")} aria-busy={isPending}>
      <header className="cs-mov-header">
        <div>
          <span className="cs-mov-eyebrow">Gestão CS</span>
          <h1>Movimentações de etapa</h1>
          <p>Clientes com mudança operacional de etapa no período selecionado.</p>
        </div>
        <div className={cn("cs-mov-period", isPending && "is-loading")} aria-busy={isPending}>
          <CalendarDays className="h-4 w-4" aria-hidden />
          <Select
            value={period}
            disabled={isPending}
            onChange={(event) => changePeriod(event.target.value as CsMovementsPeriod)}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {period === "custom" ? (
            <>
              <Input
                type="date"
                value={fromValue}
                disabled={isPending}
                onChange={(event) => updateParams({ period: "custom", from: event.target.value })}
                aria-label="Data inicial"
              />
              <Input
                type="date"
                value={toValue}
                disabled={isPending}
                onChange={(event) => updateParams({ period: "custom", to: event.target.value })}
                aria-label="Data final"
              />
            </>
          ) : null}
          {isPending ? (
            <span className="cs-mov-period-status" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Atualizando…
            </span>
          ) : null}
        </div>
      </header>

      <div className="kpi-grid">
        <KpiCard title="Movimentações" value={String(initialData.totalMovements)} subtitle={initialData.periodLabel} />
        <KpiCard title="Clientes únicos" value={String(initialData.uniqueClients)} subtitle="sem duplicar cliente no período" />
        <KpiCard title="Fluxo principal" value={initialData.topFlow ? String(initialData.topFlow.count) : "0"} subtitle={initialData.topFlow?.label ?? "sem dados"} />
        <KpiCard
          title="Maior saldo positivo"
          value={initialData.biggestPositiveBalance ? `+${initialData.biggestPositiveBalance.net}` : "0"}
          subtitle={initialData.biggestPositiveBalance?.stage.name ?? "sem etapa em alta"}
        />
      </div>

      <div className="cs-mov-grid">
        <Card className="panel-card cs-mov-flow-card">
          <CardHeader className="cs-mov-card-head">
            <div>
              <CardTitle>Fluxos mais frequentes</CardTitle>
              <p className="text-xs ds-text-muted">Ranking de origem e destino no período.</p>
            </div>
            <MoveRight className="h-4 w-4 ds-text-muted" aria-hidden />
          </CardHeader>
          <CardContent className="cs-mov-flow-content">
            <div className="cs-mov-flow-filters" role="group" aria-label="Filtrar fluxos por etapa">
              <StageCombobox
                label="De"
                value={flowFromId}
                stages={flowFromStages}
                placeholder="Buscar etapa de origem…"
                onChange={setFlowFromId}
              />
              <StageCombobox
                label="Para"
                value={flowToId}
                stages={flowToStages}
                placeholder="Buscar etapa de destino…"
                onChange={setFlowToId}
              />
              {hasFlowFilter ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="cs-mov-flow-filters-clear"
                  onClick={() => {
                    setFlowFromId("all");
                    setFlowToId("all");
                  }}
                >
                  Limpar
                </Button>
              ) : null}
            </div>

            {initialData.flows.length === 0 ? (
              <p className="cs-mov-empty">Nenhuma mudança de etapa encontrada.</p>
            ) : filteredFlows.length === 0 ? (
              <p className="cs-mov-empty">Nenhum fluxo combina com o filtro selecionado.</p>
            ) : (
              <div className="cs-mov-flow-list">
                {filteredFlows.map((flow) => (
                  <article key={flow.key} className="cs-mov-flow-row">
                    <div className="cs-mov-flow-main">
                      <div className="cs-mov-flow-route">
                        <StageChip stage={flow.fromStage} />
                        <ArrowRight className="h-3.5 w-3.5 ds-text-muted" aria-hidden />
                        <StageChip stage={flow.toStage} />
                      </div>
                      <div className="cs-mov-flow-bar" aria-hidden>
                        <span style={{ width: `${Math.max((flow.count / maxFlowCount) * 100, 4)}%` }} />
                      </div>
                    </div>
                    <div className="cs-mov-flow-metric">
                      <strong>{flow.count}</strong>
                      <span>{flow.uniqueClients} clientes · {formatPercent(flow.percentage)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="panel-card">
          <CardHeader className="cs-mov-card-head">
            <div>
              <CardTitle>Saldo por etapa</CardTitle>
              <p className="text-xs ds-text-muted">Entradas menos saídas no período.</p>
            </div>
            <TrendingUp className="h-4 w-4 ds-text-muted" aria-hidden />
          </CardHeader>
          <CardContent className="p-0">
            {initialData.balances.length === 0 ? (
              <p className="cs-mov-empty cs-mov-empty-padded">Sem saldo para exibir.</p>
            ) : (
              <Table className="cs-mov-balance-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {initialData.balances.map((balance) => (
                    <TableRow key={balance.stage.id}>
                      <TableCell>
                        <StageChip stage={balance.stage} />
                      </TableCell>
                      <TableCell className="text-right">{balance.entries}</TableCell>
                      <TableCell className="text-right">{balance.exits}</TableCell>
                      <TableCell className={`text-right cs-mov-net ${balance.net > 0 ? "is-positive" : balance.net < 0 ? "is-negative" : ""}`}>
                        {balance.net > 0 ? `+${balance.net}` : balance.net}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="panel-card">
        <CardHeader className="cs-mov-card-head">
          <div>
            <CardTitle>Eventos de movimentação</CardTitle>
            <p className="text-xs ds-text-muted">
              {initialData.events.length} eventos · exibindo {startIndex}-{endIndex}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {initialData.events.length === 0 ? (
            <p className="cs-mov-empty cs-mov-empty-padded">Nenhum evento encontrado para este período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Alterado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{formatDateTime(event.createdAt)}</TableCell>
                    <TableCell>
                      {event.clienteId ? (
                        <Link className="cs-mov-client-link" href={`/clientes/${event.clienteId}`}>
                          {event.clienteNome}
                          {event.clienteCode ? <span>{event.clienteCode}</span> : null}
                        </Link>
                      ) : (
                        event.clienteNome
                      )}
                    </TableCell>
                    <TableCell>
                      <StageChip stage={event.fromStage} />
                    </TableCell>
                    <TableCell>
                      <StageChip stage={event.toStage} />
                    </TableCell>
                    <TableCell>{event.changedByName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {initialData.events.length > 0 ? (
        <div className="cs-mov-pagination">
          <span>
            Página {page} de {pageCount}
          </span>
          <div>
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
      ) : null}
    </div>
  );
}
