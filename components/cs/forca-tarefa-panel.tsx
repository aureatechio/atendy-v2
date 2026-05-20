"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listCandidates, type CandidateClient } from "@/app/(protected)/cs/forca-tarefa/list-candidates";
import { reassignBatch } from "@/app/(protected)/cs/forca-tarefa/actions";

type StageOption = {
  id: string;
  name: string;
  slug: string;
  color: string;
  order_index: number;
};

type AttendantOption = {
  id: string;
  full_name: string;
};

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

export function ForcaTarefaPanel({
  stages,
  attendants,
}: {
  stages: StageOption[];
  attendants: AttendantOption[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [stageId, setStageId] = useState<string>(stages[0]?.id ?? "");
  const [minDays, setMinDays] = useState<number>(7);
  const [candidates, setCandidates] = useState<CandidateClient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [loadingCandidates, startLoadingCandidates] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);

  const stageName = useMemo(() => stages.find((s) => s.id === stageId)?.name ?? "", [stages, stageId]);
  const selectedCount = selectedIds.size;
  const totalQuota = Object.values(quotas).reduce((sum, n) => sum + (Number(n) || 0), 0);
  const quotaMatches = totalQuota === selectedCount && selectedCount > 0;

  function fetchCandidates() {
    if (!stageId) return;
    setError(null);
    startLoadingCandidates(async () => {
      const result = await listCandidates({ stageId, minDays });
      if (!result.ok) {
        setError(result.error ?? "Falha ao carregar candidatos.");
        setCandidates([]);
        return;
      }
      setCandidates(result.candidates ?? []);
      setSelectedIds(new Set());
    });
  }

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
    if (selectedCount === 0 || attendants.length === 0) return;
    const k = attendants.length;
    const base = Math.floor(selectedCount / k);
    const remainder = selectedCount - base * k;
    const next: Record<string, number> = {};
    attendants.forEach((a, idx) => {
      next[a.id] = base + (idx < remainder ? 1 : 0);
    });
    setQuotas(next);
  }

  function setQuota(attendantId: string, value: number) {
    setQuotas((current) => ({ ...current, [attendantId]: Math.max(0, Math.floor(Number(value) || 0)) }));
  }

  function buildAssignments() {
    const selected = candidates.filter((c) => selectedIds.has(c.id));
    // Atribui em ordem: percorre cada atendente e consome quota
    const assignments: Array<{
      clienteId: string;
      toAssigneeId: string;
      fromAssigneeId: string | null;
      stageId: string | null;
    }> = [];
    let cursor = 0;
    for (const a of attendants) {
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
      const distribution = attendants
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
      setCandidates([]);
      setReason("");
    });
  }

  function resetSuccess() {
    setSuccess(null);
  }

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

      {step === 1 ? (
        <section className="forca-tarefa-panel">
          <h3>1. Selecionar lote</h3>
          <div className="forca-tarefa-filters">
            <label>
              Etapa
              <select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Parado há ≥ N dias
              <input
                type="number"
                min={0}
                value={minDays}
                onChange={(e) => setMinDays(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              />
            </label>
            <div style={{ alignSelf: "end" }}>
              <Button onClick={fetchCandidates} disabled={loadingCandidates || !stageId} size="sm">
                <RefreshCw width={14} height={14} />
                {loadingCandidates ? "Carregando..." : "Buscar candidatos"}
              </Button>
            </div>
          </div>

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
                : "Use os filtros acima e clique em Buscar candidatos."}
            </div>
          )}
        </section>
      ) : null}

      {step === 2 ? (
        <section className="forca-tarefa-panel">
          <h3>2. Distribuir cotas entre atendentes</h3>

          {attendants.length === 0 ? (
            <div className="forca-tarefa-error">Nenhuma atendente ativa encontrada. Cadastre em /admin/users.</div>
          ) : null}

          <div className="forca-tarefa-summary">
            <span>
              Selecionados: <strong>{selectedCount}</strong> · Soma das cotas:{" "}
              <strong>{totalQuota}</strong>
            </span>
            <div className="forca-tarefa-actions-right">
              <Button size="sm" variant="ghost" onClick={divideEqually}>
                Dividir igualmente
              </Button>
            </div>
          </div>

          <div className="forca-tarefa-assignees">
            {attendants.map((a) => (
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
        </section>
      ) : null}

      {step === 3 ? (
        <section className="forca-tarefa-panel">
          <h3>3. Confirmar Força-Tarefa</h3>
          <p style={{ color: "var(--text-muted)", margin: 0 }}>
            Vou reatribuir <strong>{selectedCount}</strong> cliente(s) da etapa{" "}
            <strong>{stageName}</strong> para:
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {attendants
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
