"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Info,
  Layers,
  PieChart,
  Wallet,
  TrendingDown,
  Activity,
  TrendingUp,
  Users,
  Headphones,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listCandidates,
  type CandidateClient,
  type StageStats,
} from "@/app/(protected)/cs/forca-tarefa/list-candidates";
import { reassignBatch } from "@/app/(protected)/cs/forca-tarefa/actions";

type StageOption = {
  id: string;
  name: string;
  slug: string;
  color: string;
  order_index: number;
};

type AttendantRole = "attendant" | "producao" | "cs_head";

type AttendantOption = {
  id: string;
  full_name: string;
  role: AttendantRole;
};

const ROLE_META: Record<
  AttendantRole,
  { label: string; description: string; icon: React.ReactNode }
> = {
  producao: {
    label: "Produção",
    description: "Time de atendimento principal",
    icon: <Headphones width={16} height={16} />,
  },
  attendant: {
    label: "Atendentes",
    description: "Perfis dedicados de atendimento",
    icon: <Users width={16} height={16} />,
  },
  cs_head: {
    label: "Head de CS",
    description: "Liderança de Customer Success",
    icon: <Crown width={16} height={16} />,
  },
};

const ROLE_ORDER: AttendantRole[] = ["producao", "attendant", "cs_head"];

type Step = 1 | 2 | 3;

type SuccessState = {
  updated: number;
  operationId: string;
  distribution: Array<{ name: string; count: number }>;
};

const STEP_LABELS: Record<Step, string> = {
  1: "Selecionar lote",
  2: "Distribuir cotas",
  3: "Confirmar",
};

const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const decimalFmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const intFmt = new Intl.NumberFormat("pt-BR");

