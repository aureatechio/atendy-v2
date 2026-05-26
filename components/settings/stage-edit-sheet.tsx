"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type SlaUnit = "business_days" | "business_hours" | "calendar_hours";

export interface StageRow {
  id: string;
  name: string;
  slug: string;
  color: string;
  order_index: number;
  is_final: boolean;
  is_active: boolean;
  parent_stage_id: string | null;
  sla_amount: number | null;
  sla_unit: SlaUnit;
  warn_at_percent: number;
  followup_days: number | null;
}

export interface StageEditSheetProps {
  open: boolean;
  stage: StageRow | null;
  onClose: () => void;
  onSave: (id: string, changes: Partial<StageRow>) => Promise<void>;
}

const slaUnitLabels: Record<SlaUnit, string> = {
  business_days: "dias úteis",
  business_hours: "horas úteis (não suportado)",
  calendar_hours: "horas corridas",
};

export function StageEditSheet({ open, stage, onClose, onSave }: StageEditSheetProps) {
  const [form, setForm] = useState<StageRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && stage) {
      setForm({ ...stage });
      setError(null);
    }
  }, [open, stage]);

  if (!open || !stage || !form) return null;

  const isSubstage = stage.parent_stage_id !== null;

  function update<K extends keyof StageRow>(key: K, value: StageRow[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !stage) return;

    const changes: Partial<StageRow> = {};
    if (form.name !== stage.name) changes.name = form.name.trim();
    if (form.slug !== stage.slug) changes.slug = form.slug.trim();
    if (form.color !== stage.color) changes.color = form.color;
    if (form.is_final !== stage.is_final) changes.is_final = form.is_final;
    if (form.warn_at_percent !== stage.warn_at_percent) changes.warn_at_percent = form.warn_at_percent;
    if (form.sla_amount !== stage.sla_amount) changes.sla_amount = form.sla_amount;
    if (form.sla_unit !== stage.sla_unit) changes.sla_unit = form.sla_unit;
    if (form.followup_days !== stage.followup_days) changes.followup_days = form.followup_days;

    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(stage.id, changes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-modal-backdrop" role="dialog" aria-modal>
      <form className="settings-sheet panel-card" onSubmit={handleSubmit}>
        <header className="settings-modal-header">
          <div>
            <p className="auth-eyebrow">{isSubstage ? "Subetapa" : "Etapa-mãe"}</p>
            <h3>Editar {stage.name}</h3>
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

        <div className="settings-modal-body settings-sheet-body">
          <div className="settings-sheet-grid">
            <label className="settings-field settings-field--wide">
              <span className="label">Nome</span>
              <Input
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                required
              />
            </label>

            <label className="settings-field">
              <span className="label">
                Slug{" "}
                <span className="settings-field-hint">(alterar pode quebrar integrações)</span>
              </span>
              <Input
                value={form.slug}
                onChange={(event) => update("slug", event.target.value)}
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              />
            </label>

            <label className="settings-field settings-field--narrow">
              <span className="label">Cor</span>
              <input
                type="color"
                className="settings-stage-color-input"
                value={form.color}
                onChange={(event) => update("color", event.target.value)}
              />
            </label>

            {!isSubstage ? (
              <label className="settings-field-checkbox settings-sheet-checkbox">
                <input
                  type="checkbox"
                  checked={form.is_final}
                  onChange={(event) => update("is_final", event.target.checked)}
                />
                <span>Etapa final do funil (não recebe alertas/SLA)</span>
              </label>
            ) : null}
          </div>

          <h4 className="settings-sheet-section-title">Prazo (SLA)</h4>
          <div className="settings-sheet-grid">
            <label className="settings-field">
              <span className="label">
                Quantidade <span className="settings-field-hint">(vazio = sem SLA)</span>
              </span>
              <Input
                type="number"
                min={1}
                value={form.sla_amount ?? ""}
                onChange={(event) => {
                  const v = event.target.value;
                  update("sla_amount", v === "" ? null : Number(v));
                }}
                placeholder={isSubstage ? "(opcional)" : "Ex.: 3"}
              />
            </label>

            <label className="settings-field">
              <span className="label">Unidade</span>
              <Select
                value={form.sla_unit}
                onChange={(event) => update("sla_unit", event.target.value as SlaUnit)}
              >
                {Object.entries(slaUnitLabels).map(([value, label]) => (
                  <option
                    key={value}
                    value={value}
                    disabled={value === "business_hours"}
                  >
                    {label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="settings-field settings-field--narrow">
              <span className="label">
                Alerta <span className="settings-field-hint">(% do prazo)</span>
              </span>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.warn_at_percent}
                onChange={(event) => update("warn_at_percent", Number(event.target.value))}
              />
            </label>

            <label className="settings-field">
              <span className="label">
                Follow-up{" "}
                <span className="settings-field-hint">(dias sem interação)</span>
              </span>
              <Input
                type="number"
                min={1}
                value={form.followup_days ?? ""}
                onChange={(event) => {
                  const v = event.target.value;
                  update("followup_days", v === "" ? null : Number(v));
                }}
                placeholder="Ex.: 5"
              />
            </label>
          </div>

          {isSubstage ? (
            <div className="settings-alert settings-alert--warning">
              <AlertTriangle />
              <span>
                Atenção: hoje o cron de alertas <strong>não herda</strong> o SLA da etapa-mãe
                para subetapas. Se definir SLA aqui, ele será usado isoladamente.
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="settings-alert settings-alert--error">
              <AlertTriangle />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <footer className="settings-modal-footer">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="settings-spin" />
                Salvando…
              </>
            ) : (
              <>
                <Save /> Salvar alterações
              </>
            )}
          </Button>
        </footer>
      </form>
    </div>
  );
}
