"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { SlaUnit, StageRow } from "@/components/settings/stage-edit-sheet";

export interface StageCreateDialogProps {
  open: boolean;
  defaultParentId: string | null;
  parents: Array<{ id: string; name: string }>;
  nextOrderIndex: number;
  onClose: () => void;
  onCreate: (
    payload: Omit<StageRow, "id" | "is_active"> & { is_active?: boolean },
  ) => Promise<void>;
}

const slaUnitLabels: Record<SlaUnit, string> = {
  business_days: "dias úteis",
  business_hours: "horas úteis (não suportado)",
  calendar_hours: "horas corridas",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function StageCreateDialog({
  open,
  defaultParentId,
  parents,
  nextOrderIndex,
  onClose,
  onCreate,
}: StageCreateDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [parentId, setParentId] = useState<string>(defaultParentId ?? "");
  const [color, setColor] = useState("#64748b");
  const [isFinal, setIsFinal] = useState(false);
  const [slaAmount, setSlaAmount] = useState<string>("");
  const [slaUnit, setSlaUnit] = useState<SlaUnit>("business_days");
  const [warnPercent, setWarnPercent] = useState(80);
  const [followupDays, setFollowupDays] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setSlug("");
      setSlugDirty(false);
      setParentId(defaultParentId ?? "");
      setColor("#64748b");
      setIsFinal(false);
      setSlaAmount("");
      setSlaUnit("business_days");
      setWarnPercent(80);
      setFollowupDays("");
      setError(null);
    }
  }, [open, defaultParentId]);

  if (!open) return null;

  const isSubstage = parentId !== "";

  function handleNameChange(value: string) {
    setName(value);
    if (!slugDirty) setSlug(slugify(value));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Informe o nome.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        slug: slug.trim() || slugify(name),
        color,
        order_index: nextOrderIndex,
        is_final: isFinal && !isSubstage,
        parent_stage_id: parentId || null,
        sla_amount: slaAmount ? Number(slaAmount) : null,
        sla_unit: slaUnit,
        warn_at_percent: warnPercent,
        followup_days: followupDays ? Number(followupDays) : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar etapa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-modal-backdrop" role="dialog" aria-modal>
      <form className="settings-sheet panel-card" onSubmit={handleSubmit}>
        <header className="settings-modal-header">
          <div>
            <p className="auth-eyebrow">Nova {isSubstage ? "subetapa" : "etapa"}</p>
            <h3>{isSubstage ? "Adicionar subetapa" : "Adicionar etapa"}</h3>
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
                value={name}
                onChange={(event) => handleNameChange(event.target.value)}
                required
                placeholder="Ex.: Em Produção"
              />
            </label>

            <label className="settings-field">
              <span className="label">Slug</span>
              <Input
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugDirty(true);
                }}
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                placeholder="em-producao"
              />
            </label>

            <label className="settings-field">
              <span className="label">Etapa-mãe</span>
              <Select
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="">— Sem etapa-mãe (raiz)</option>
                {parents.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </label>

            <label className="settings-field settings-field--narrow">
              <span className="label">Cor</span>
              <input
                type="color"
                className="settings-stage-color-input"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            </label>

            {!isSubstage ? (
              <label className="settings-field-checkbox settings-sheet-checkbox">
                <input
                  type="checkbox"
                  checked={isFinal}
                  onChange={(event) => setIsFinal(event.target.checked)}
                />
                <span>Etapa final do funil</span>
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
                value={slaAmount}
                onChange={(event) => setSlaAmount(event.target.value)}
                placeholder="Ex.: 3"
              />
            </label>

            <label className="settings-field">
              <span className="label">Unidade</span>
              <Select
                value={slaUnit}
                onChange={(event) => setSlaUnit(event.target.value as SlaUnit)}
              >
                {Object.entries(slaUnitLabels).map(([value, label]) => (
                  <option key={value} value={value} disabled={value === "business_hours"}>
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
                value={warnPercent}
                onChange={(event) => setWarnPercent(Number(event.target.value))}
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
                value={followupDays}
                onChange={(event) => setFollowupDays(event.target.value)}
                placeholder="Ex.: 5"
              />
            </label>
          </div>

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
                Criando…
              </>
            ) : (
              <>
                <Plus /> Criar
              </>
            )}
          </Button>
        </footer>
      </form>
    </div>
  );
}
