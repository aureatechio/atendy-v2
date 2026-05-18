'use client';

import { useId, useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flame,
  Gauge,
  Sparkles,
  Target,
  Timer,
  TimerReset,
  TrendingDown,
  Users,
  Wallet,
} from "lucide-react";
import { useFunilFilter } from "@/hooks/useFunilFilter";
import { computeFunilKpis, type StageSummary } from "@/lib/funil/computeMetrics";
import { parseDate } from "@/lib/utils";
import type { FunilData } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { FunilStageDrawer } from "@/components/dashboard/funil-stage-drawer";

interface Props {
  initialData: FunilData;
}

const periodOptions = [
  { value: "all", label: "Todo o período" },
  { value: "month", label: "Mês atual" },
  { value: "lastMonth", label: "Mês anterior" },
  { value: "monthPick", label: "Mês" },
  { value: "year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

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

function isInsideRange(date: string, range: [Date | null, Date | null]) {
  const parsed = parseDate(date);
  if (!parsed) return true;
  const [from, to] = range;
  if (from && parsed < from) return false;
  if (to && parsed > to) return false;
  return true;
}

function formatPct(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0%";
  const d = value >= 10 ? 0 : digits;
  return `${value.toFixed(d).replace(".", ",")}%`;
}

function formatDays(value: number) {
  return `${value.toFixed(1).replace(".", ",")}d`;
}

function formatSlaTarget(amount: number | null, unit: "business_days" | "business_hours" | "calendar_hours") {
  if (amount === null || amount === undefined) return null;
  const unitLabel =
    unit === "business_days" ? (amount === 1 ? "dia útil" : "dias úteis")
    : unit === "business_hours" ? (amount === 1 ? "hora útil" : "horas úteis")
    : amount === 1 ? "hora" : "horas";
  return `${amount} ${unitLabel}`;
}

function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} M`;
  }
  if (abs >= 1_000) {
    return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} k`;
  }
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(99,102,241,${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "info" | "success" | "warning";
}

function KpiTile({ label, value, hint, icon: Icon, tone }: KpiTileProps) {
  return (
    <div className={`fv2-kpi fv2-kpi--${tone}`}>
      <div className="fv2-kpi-accent" aria-hidden />
      <div className="fv2-kpi-head">
        <span className="fv2-kpi-icon">
          <Icon className="h-4 w-4" />
        </span>
        <span className="fv2-kpi-label">{label}</span>
      </div>
      <p className="fv2-kpi-value">{value}</p>
      {hint ? <p className="fv2-kpi-hint">{hint}</p> : null}
    </div>
  );
}

function ConversionRibbon({
  stages,
  maxClients,
}: {
  stages: StageSummary[];
  maxClients: number;
}) {
  const gradientId = useId().replace(/:/g, "");
  if (stages.length === 0 || maxClients === 0) return null;

  const W = 100;
  const H = 36;
  const step = W / stages.length;
  const points = stages.map((stage, i) => {
    const ratio = stage.clientes / maxClients;
    const h = Math.max(2, ratio * (H - 6));
    return {
      x: i * step + step / 2,
      topY: (H - h) / 2,
      botY: (H + h) / 2,
    };
  });

  let d = `M 0 ${points[0].topY}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const dx = (p1.x - p0.x) * 0.5;
    d += ` C ${p0.x + dx} ${p0.topY}, ${p1.x - dx} ${p1.topY}, ${p1.x} ${p1.topY}`;
  }
  d += ` L ${W} ${points[points.length - 1].topY} L ${W} ${points[points.length - 1].botY}`;
  for (let i = points.length - 1; i > 0; i--) {
    const p0 = points[i];
    const p1 = points[i - 1];
    const dx = (p0.x - p1.x) * 0.5;
    d += ` C ${p0.x - dx} ${p0.botY}, ${p1.x + dx} ${p1.botY}, ${p1.x} ${p1.botY}`;
  }
  d += ` L 0 ${points[0].botY} Z`;

  return (
    <svg
      className="fv2-ribbon-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${gradientId})`} />
    </svg>
  );
}

interface PipelineProps {
  stages: StageSummary[];
  onSelectStage?: (stage: StageSummary) => void;
}

