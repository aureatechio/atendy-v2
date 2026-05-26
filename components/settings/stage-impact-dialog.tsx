"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, MoveRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

type StageImpact = {
  stage_id: string;
  clientes_count: number;
  tasks_count: number;
  substages_count: number;
  can_deactivate: boolean;
};

type DestinationOption = {
  id: string;
  name: string;
};

export interface StageImpactDialogProps {
  open: boolean;
  stageId: string | null;
  stageName: string;
  destinations: DestinationOption[];
  onClose: () => void;
  /** Chamado quando o usuário confirma a desativação (com ou sem migração). */
  onConfirm: (params: {
    stageId: string;
    targetStageId: string | null;
    reason?: string;
  }) => Promise<void>;
}

export function StageImpactDialog({
  open,
  stageId,
  stageName,
  destinations,
  onClose,
  onConfirm,
}: StageImpactDialogProps) {
  const [impact, setImpact] = useState<StageImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !stageId) {
      setImpact(null);
      setError(null);
      setTargetId("");
      setReason("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(`/api/admin/pipeline-stages/${stageId}/impact`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error ?? "Falha ao consultar impacto.");
          return;
        }
        setImpact(payload as StageImpact);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro inesperado.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, stageId]);

  if (!open || !stageId) return null;

  const needsMigration = impact && (impact.clientes_count > 0 || impact.tasks_count > 0);
  const hasSubstages = impact && impact.substages_count > 0;
  const canConfirm =
    !submitting &&
    !!impact &&
    !hasSubstages &&
    (!needsMigration || (needsMigration && !!targetId));

  async function handleConfirm() {
    if (!stageId || !impact) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm({
        stageId,
        targetStageId: needsMigration ? targetId : null,
        reason: reason.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao desativar.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="settings-modal-backdrop" role="dialog" aria-modal aria-labelledby="impact-title">
      <div className="settings-modal panel-card">
        <header className="settings-modal-header">
          <div>
            <p className="auth-eyebrow">Desativar etapa</p>
            <h3 id="impact-title">{stageName}</h3>
          </div>
          <button
            type="button"
            className="settings-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X />
          </button>
        </header>

        <div className="settings-modal-body">
          {loading ? (
            <div className="settings-modal-loading">
              <Loader2 className="settings-spin" /> Verificando impacto…
            </div>
          ) : error ? (
            <div className="settings-alert settings-alert--error">
              <AlertTriangle />
              <span>{error}</span>
            </div>
          ) : impact ? (
            <>
              <div className="settings-impact-grid">
                <ImpactCard label="Clientes ativos" value={impact.clientes_count} />
                <ImpactCard label="Tasks em produção" value={impact.tasks_count} />
                <ImpactCard label="Subetapas ativas" value={impact.substages_count} />
              </div>

              {hasSubstages ? (
                <div className="settings-alert settings-alert--error">
                  <AlertTriangle />
                  <span>
                    Esta etapa possui {impact.substages_count} subetapa
                    {impact.substages_count === 1 ? "" : "s"} ativa
                    {impact.substages_count === 1 ? "" : "s"}. Promova ou desative as subetapas
                    antes.
                  </span>
                </div>
              ) : needsMigration ? (
                <>
                  <p className="settings-modal-text">
                    Existem registros ativos nesta etapa. Escolha para qual etapa eles devem ser
                    migrados antes de desativar:
                  </p>
                  <label className="settings-field">
                    <span className="label">Etapa de destino</span>
                    <Select
                      value={targetId}
                      onChange={(event) => setTargetId(event.target.value)}
                    >
                      <option value="">— Selecione —</option>
                      {destinations
                        .filter((option) => option.id !== stageId)
                        .map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                    </Select>
                  </label>
                  <label className="settings-field">
                    <span className="label">Motivo (opcional)</span>
                    <textarea
                      className="ds-input"
                      rows={2}
                      maxLength={500}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Ex.: Reorganização do funil em 2026"
                    />
                  </label>
                </>
              ) : (
                <p className="settings-modal-text">
                  Nenhum cliente ou task está nesta etapa. Pode desativar com segurança.
                </p>
              )}
            </>
          ) : null}
        </div>

        <footer className="settings-modal-footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            {submitting ? (
              <>
                <Loader2 className="settings-spin" />
                Processando…
              </>
            ) : needsMigration ? (
              <>
                <MoveRight />
                Migrar e desativar
              </>
            ) : (
              "Desativar etapa"
            )}
          </Button>
        </footer>
      </div>
    </div>
  );
}

function ImpactCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="settings-impact-card">
      <span className="settings-impact-card-label">{label}</span>
      <strong className={value === 0 ? "settings-impact-card-value is-zero" : "settings-impact-card-value"}>
        {value}
      </strong>
    </div>
  );
}
