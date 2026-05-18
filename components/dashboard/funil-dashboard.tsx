'use client';

import { useId, useMemo, type CSSProperties } from "react";
import { AlertTriangle, ArrowUpRight, Clock3 } from "lucide-react";
import { useFunilFilter } from "@/hooks/useFunilFilter";
import { computeFunilKpis, type StageSummary } from "@/lib/funil/computeMetrics";
import { parseDate } from "@/lib/utils";
import type { FunilData } from "@/lib/types";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Props {
  initialData: FunilData;
}

const periodOptions = [
  { value: "all", label: "Todo o período" },
  { value: "month", label: "Mês atual" },
  { value: "lastMonth", label: "Mês anterior" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

const FLOW_COL_WIDTH = 176;
const FLOW_SVG_HEIGHT = 180;
const MIN_FLOW_HEIGHT = 10;
const MAX_FLOW_HEIGHT = 84;

function isInsideRange(date: string, range: [Date | null, Date | null]) {
  const parsed = parseDate(date);
  if (!parsed) return true;
  const [from, to] = range;
  if (from && parsed < from) return false;
  if (to && parsed > to) return false;
  return true;
}

function stagePercent(current: number, total: number) {
  return total > 0 ? (current / total) * 100 : 0;
}

function formatPct(value: number) {
  if (value === 0) return "0%";
  const digits = value >= 1 ? 1 : 2;
  return `${value.toFixed(digits).replace(".", ",")}%`;
}

function formatDays(value: number) {
  return `${value.toFixed(1).replace(".", ",")}d`;
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })} M`;
  }

  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })} k`;
  }

  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function buildFlowPath(stages: StageSummary[], scaleMode: "sqrt" | "linear") {
  if (stages.length === 0) return "";

  const maxClientes = Math.max(...stages.map((stage) => stage.clientes), 1);
  const totalWidth = stages.length * FLOW_COL_WIDTH;
  const midY = FLOW_SVG_HEIGHT / 2;
  const maxFillH = MAX_FLOW_HEIGHT;
  const startX = -FLOW_COL_WIDTH / 2;
  const endX = totalWidth + FLOW_COL_WIDTH / 2;
  const heights = stages.map((stage) => {
    if (stage.clientes === 0) return MIN_FLOW_HEIGHT;
    const fraction =
      scaleMode === "linear" ? stage.clientes / maxClientes : Math.sqrt(stage.clientes / maxClientes);
    return Math.max(maxFillH * fraction, MIN_FLOW_HEIGHT);
  });

  const points = stages.map((_, index) => ({
    x: index * FLOW_COL_WIDTH + FLOW_COL_WIDTH / 2,
    topY: midY - heights[index] / 2,
    bottomY: midY + heights[index] / 2,
  }));

  let d = `M ${startX} ${points[0].topY} L ${points[0].x} ${points[0].topY}`;

  for (let index = 0; index < points.length - 1; index++) {
    const p0 = points[index];
    const p1 = points[index + 1];
    const dx = (p1.x - p0.x) * 0.5;
    d += ` C ${p0.x + dx} ${p0.topY}, ${p1.x - dx} ${p1.topY}, ${p1.x} ${p1.topY}`;
  }

  d += ` L ${endX} ${points[points.length - 1].topY}`;
  d += ` L ${endX} ${points[points.length - 1].bottomY}`;

  for (let index = points.length - 1; index > 0; index--) {
    const p0 = points[index];
    const p1 = points[index - 1];
    const dx = (p0.x - p1.x) * 0.5;
    d += ` C ${p0.x - dx} ${p0.bottomY}, ${p1.x + dx} ${p1.bottomY}, ${p1.x} ${p1.bottomY}`;
  }

  return `${d} L ${startX} ${points[0].bottomY} Z`;
}