function Pipeline({ stages, onSelectStage }: PipelineProps) {
  const maxClients = useMemo(
    () => Math.max(...stages.map((s) => s.clientes), 1),
    [stages],
  );
  const firstWithClients = stages.find((s) => s.clientes > 0);
  const lastWithClients = [...stages].reverse().find((s) => s.clientes > 0);
  const overallConversion =
    firstWithClients && lastWithClients && firstWithClients.clientes > 0
      ? (lastWithClients.clientes / firstWithClients.clientes) * 100
      : 0;

  return (
    <div className="fv2-pipeline">
      <div className="fv2-pipeline-summary">
        <div className="fv2-pipeline-summary-block">
          <span className="fv2-pipeline-summary-label">Conversão geral do pipeline</span>
          <span className="fv2-pipeline-summary-value">
            {firstWithClients && lastWithClients ? formatPct(overallConversion) : "—"}
          </span>
          <span className="fv2-pipeline-summary-hint">
            {firstWithClients && lastWithClients
              ? `${firstWithClients.clientes} → ${lastWithClients.clientes} clientes`
              : "sem dados no período"}
          </span>
        </div>
        <div className="fv2-pipeline-summary-ribbon">
          <ConversionRibbon stages={stages} maxClients={maxClients} />
        </div>
        <a
          href="/funil/v1"
          className="fv2-pipeline-summary-action"
          aria-label="Abrir visão detalhada do funil"
        >
          <span className="fv2-pipeline-summary-action-text">Ver funil detalhado</span>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      <div className="fv2-pipeline-track">
        <div className="fv2-pipeline-rail">
          {stages.map((stage, index) => {
            const next = stages[index + 1];
            const conversion =
              next && stage.clientes > 0 ? (next.clientes / stage.clientes) * 100 : null;
            const drop = conversion === null ? null : 100 - conversion;
            const heightRatio = Math.max(stage.clientes / maxClients, 0.04);
            const accentSoft = hexToRgba(stage.color, 0.12);
            const accentStrong = hexToRgba(stage.color, 0.85);
            const dropTone =
              drop === null
                ? "neutral"
                : drop >= 40
                  ? "danger"
                  : drop >= 20
                    ? "warning"
                    : "ok";

            return (
              <div key={stage.slug} className="fv2-stage-wrap">
                <article
                  className={`fv2-stage ${stage.bottleneck ? "is-bottleneck" : ""} ${onSelectStage ? "is-clickable" : ""}`}
                  style={
                    {
                      "--stage-color": stage.color,
                      "--stage-soft": accentSoft,
                      "--stage-strong": accentStrong,
                    } as CSSProperties
                  }
                  role={onSelectStage ? "button" : undefined}
                  tabIndex={onSelectStage ? 0 : undefined}
                  onClick={onSelectStage ? () => onSelectStage(stage) : undefined}
                  onKeyDown={
                    onSelectStage
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectStage(stage);
                          }
                        }
                      : undefined
                  }
                  aria-label={onSelectStage ? `Ver clientes em ${stage.name}` : undefined}
                >
                  <div className="fv2-stage-stripe" aria-hidden />
                  <header className="fv2-stage-head">
                    <span className="fv2-stage-num">{String(index + 1).padStart(2, "0")}</span>
                    <h3 className="fv2-stage-name" title={stage.name}>
                      {stage.name}
                    </h3>
                  </header>

                  <div className="fv2-stage-figure">
                    <div className="fv2-stage-count">{stage.clientes}</div>
                    <div className="fv2-stage-count-label">
                      {stage.clientes === 1 ? "cliente" : "clientes"}
                    </div>
                  </div>

                  <div className="fv2-stage-bar" aria-hidden>
                    <div
                      className="fv2-stage-bar-fill"
                      style={{
                        width: `${heightRatio * 100}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>

                  <dl className="fv2-stage-meta">
                    <div className="fv2-stage-meta-row">
                      <dt>
                        <Wallet className="h-3 w-3" /> Valor
                      </dt>
                      <dd>{formatCompactCurrency(stage.valor)}</dd>
                    </div>
                    <div className="fv2-stage-meta-row">
                      <dt>
                        <Clock3 className="h-3 w-3" /> Tempo médio
                      </dt>
                      <dd>{formatDays(stage.meanDays)}</dd>
                    </div>
                    <div className="fv2-stage-meta-row">
                      <dt>
                        <Activity className="h-3 w-3" /> Mediana
                      </dt>
                      <dd>{formatDays(stage.medianDays)}</dd>
                    </div>
                    {stage.slaAmount != null ? (
                      <div className="fv2-stage-meta-row">
                        <dt>
                          <Gauge className="h-3 w-3" /> Prazo
                        </dt>
                        <dd>{formatSlaTarget(stage.slaAmount, stage.slaUnit)}</dd>
                      </div>
                    ) : null}
                  </dl>

                  {stage.slaAmount != null && (stage.slaOverdue > 0 || stage.slaWarning > 0) ? (
                    <div className="fv2-stage-sla">
                      {stage.slaOverdue > 0 ? (
                        <span className="fv2-sla-pill fv2-sla-pill--overdue" title="Clientes acima do prazo">
                          <AlertTriangle className="h-3 w-3" />
                          {stage.slaOverdue} atrasado{stage.slaOverdue === 1 ? "" : "s"}
                        </span>
                      ) : null}
                      {stage.slaWarning > 0 ? (
                        <span className="fv2-sla-pill fv2-sla-pill--warning" title="Clientes próximos do prazo">
                          <TimerReset className="h-3 w-3" />
                          {stage.slaWarning} em alerta
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {stage.bottleneck ? (
                    <div className="fv2-stage-flag">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Gargalo identificado
                    </div>
                  ) : null}
                </article>

                {next ? (
                  <div className={`fv2-connector fv2-connector--${dropTone}`}>
                    <ChevronRight className="fv2-connector-arrow" />
                    <div className="fv2-connector-pill">
                      <span className="fv2-connector-pct">{formatPct(conversion ?? 0)}</span>
                      <span className="fv2-connector-label">
                        {drop !== null && drop > 0 ? (
                          <>
                            <ArrowDownRight className="h-3 w-3" /> -{formatPct(drop)}
                          </>
                        ) : (
                          "mantém"
                        )}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface Insight {
  tone: "danger" | "warning" | "info" | "success";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  meta: string;
}

function buildInsights(stages: StageSummary[]): Insight[] {
  const insights: Insight[] = [];

  const bottlenecks = stages
    .filter((s) => s.bottleneck)
    .sort((a, b) => b.meanDays - a.meanDays);

  if (bottlenecks.length > 0) {
    const top = bottlenecks[0];
    insights.push({
      tone: "danger",
      icon: Flame,
      title: `Maior gargalo: ${top.name}`,
      detail: `${top.clientes} clientes parados — tempo médio ${formatDays(top.meanDays)}`,
      meta: `máx ${formatDays(top.maxDays)}`,
    });
  }

  let biggestDrop: { from: StageSummary; to: StageSummary; drop: number } | null = null;
  for (let i = 0; i < stages.length - 1; i++) {
    const a = stages[i];
    const b = stages[i + 1];
    if (a.clientes <= 0) continue;
    const drop = 100 - (b.clientes / a.clientes) * 100;
    if (!biggestDrop || drop > biggestDrop.drop) {
      biggestDrop = { from: a, to: b, drop };
    }
  }
  if (biggestDrop && biggestDrop.drop > 0) {
    insights.push({
      tone: "warning",
      icon: TrendingDown,
      title: `Queda crítica: ${biggestDrop.from.name} → ${biggestDrop.to.name}`,
      detail: `${formatPct(biggestDrop.drop)} de drop-off entre etapas consecutivas`,
      meta: `${biggestDrop.from.clientes} → ${biggestDrop.to.clientes}`,
    });
  }

  const withClients = stages.filter((s) => s.clientes > 0);
  if (withClients.length > 0) {
    const fastest = [...withClients].sort((a, b) => a.meanDays - b.meanDays)[0];
    insights.push({
      tone: "success",
      icon: Sparkles,
      title: `Etapa mais ágil: ${fastest.name}`,
      detail: `${fastest.clientes} clientes — média de ${formatDays(fastest.meanDays)}`,
      meta: `mínimo ${formatDays(fastest.minDays)}`,
    });
  }

  const heaviest = [...stages].sort((a, b) => b.valor - a.valor)[0];
  if (heaviest && heaviest.valor > 0) {
    insights.push({
      tone: "info",
      icon: Target,
      title: `Mais valor concentrado: ${heaviest.name}`,
      detail: `${formatCompactCurrency(heaviest.valor)} em ${heaviest.clientes} clientes`,
      meta: "potencial de receita",
    });
  }

  return insights.slice(0, 4);
}

function InsightsPanel({ stages }: { stages: StageSummary[] }) {
  const insights = useMemo(() => buildInsights(stages), [stages]);

  if (insights.length === 0) {
    return (
      <div className="fv2-insights">
        <header className="fv2-insights-head">
          <h3>Insights automáticos</h3>
          <p>Análise de padrões do funil</p>
        </header>
        <p className="fv2-insights-empty">Sem dados suficientes para gerar insights.</p>
      </div>
    );
  }

  return (
    <div className="fv2-insights">
      <header className="fv2-insights-head">
        <h3>Insights automáticos</h3>
        <p>Análise de padrões do funil no período</p>
      </header>
      <ul className="fv2-insights-list">
        {insights.map((insight, i) => {
          const Icon = insight.icon;
          return (
            <li key={i} className={`fv2-insight fv2-insight--${insight.tone}`}>
              <span className="fv2-insight-icon">
                <Icon className="h-4 w-4" />
              </span>
              <div className="fv2-insight-body">
                <p className="fv2-insight-title">{insight.title}</p>
                <p className="fv2-insight-detail">{insight.detail}</p>
              </div>
              <span className="fv2-insight-meta">{insight.meta}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StageBreakdown({
  stages,
  onSelectStage,
}: {
  stages: StageSummary[];
  onSelectStage?: (stage: StageSummary) => void;
}) {
  const total = stages.reduce((sum, s) => sum + s.clientes, 0);

  if (stages.length === 0) {
    return (
      <div className="fv2-breakdown">
        <header className="fv2-breakdown-head">
          <h3>Detalhamento por etapa</h3>
        </header>
        <p className="fv2-insights-empty">Sem dados para o período selecionado.</p>
      </div>
    );
  }

  return (
    <div className="fv2-breakdown">
      <header className="fv2-breakdown-head">
        <h3>Detalhamento por etapa</h3>
        <p>Visão tabular comparativa</p>
      </header>
      <ul className="fv2-breakdown-list">
        {stages.map((stage) => {
          const share = total > 0 ? (stage.clientes / total) * 100 : 0;
          const clickable = Boolean(onSelectStage);
          return (
            <li
              key={stage.slug}
              className={`fv2-breakdown-row ${clickable ? "is-clickable" : ""}`}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onSelectStage?.(stage) : undefined}
              onKeyDown={
                clickable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectStage?.(stage);
                      }
                    }
                  : undefined
              }
              aria-label={clickable ? `Ver clientes em ${stage.name}` : undefined}
            >
              <div className="fv2-breakdown-row-head">
                <span
                  className="fv2-breakdown-dot"
                  style={{ backgroundColor: stage.color }}
                  aria-hidden
                />
                <span className="fv2-breakdown-name">{stage.name}</span>
                <span className="fv2-breakdown-count">{stage.clientes}</span>
              </div>
              <div className="fv2-breakdown-bar" aria-hidden>
                <div
                  className="fv2-breakdown-bar-fill"
                  style={{ width: `${share}%`, backgroundColor: stage.color }}
                />
              </div>
              <div className="fv2-breakdown-meta">
                <span>{formatPct(share)} do funil</span>
                <span>{formatCompactCurrency(stage.valor)}</span>
                <span>{formatDays(stage.meanDays)} médio</span>
                {stage.slaAmount != null && stage.slaOverdue > 0 ? (
                  <span className="fv2-sla-pill fv2-sla-pill--overdue">
                    <AlertTriangle className="h-3 w-3" /> {stage.slaOverdue} atrasado{stage.slaOverdue === 1 ? "" : "s"}
                  </span>
                ) : null}
                {stage.slaAmount != null && stage.slaWarning > 0 ? (
                  <span className="fv2-sla-pill fv2-sla-pill--warning">
                    <TimerReset className="h-3 w-3" /> {stage.slaWarning} em alerta
                  </span>
                ) : null}
                {stage.bottleneck ? (
                  <span className="fv2-breakdown-flag">
                    <AlertTriangle className="h-3 w-3" /> gargalo
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FunilDashboardV2({ initialData }: Props) {
  const { state, setFilter, periodRange } = useFunilFilter();
  const [selectedStage, setSelectedStage] = useState<StageSummary | null>(null);
  const filteredRows = useMemo(
    () => initialData.rows.filter((row) => isInsideRange(row.a, periodRange)),
    [initialData.rows, periodRange],
  );

  const { kpis, stageSummary } = useMemo(
    () => computeFunilKpis(initialData, filteredRows),
    [initialData, filteredRows],
  );
  const visibleStages = useMemo(
    () => stageSummary.filter((stage) => !stage.is_final),
    [stageSummary],
  );

  const currentStage = useMemo(() => {
    if (!selectedStage) return null;
    return visibleStages.find((s) => s.slug === selectedStage.slug) ?? null;
  }, [selectedStage, visibleStages]);

  const conversionHint = useMemo(() => {
    if (kpis.clientesUnicos === 0) return "sem clientes no período";
    const rate = (kpis.finalizados / kpis.clientesUnicos) * 100;
    return `${formatPct(rate)} convertidos`;
  }, [kpis]);

  const slaTotals = useMemo(
    () =>
      visibleStages.reduce(
        (acc, stage) => ({
          overdue: acc.overdue + stage.slaOverdue,
          warning: acc.warning + stage.slaWarning,
        }),
        { overdue: 0, warning: 0 },
      ),
    [visibleStages],
  );

  return (
    <div className="fv2-shell">
      <header className="fv2-header">
        <div className="fv2-header-title">
          <span className="fv2-header-eyebrow">
            <Activity className="h-3.5 w-3.5" /> Pipeline · ao vivo
          </span>
          <h1 className="fv2-header-headline">Funil de Produção</h1>
          <p className="fv2-header-sub">
            {filteredRows.length} ocupações registradas no período selecionado.
          </p>
        </div>
        <div className="fv2-header-controls">
          <Select
            value={state.period}
            onChange={(event) =>
              setFilter(
                "period",
                event.target.value as
                  | "all"
                  | "month"
                  | "lastMonth"
                  | "monthPick"
                  | "year"
                  | "custom",
              )
            }
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          {state.period === "monthPick" && (
            <Select
              aria-label="Selecionar mês"
              value={String(state.monthIndex)}
              onChange={(event) => setFilter("monthIndex", Number(event.target.value))}
            >
              {MONTH_LABELS.slice(0, new Date().getMonth() + 1).map((label, idx) => (
                <option key={idx} value={idx}>
                  {label}
                </option>
              ))}
            </Select>
          )}
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
        </div>
      </header>

      <div className="fv2-kpi-grid">
        <KpiTile
          tone="primary"
          icon={Users}
          label="Clientes no funil"
          value={String(kpis.clientesUnicos)}
          hint={conversionHint}
        />
        <KpiTile
          tone="info"
          icon={Wallet}
          label="Valor no funil"
          value={kpis.valorTotalLabel}
          hint="soma dedup. por cliente/lead"
        />
        <KpiTile
          tone="success"
          icon={CheckCircle2}
          label="Finalizados"
          value={String(kpis.finalizados)}
          hint={`${kpis.clientesUnicos > 0 ? formatPct((kpis.finalizados / kpis.clientesUnicos) * 100) : "0%"} do total`}
        />
        <KpiTile
          tone="warning"
          icon={Timer}
          label="Lead time médio"
          value={kpis.leadTimeLabel}
          hint="entrada → etapa atual"
        />
        <KpiTile
          tone={slaTotals.overdue > 0 ? "warning" : "info"}
          icon={Gauge}
          label="SLA"
          value={
            slaTotals.overdue + slaTotals.warning > 0
              ? `${slaTotals.overdue} atrasado${slaTotals.overdue === 1 ? "" : "s"}`
              : "no prazo"
          }
          hint={
            slaTotals.warning > 0
              ? `${slaTotals.warning} em alerta`
              : slaTotals.overdue > 0
                ? "fora do prazo definido"
                : "todos dentro do prazo"
          }
        />
      </div>

      <Card className="panel-card fv2-pipeline-card">
        <CardHeader className="fv2-pipeline-card-head">
          <div>
            <CardTitle>Pipeline de Produção</CardTitle>
            <p className="fv2-pipeline-card-sub">
              Conversão e tempo entre cada etapa do funil
            </p>
          </div>
          <span className="fv2-pipeline-card-chip">
            <ArrowRight className="h-3 w-3" /> {visibleStages.length} etapas ativas
          </span>
        </CardHeader>
        <CardContent className="fv2-pipeline-card-body">
          <Pipeline stages={visibleStages} onSelectStage={setSelectedStage} />
        </CardContent>
      </Card>

      <div className="fv2-grid">
        <InsightsPanel stages={visibleStages} />
        <StageBreakdown stages={visibleStages} onSelectStage={setSelectedStage} />
      </div>

      <FunilStageDrawer
        stage={currentStage}
        rows={filteredRows}
        clients={initialData.clients_map}
        onClose={() => setSelectedStage(null)}
      />
    </div>
  );
}