function formatMonthLabel(value: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return value;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const label = date.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildMonthOptions(): Array<{ value: string; label: string }> {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth();
  const options: Array<{ value: string; label: string }> = [];
  for (let m = 0; m <= currentMonth; m++) {
    const value = `${year}-${String(m + 1).padStart(2, "0")}`;
    options.push({ value, label: formatMonthLabel(value) });
  }
  return options.reverse();
}

export function ForcaTarefaPanel({
  stages,
  attendants,
}: {
  stages: StageOption[];
  attendants: AttendantOption[];
}) {
  const availableRoles = useMemo(() => {
    const present = new Set(attendants.map((a) => a.role));
    return ROLE_ORDER.filter((r) => present.has(r));
  }, [attendants]);

  const [step, setStep] = useState<Step>(1);
  const [stageId, setStageId] = useState<string>(stages[0]?.id ?? "");
  const [month, setMonth] = useState<string>("");
  const [candidates, setCandidates] = useState<CandidateClient[]>([]);
  const [stats, setStats] = useState<StageStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<AttendantRole | "">(
    availableRoles[0] ?? "",
  );

  const filteredAttendants = useMemo(
    () => (roleFilter ? attendants.filter((a) => a.role === roleFilter) : []),
    [attendants, roleFilter],
  );
  const [loadingCandidates, startLoadingCandidates] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const stageName = useMemo(() => stages.find((s) => s.id === stageId)?.name ?? "", [stages, stageId]);
  const selectedCount = selectedIds.size;
  const totalQuota = Object.values(quotas).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const quotaMatches = totalQuota === selectedCount && selectedCount > 0;
  const periodLabel = month ? formatMonthLabel(month) : "Todo o período";
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  useEffect(() => {
    if (!stageId) return;
    setError(null);
    startLoadingCandidates(async () => {
      const result = await listCandidates({ stageId, month: month || null });
      if (!result.ok) {
        setError(result.error ?? "Falha ao carregar candidatos.");
        setCandidates([]);
        setStats(null);
        return;
      }
      setCandidates(result.candidates ?? []);
      setStats(result.stats ?? null);
      setSelectedIds(new Set());
    });
  }, [stageId, month]);

  function toggleAll() {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  }

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function divideEqually() {
    if (selectedCount === 0 || filteredAttendants.length === 0) return;
    const k = filteredAttendants.length;
    const base = Math.floor(selectedCount / k);
    const remainder = selectedCount - base * k;
    const next: Record<string, number> = {};
    filteredAttendants.forEach((a, idx) => {
      next[a.id] = base + (idx < remainder ? 1 : 0);
    });
    setQuotas(next);
  }

  function handleRoleChange(role: AttendantRole) {
    if (role === roleFilter) return;
    setRoleFilter(role);
    setQuotas({});
  }

  function setQuota(attendantId: string, value: number) {
    setQuotas((current) => ({ ...current, [attendantId]: Math.max(0, Math.floor(Number(value) || 0)) }));
  }

  function buildAssignments() {
    const selected = candidates.filter((c) => selectedIds.has(c.id));
    const assignments: Array<{
      clienteId: string;
      toAssigneeId: string;
      fromAssigneeId: string | null;
      stageId: string | null;
    }> = [];
    let cursor = 0;
    for (const a of filteredAttendants) {
      const slots = quotas[a.id] ?? 0;
      for (let i = 0; i < slots && cursor < selected.length; i++) {
        const candidate = selected[cursor++];
        assignments.push({
          clienteId: candidate.id,
          toAssigneeId: a.id,
          fromAssigneeId: candidate.responsavelId,
          stageId: candidate.stageId,
        });
      }
    }
    return assignments;
  }

  function handleSubmit() {
    if (!quotaMatches) {
      setError("A soma das cotas precisa ser igual à quantidade de clientes selecionados.");
      return;
    }
    setError(null);
    const assignments = buildAssignments();
    startSubmit(async () => {
      const result = await reassignBatch({ assignments, reason });
      if (!result.ok) {
        setError(result.error ?? "Falha ao aplicar Força-Tarefa.");
        return;
      }
      const distribution = filteredAttendants
        .map((a) => ({ name: a.full_name, count: quotas[a.id] ?? 0 }))
        .filter((d) => d.count > 0);
      setSuccess({
        updated: result.updated ?? assignments.length,
        operationId: result.operationId ?? "",
        distribution,
      });
      setStep(1);
      setSelectedIds(new Set());
      setQuotas({});
      setReason("");
    });
  }

  function resetSuccess() {
    setSuccess(null);
  }

  const kpis: Array<{
    key: string;
    label: string;
    value: string;
    hint?: string;
    accent: "primary" | "info" | "success" | "warning" | "purple" | "danger";
    icon: React.ReactNode;
  }> = stats
    ? [
        {
          key: "total",
          label: "Clientes na etapa",
          value: intFmt.format(stats.totalInStage),
          accent: "primary",
          icon: <Layers width={16} height={16} />,
        },
        {
          key: "pct",
          label: "% do funil",
          value: `${decimalFmt.format(stats.pctFunil)}%`,
          hint: `Participação desta etapa no funil ativo no snapshot selecionado (${periodLabel}). Cálculo: clientes na etapa ÷ total de clientes em todas as etapas ativas do funil, ambos com o mesmo filtro de período (${intFmt.format(stats.totalInStage)} / ${intFmt.format(stats.totalFunil)}).`,
          accent: "info",
          icon: <PieChart width={16} height={16} />,
        },
        {
          key: "valor",
          label: "Valor em R$",
          value: currencyFmt.format(stats.valorTotal),
          accent: "success",
          icon: <Wallet width={16} height={16} />,
        },
        {
          key: "min",
          label: "Menor dias em espera",
          value: `${intFmt.format(Math.floor(stats.daysMin))}d`,
          accent: "purple",
          icon: <TrendingDown width={16} height={16} />,
        },
        {
          key: "avg",
          label: "Média de dias",
          value: `${decimalFmt.format(stats.daysAvg)}d`,
          accent: "warning",
          icon: <Activity width={16} height={16} />,
        },
        {
          key: "max",
          label: "Maior dias em espera",
          value: `${intFmt.format(Math.floor(stats.daysMax))}d`,
          accent: "danger",
          icon: <TrendingUp width={16} height={16} />,
        },
      ]
    : [];

  return (
    <div className="forca-tarefa">
      {success ? (
        <div className="forca-tarefa-success">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 width={18} height={18} />
            <strong>Força-Tarefa aplicada — {success.updated} cliente(s) reatribuído(s).</strong>
          </div>
          <div>
            Distribuição:{" "}
            {success.distribution.map((d, i) => (
              <span key={d.name}>
                {i > 0 ? ", " : ""}
                {d.name} ({d.count})
              </span>
            ))}
          </div>
          {success.operationId ? (
            <div style={{ fontSize: 11, opacity: 0.8 }}>operation_id: {success.operationId}</div>
          ) : null}
          <div>
            <Button size="sm" variant="ghost" onClick={resetSuccess}>
              Fazer outra Força-Tarefa
            </Button>
          </div>
        </div>
      ) : null}

      <div className="forca-tarefa-steps" role="tablist" aria-label="Passos da Força-Tarefa">
        {([1, 2, 3] as Step[]).map((n) => (
          <div key={n} className={`forca-tarefa-step ${step === n ? "is-active" : ""}`}>
            <span className="forca-tarefa-step-num">{n}</span>
            {STEP_LABELS[n]}
          </div>
        ))}
      </div>

      {error ? <div className="forca-tarefa-error">{error}</div> : null}

      <section
        className={`forca-tarefa-controls ${loadingCandidates ? "is-loading" : ""}`}
        aria-busy={loadingCandidates}
      >
        <div className="forca-tarefa-controls-head">
          <div>
            <h3>Filtros</h3>
            <p>Selecione a etapa e o período para calcular o lote de candidatos.</p>
          </div>
          {loadingCandidates ? (
            <span className="forca-tarefa-loading" role="status" aria-live="polite">
              <span className="forca-tarefa-spinner" aria-hidden />
              Atualizando…
            </span>
          ) : null}
        </div>

        <fieldset className="forca-tarefa-filters" disabled={loadingCandidates}>
          <label>
            <span className="forca-tarefa-label-row">Etapa do funil</span>
            <select
              className="ds-select forca-tarefa-select"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
            >
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="forca-tarefa-label-row">
              Período de ocupação
              <span
                className="forca-tarefa-kpi-tip"
                tabIndex={0}
                role="img"
                aria-label="Mesmo critério do Funil de Produção: considera a data de início da ocupação na etapa (production_tasks.started_at) ou, na ausência de task ativa, a data de entrada do cliente. Mostra apenas registros cuja data cai dentro do mês selecionado."
                title="Mesmo critério do Funil de Produção: considera a data de início da ocupação na etapa (production_tasks.started_at) ou, na ausência de task ativa, a data de entrada do cliente. Mostra apenas registros cuja data cai dentro do mês selecionado."
              >
                <Info width={12} height={12} />
              </span>
            </span>
            <select
              className="ds-select forca-tarefa-select"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              <option value="">Todo o período</option>
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>

        <div className="forca-tarefa-kpis" aria-busy={loadingCandidates}>
          {(loadingCandidates && !stats ? Array.from({ length: 6 }) : kpis).map((k, idx) => {
            const isSkeleton = loadingCandidates || !stats;
            const kpi = isSkeleton ? null : (k as (typeof kpis)[number]);
            const accent = kpi?.accent ?? "primary";
            return (
              <div
                key={kpi?.key ?? `sk-${idx}`}
                className={`forca-tarefa-kpi forca-tarefa-kpi-${accent} ${isSkeleton ? "is-skeleton" : ""}`}
              >
                <div className="forca-tarefa-kpi-icon">
                  {kpi?.icon ?? <span className="forca-tarefa-skel forca-tarefa-skel-icon" />}
                </div>
                <div className="forca-tarefa-kpi-body">
                  <div className="forca-tarefa-kpi-label">
                    {kpi ? (
                      <>
                        <span>{kpi.label}</span>
                        {kpi.hint ? (
                          <span
                            className="forca-tarefa-kpi-tip"
                            tabIndex={0}
                            role="img"
                            aria-label={kpi.hint}
                            title={kpi.hint}
                          >
                            <Info width={12} height={12} />
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <span className="forca-tarefa-skel forca-tarefa-skel-label" />
                    )}
                  </div>
                  <div className="forca-tarefa-kpi-value">
                    {kpi ? kpi.value : <span className="forca-tarefa-skel forca-tarefa-skel-value" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {!loadingCandidates && !stats ? (
          <div className="forca-tarefa-empty-hint">
            Selecione uma etapa para calcular os indicadores do lote.
          </div>
        ) : null}
      </section>

      {step === 1 ? (
        <section className="forca-tarefa-panel">
          <h3>1. Selecionar lote</h3>

          {candidates.length > 0 ? (
            <>
              <div className="forca-tarefa-candidates">
                <div className="forca-tarefa-candidate forca-tarefa-candidate-head">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos"
                    checked={selectedIds.size === candidates.length && candidates.length > 0}
                    onChange={toggleAll}
                  />
                  <span>Cliente</span>
                  <span style={{ textAlign: "right" }}>Dias parado</span>
                  <span>Responsável atual</span>
                </div>
                {candidates.map((c) => (
                  <label key={c.id} className="forca-tarefa-candidate">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleOne(c.id)}
                    />
                    <span>{c.nome}</span>
                    <span style={{ textAlign: "right" }}>{Math.floor(c.daysSinceStage)}d</span>
                    <span style={{ color: "var(--text-muted)" }}>{c.responsavelNome ?? "—"}</span>
                  </label>
                ))}
              </div>
              <div className="forca-tarefa-summary">
                <span>
                  Etapa: <strong>{stageName}</strong> · Candidatos: <strong>{candidates.length}</strong> ·
                  Selecionados: <strong>{selectedCount}</strong>
                </span>
                <div className="forca-tarefa-actions-right">
                  <Button
                    onClick={() => setStep(2)}
                    disabled={selectedCount === 0 || attendants.length === 0}
                    size="sm"
                  >
                    Próximo: distribuir →
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="forca-tarefa-candidate-empty">
              {loadingCandidates
                ? "Carregando candidatos..."
                : stageId
                ? "Nenhum cliente encontrado para os filtros atuais."
                : "Selecione uma etapa para ver os candidatos."}
            </div>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="forca-tarefa-panel">
          <h3>2. Distribuir cotas entre atendentes</h3>

          {attendants.length === 0 ? (
            <div className="forca-tarefa-error">
              Nenhuma atendente ativa encontrada. Cadastre em /admin/users.
            </div>
          ) : (
            <div className="forca-tarefa-role-picker">
              <div className="forca-tarefa-role-picker-label">
                <span>Perfil de destino</span>
                <span className="forca-tarefa-role-picker-hint">
                  Quem vai receber os clientes redistribuídos.
                </span>
              </div>
              <div className="forca-tarefa-role-options" role="radiogroup" aria-label="Perfil de destino">
                {availableRoles.map((role) => {
                  const meta = ROLE_META[role];
                  const count = attendants.filter((a) => a.role === role).length;
                  const active = roleFilter === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`forca-tarefa-role-option ${active ? "is-active" : ""}`}
                      onClick={() => handleRoleChange(role)}
                    >
                      <span className="forca-tarefa-role-option-icon">{meta.icon}</span>
                      <span className="forca-tarefa-role-option-body">
                        <span className="forca-tarefa-role-option-title">{meta.label}</span>
                        <span className="forca-tarefa-role-option-desc">{meta.description}</span>
                      </span>
                      <span className="forca-tarefa-role-option-badge">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {roleFilter && filteredAttendants.length === 0 ? (
            <div className="forca-tarefa-empty-hint">
              Nenhum perfil ativo encontrado para {ROLE_META[roleFilter].label}.
            </div>
          ) : null}

          {roleFilter && filteredAttendants.length > 0 ? (
            <>
              <div className="forca-tarefa-summary">
                <span>
                  Selecionados: <strong>{selectedCount}</strong> · Soma das cotas:{" "}
                  <strong>{totalQuota}</strong> · Destinatários:{" "}
                  <strong>{filteredAttendants.length}</strong>
                </span>
                <div className="forca-tarefa-actions-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuotas({})}
                    disabled={totalQuota === 0}
                  >
                    Zerar cotas
                  </Button>
                  <Button size="sm" variant="ghost" onClick={divideEqually}>
                    Dividir igualmente
                  </Button>
                </div>
              </div>

              <div className="forca-tarefa-assignees">
                {filteredAttendants.map((a) => (
                  <div key={a.id} className="forca-tarefa-assignee-row">
                    <span>{a.full_name}</span>
                    <input
                      type="number"
                      min={0}
                      value={quotas[a.id] ?? 0}
                      onChange={(e) => setQuota(a.id, Number(e.target.value))}
                    />
                  </div>
                ))}
              </div>

              <div className={`forca-tarefa-summary ${!quotaMatches ? "is-error" : ""}`}>
                <span>
                  {quotaMatches
                    ? "✓ Cotas batem com a seleção."
                    : `Faltam ${selectedCount - totalQuota} cliente(s) para a soma bater (${totalQuota}/${selectedCount}).`}
                </span>
                <div className="forca-tarefa-actions-right">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                    ← Voltar
                  </Button>
                  <Button size="sm" onClick={() => setStep(3)} disabled={!quotaMatches}>
                    Próximo: confirmar →
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {step === 3 ? (
        <section className="forca-tarefa-panel">
          <h3>3. Confirmar Força-Tarefa</h3>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Vou reatribuir <strong>{selectedCount}</strong> cliente(s) da etapa{" "}
            <strong>{stageName}</strong> para o perfil{" "}
            <strong>{roleFilter ? ROLE_META[roleFilter].label : "—"}</strong>:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {filteredAttendants
              .filter((a) => (quotas[a.id] ?? 0) > 0)
              .map((a) => (
                <li key={a.id}>
                  {a.full_name} — <strong>{quotas[a.id]}</strong>
                </li>
              ))}
          </ul>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>
              Motivo (opcional, vai para o histórico)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Recuperação de clientes parados em Negociação > 7 dias"
              style={{
                padding: "8px 10px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
              }}
            />
          </label>

          <div className="forca-tarefa-actions">
            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
              ← Voltar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} size="sm">
              {submitting ? "Aplicando..." : `Aplicar Força-Tarefa em ${selectedCount} cliente(s)`}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