function FlowFunnel({ stages, scaleMode }: { stages: StageSummary[]; scaleMode: "sqrt" | "linear" }) {
  const gradientId = useId().replace(/:/g, "");
  const totalClients = useMemo(() => stages.reduce((sum, stage) => sum + stage.clientes, 0), [stages]);
  const totalWidth = Math.max(stages.length * FLOW_COL_WIDTH, 720);
  const path = useMemo(() => buildFlowPath(stages, scaleMode), [scaleMode, stages]);

  return (
    <div className="flow-funnel-scroll">
      <div
        className="flow-funnel"
        style={
          {
            width: totalWidth,
            "--flow-col-w": `${FLOW_COL_WIDTH}px`,
          } as CSSProperties
        }
      >
        <svg
          className="flow-svg"
          viewBox={`0 0 ${stages.length * FLOW_COL_WIDTH} ${FLOW_SVG_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
              <stop offset="48%" stopColor="var(--primary)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.26" />
            </linearGradient>
          </defs>
          <path d={path} fill={`url(#${gradientId})`} stroke="rgba(99, 102, 241, 0.24)" strokeWidth="1" />
          {stages.map((_, index) =>
            index > 0 ? (
              <line
                key={index}
                x1={index * FLOW_COL_WIDTH}
                y1="0"
                x2={index * FLOW_COL_WIDTH}
                y2={FLOW_SVG_HEIGHT}
                stroke="var(--border)"
                strokeWidth="1"
              />
            ) : null,
          )}
        </svg>

        {stages.map((stage, index) => {
          const pct = stagePercent(stage.clientes, totalClients);
          const pctLabel = formatPct(pct);
          const daysLabel = formatDays(stage.meanDays);
          const moneyLabel = formatCompactCurrency(stage.valor);
          const isDominant = pct >= 70;

          return (
            <article
              key={stage.slug}
              className={`flow-col ${isDominant ? "is-dominant" : ""}`}
              style={{ "--col-color": stage.color } as CSSProperties}
              aria-label={`${stage.name}: ${stage.clientes} clientes, ${pctLabel} do funil, ${stage.valorLabel}, ${daysLabel} na etapa`}
            >
              <div className="flow-col-top">
                <div className="flow-icon">{index + 1}</div>
                <h3 className="flow-stage-name">{stage.name}</h3>
              </div>

              <div className="flow-col-mid">
                <div className="flow-headline">
                  <div className={`flow-count-big ${stage.clientes === 0 ? "zero" : ""}`}>{stage.clientes}</div>
                  <div className="flow-count-label">
                    {stage.clientes === 1 ? "cliente nesta etapa" : "clientes nesta etapa"}
                  </div>
                  <div className={`flow-pct ${stage.clientes === 0 ? "zero" : ""}`}>
                    <span>{pctLabel}</span>
                    <small>do funil</small>
                  </div>
                </div>
              </div>

              <div className="flow-col-bot">
                <div>
                  <div className={`flow-money ${stage.valor === 0 ? "zero" : ""}`}>{moneyLabel}</div>
                  <div className="flow-money-label">em vendas</div>
                </div>

                <div className="flow-time">
                  <Clock3 className="flow-time-icon" />
                  {daysLabel} na etapa
                </div>

                {stage.bottleneck ? (
                  <div className="flow-bottleneck">
                    <AlertTriangle className="h-4 w-4" />
                    Gargalo
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function FunilDashboard({ initialData }: Props) {
  const { state, setFilter, periodRange } = useFunilFilter();
  const filteredRows = useMemo(
    () => initialData.rows.filter((row) => isInsideRange(row.a, periodRange)),
    [initialData.rows, periodRange],
  );

  const { kpis, stageSummary } = useMemo(
    () => computeFunilKpis(initialData, filteredRows),
    [initialData, filteredRows],
  );
  const visibleStageSummary = useMemo(() => stageSummary.filter((stage) => !stage.is_final), [stageSummary]);
  const totalOcupacao = useMemo(
    () => visibleStageSummary.reduce((sum, item) => sum + item.clientes, 0),
    [visibleStageSummary],
  );

  return (
    <div className="space-y-4">
      <div className="kpi-grid">
        <KpiCard title="Clientes no funil" value={String(kpis.clientesUnicos)} />
        <KpiCard title="Valor no funil" value={kpis.valorTotalLabel} />
        <KpiCard title="Finalizados" value={String(kpis.finalizados)} />
        <KpiCard title="Lead time médio" value={kpis.leadTimeLabel} />
      </div>

      <Card className="panel-card">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Visão lateral do funil</CardTitle>
            <p className="mt-1 text-xs ds-text-muted">{filteredRows.length} ocupações no período selecionado.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={state.period}
              onChange={(event) =>
                setFilter(
                  "period",
                  event.target.value as "all" | "month" | "lastMonth" | "year" | "custom",
                )
              }
            >
              {periodOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            {state.period === "custom" && (
              <>
                <Input
                  aria-label="Data inicial"
                  type="date"
                  value={state.periodFrom}
                  onChange={(event) => setFilter("periodFrom", event.target.value)}
                />
                <Input
                  aria-label="Data final"
                  type="date"
                  value={state.periodTo}
                  onChange={(event) => setFilter("periodTo", event.target.value)}
                />
              </>
            )}
            <Button
              type="button"
              variant={state.scale === "sqrt" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("scale", "sqrt")}
            >
              Visual
            </Button>
            <Button
              type="button"
              variant={state.scale === "linear" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("scale", "linear")}
            >
              Real
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <FlowFunnel stages={visibleStageSummary} scaleMode={state.scale} />
        </CardContent>
      </Card>

      <Card className="panel-card">
        <CardHeader>
          <CardTitle>Detalhamento por etapa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleStageSummary.length === 0 ? (
            <p className="text-sm ds-text-muted">Sem dados para o período selecionado.</p>
          ) : (
            <div className="grid gap-3">
              {visibleStageSummary.map((stage) => {
                const pct = stagePercent(stage.clientes, totalOcupacao);
                const pctStyle = `${pct.toFixed(2)}%`;
                return (
                  <div key={stage.slug} className="ds-stage-card">
                    <div className="mb-2 flex items-center justify-between text-xs ds-text-subtle">
                      <p className="font-medium ds-text">{stage.name}</p>
                      <p>{stage.clientes} clientes ativos</p>
                    </div>
                    <div className="ds-progress-track ds-progress-track-sm">
                      <div className="ds-progress-fill" style={{ width: pctStyle, backgroundColor: stage.color }} />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] ds-text-muted sm:grid-cols-2 lg:grid-cols-4">
                      <span>Valor: {stage.valorLabel}</span>
                      <span>Share: {formatPct(pct)}</span>
                      <span>Tempo: {formatDays(stage.meanDays)} na etapa</span>
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpRight className="h-3 w-3" /> {stage.is_final ? "Final" : "Em andamento"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
