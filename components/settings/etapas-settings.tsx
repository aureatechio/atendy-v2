"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Flag,
  Plus,
  Timer,
  Trash2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type SlaUnit = "business_days" | "business_hours" | "calendar_hours";

interface StageRow {
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
}

const slaUnitLabels: Record<SlaUnit, string> = {
  business_days: "dias úteis",
  business_hours: "horas úteis",
  calendar_hours: "horas corridas",
};

const slaUnitShort: Record<SlaUnit, string> = {
  business_days: "d. úteis",
  business_hours: "h. úteis",
  calendar_hours: "h. corridas",
};

type NewStageState = {
  name: string;
  slug: string;
  color: string;
  order_index: number;
  is_final: boolean;
  parent_stage_id: string;
  sla_amount: string;
  sla_unit: SlaUnit;
  warn_at_percent: number;
};

const initialNewStage: NewStageState = {
  name: "",
  slug: "",
  color: "#64748b",
  order_index: 0,
  is_final: false,
  parent_stage_id: "",
  sla_amount: "",
  sla_unit: "business_days",
  warn_at_percent: 80,
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function EtapasSettings() {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [newStage, setNewStage] = useState<NewStageState>(initialNewStage);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function loadStages() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/pipeline-stages", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ kind: "error", text: payload.error ?? "Não foi possível carregar etapas." });
        return;
      }
      setStages(payload.stages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStages();
  }, []);

  const rootStages = useMemo(
    () =>
      stages
        .filter((stage) => stage.parent_stage_id === null && stage.is_active)
        .sort((a, b) => a.order_index - b.order_index),
    [stages],
  );

  const substagesByParent = useMemo(() => {
    const map = new Map<string, StageRow[]>();
    for (const stage of stages) {
      if (!stage.parent_stage_id || !stage.is_active) continue;
      const list = map.get(stage.parent_stage_id) ?? [];
      list.push(stage);
      map.set(stage.parent_stage_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.order_index - b.order_index);
    }
    return map;
  }, [stages]);

  const totalSubstages = useMemo(
    () => stages.filter((s) => s.parent_stage_id && s.is_active).length,
    [stages],
  );
  const totalWithSla = useMemo(
    () => rootStages.filter((s) => s.sla_amount && s.sla_amount > 0).length,
    [rootStages],
  );

  function toggleExpanded(stageId: string) {
    setExpanded((current) => ({ ...current, [stageId]: !current[stageId] }));
  }

  async function createStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSaving(true);

    const body = {
      name: newStage.name,
      slug: newStage.slug || slugify(newStage.name),
      color: newStage.color,
      order_index: newStage.order_index,
      is_final: newStage.is_final,
      parent_stage_id: newStage.parent_stage_id || null,
      sla_amount: newStage.sla_amount ? Number(newStage.sla_amount) : null,
      sla_unit: newStage.sla_unit,
      warn_at_percent: newStage.warn_at_percent,
    };

    try {
      const response = await fetch("/api/admin/pipeline-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ kind: "error", text: payload.error ?? "Não foi possível criar a etapa." });
        return;
      }

      setNewStage(initialNewStage);
      setCreateOpen(false);
      setMessage({ kind: "success", text: "Etapa criada com sucesso." });
      await loadStages();
    } finally {
      setSaving(false);
    }
  }

  async function updateStage(id: string, changes: Partial<StageRow>) {
    setMessage(null);
    const response = await fetch(`/api/admin/pipeline-stages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage({ kind: "error", text: payload.error ?? "Não foi possível atualizar a etapa." });
      return;
    }
    setStages((current) => current.map((item) => (item.id === id ? { ...item, ...payload.stage } : item)));
  }

  async function deactivateStage(id: string, name: string) {
    if (!confirm(`Desativar a etapa "${name}"? Ela deixará de aparecer nos funis.`)) return;
    setMessage(null);
    const response = await fetch(`/api/admin/pipeline-stages/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setMessage({ kind: "error", text: payload.error ?? "Não foi possível desativar a etapa." });
      return;
    }
    setStages((current) => current.map((item) => (item.id === id ? { ...item, is_active: false } : item)));
    setMessage({ kind: "success", text: "Etapa desativada." });
  }

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <div>
          <p className="auth-eyebrow">Funil</p>
          <h2>Etapas e SLAs</h2>
          <p>
            Configure as etapas-mãe, suas subetapas e os prazos máximos (SLAs) para cada uma. Os
            prazos alimentam alertas e o monitor de pendências.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen((v) => !v)}>
          <Plus />
          {createOpen ? "Cancelar" : "Nova etapa"}
        </Button>
      </header>

      <div className="settings-summary">
        <div className="settings-summary-card">
          <span className="settings-summary-card-label">Etapas-mãe</span>
          <strong>{rootStages.length}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-card-label">Subetapas ativas</span>
          <strong>{totalSubstages}</strong>
        </div>
        <div className="settings-summary-card">
          <span className="settings-summary-card-label">Com SLA definido</span>
          <strong>{totalWithSla}</strong>
        </div>
      </div>

      {message ? (
        <div className={`settings-alert settings-alert--${message.kind}`} role="status">
          {message.kind === "success" ? <CheckCircle2 /> : <AlertTriangle />}
          <span>{message.text}</span>
        </div>
      ) : null}

      {createOpen ? (
        <form className="settings-create-form panel-card" onSubmit={createStage}>
          <div className="settings-create-form-grid">
            <div className="settings-field settings-field--wide">
              <label className="label" htmlFor="stage-name">Nome</label>
              <Input
                id="stage-name"
                value={newStage.name}
                onChange={(event) =>
                  setNewStage((current) => ({
                    ...current,
                    name: event.target.value,
                    slug: current.slug || slugify(event.target.value),
                  }))
                }
                required
                placeholder="Ex.: Em Produção"
              />
            </div>

            <div className="settings-field">
              <label className="label" htmlFor="stage-slug">Slug</label>
              <Input
                id="stage-slug"
                value={newStage.slug}
                onChange={(event) => setNewStage((current) => ({ ...current, slug: event.target.value }))}
                required
                placeholder="em-producao"
              />
            </div>

            <div className="settings-field">
              <label className="label" htmlFor="stage-parent">Etapa-mãe</label>
              <Select
                id="stage-parent"
                value={newStage.parent_stage_id}
                onChange={(event) =>
                  setNewStage((current) => ({ ...current, parent_stage_id: event.target.value }))
                }
              >
                <option value="">— Sem etapa-mãe (raiz)</option>
                {rootStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.name}</option>
                ))}
              </Select>
            </div>

            <div className="settings-field settings-field--narrow">
              <label className="label" htmlFor="stage-color">Cor</label>
              <Input
                id="stage-color"
                type="color"
                value={newStage.color}
                onChange={(event) => setNewStage((current) => ({ ...current, color: event.target.value }))}
              />
            </div>

            <div className="settings-field settings-field--narrow">
              <label className="label" htmlFor="stage-order">Ordem</label>
              <Input
                id="stage-order"
                type="number"
                min={0}
                value={newStage.order_index}
                onChange={(event) =>
                  setNewStage((current) => ({ ...current, order_index: Number(event.target.value) }))
                }
              />
            </div>

            <div className="settings-field">
              <label className="label" htmlFor="stage-sla-amount">
                SLA <span className="settings-field-hint">(vazio = sem prazo)</span>
              </label>
              <Input
                id="stage-sla-amount"
                type="number"
                min={1}
                value={newStage.sla_amount}
                disabled={Boolean(newStage.parent_stage_id)}
                onChange={(event) => setNewStage((current) => ({ ...current, sla_amount: event.target.value }))}
                placeholder={newStage.parent_stage_id ? "Herda da etapa-mãe" : "Ex.: 3"}
              />
            </div>

            <div className="settings-field">
              <label className="label" htmlFor="stage-sla-unit">Unidade do SLA</label>
              <Select
                id="stage-sla-unit"
                value={newStage.sla_unit}
                disabled={Boolean(newStage.parent_stage_id)}
                onChange={(event) =>
                  setNewStage((current) => ({ ...current, sla_unit: event.target.value as SlaUnit }))
                }
              >
                {Object.entries(slaUnitLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>

            <div className="settings-field settings-field--narrow">
              <label className="label" htmlFor="stage-warn">
                Alerta <span className="settings-field-hint">(% do prazo)</span>
              </label>
              <Input
                id="stage-warn"
                type="number"
                min={1}
                max={100}
                value={newStage.warn_at_percent}
                onChange={(event) =>
                  setNewStage((current) => ({ ...current, warn_at_percent: Number(event.target.value) }))
                }
              />
            </div>

            <label className="settings-field-checkbox">
              <input
                type="checkbox"
                checked={newStage.is_final}
                onChange={(event) => setNewStage((current) => ({ ...current, is_final: event.target.checked }))}
              />
              <span>Marcar como etapa final do funil</span>
            </label>
          </div>

          <div className="settings-create-form-actions">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              <Plus />
              {saving ? "Criando..." : "Criar etapa"}
            </Button>
          </div>
        </form>
      ) : null}

      <section className="settings-stage-list" aria-label="Etapas do funil">
        {loading ? (
          <div className="settings-empty panel-card">Carregando etapas...</div>
        ) : rootStages.length === 0 ? (
          <div className="settings-empty panel-card">
            <Workflow />
            <p>Nenhuma etapa cadastrada ainda. Clique em "Nova etapa" para começar.</p>
          </div>
        ) : (
          rootStages.map((stage) => {
            const substages = substagesByParent.get(stage.id) ?? [];
            const isExpanded = expanded[stage.id] ?? true;
            return (
              <StageCard
                key={stage.id}
                stage={stage}
                substages={substages}
                expanded={isExpanded}
                onToggle={() => toggleExpanded(stage.id)}
                onUpdate={updateStage}
                onDeactivate={deactivateStage}
              />
            );
          })
        )}
      </section>
    </div>
  );
}

interface StageCardProps {
  stage: StageRow;
  substages: StageRow[];
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, changes: Partial<StageRow>) => Promise<void>;
  onDeactivate: (id: string, name: string) => Promise<void>;
}

function StageCard({ stage, substages, expanded, onToggle, onUpdate, onDeactivate }: StageCardProps) {
  return (
    <article className="settings-stage panel-card" style={{ borderLeftColor: stage.color }}>
      <header className="settings-stage-header">
        <button
          type="button"
          className="settings-stage-toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? "Recolher subetapas" : "Expandir subetapas"}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </button>
        <span
          className="settings-stage-color"
          aria-hidden
          style={{ background: stage.color }}
        />
        <div className="settings-stage-identity">
          <input
            className="settings-stage-name-input"
            defaultValue={stage.name}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== stage.name) void onUpdate(stage.id, { name: value });
            }}
          />
          <div className="settings-stage-meta">
            <code>{stage.slug}</code>
            <span>·</span>
            <span>Ordem {stage.order_index}</span>
            <span>·</span>
            <span>{substages.length} subetapa{substages.length === 1 ? "" : "s"}</span>
            {stage.is_final ? (
              <span className="settings-stage-flag">
                <Flag /> Final
              </span>
            ) : null}
          </div>
        </div>
        <div className="settings-stage-controls">
          <label className="settings-stage-control">
            <span className="settings-stage-control-label">
              <Timer /> SLA
            </span>
            <span className="settings-stage-control-input">
              <Input
                type="number"
                min={1}
                defaultValue={stage.sla_amount ?? ""}
                placeholder="—"
                onBlur={(event) => {
                  const raw = event.target.value.trim();
                  const value = raw === "" ? null : Number(raw);
                  if (value === stage.sla_amount) return;
                  void onUpdate(stage.id, { sla_amount: value });
                }}
              />
              <Select
                value={stage.sla_unit}
                onChange={(event) => void onUpdate(stage.id, { sla_unit: event.target.value as SlaUnit })}
              >
                {Object.entries(slaUnitLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </span>
          </label>

          <label className="settings-stage-control settings-stage-control--narrow">
            <span className="settings-stage-control-label">
              <AlertTriangle /> Alerta %
            </span>
            <Input
              type="number"
              min={1}
              max={100}
              defaultValue={stage.warn_at_percent}
              onBlur={(event) => {
                const value = Number(event.target.value);
                if (value === stage.warn_at_percent) return;
                void onUpdate(stage.id, { warn_at_percent: value });
              }}
            />
          </label>

          <label className="settings-stage-control settings-stage-control--narrow">
            <span className="settings-stage-control-label">Ordem</span>
            <Input
              type="number"
              min={0}
              defaultValue={stage.order_index}
              onBlur={(event) => {
                const value = Number(event.target.value);
                if (value === stage.order_index) return;
                void onUpdate(stage.id, { order_index: value });
              }}
            />
          </label>

          <label className="settings-stage-control settings-stage-control--narrow">
            <span className="settings-stage-control-label">Cor</span>
            <input
              type="color"
              className="settings-stage-color-input"
              defaultValue={stage.color}
              onBlur={(event) => {
                if (event.target.value === stage.color) return;
                void onUpdate(stage.id, { color: event.target.value });
              }}
            />
          </label>

          <label className="settings-stage-control settings-stage-control--checkbox">
            <input
              type="checkbox"
              checked={stage.is_final}
              onChange={(event) => void onUpdate(stage.id, { is_final: event.target.checked })}
            />
            <span>Final</span>
          </label>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void onDeactivate(stage.id, stage.name)}
            title="Desativar etapa"
          >
            <Trash2 />
          </Button>
        </div>
      </header>

      {expanded ? (
        <div className="settings-substage-list">
          {substages.length === 0 ? (
            <p className="settings-substage-empty">
              Sem subetapas — adicione uma via "Nova etapa" usando esta como etapa-mãe.
            </p>
          ) : (
            substages.map((sub) => (
              <SubstageRow
                key={sub.id}
                stage={sub}
                onUpdate={onUpdate}
                onDeactivate={onDeactivate}
              />
            ))
          )}
        </div>
      ) : null}
    </article>
  );
}

interface SubstageRowProps {
  stage: StageRow;
  onUpdate: (id: string, changes: Partial<StageRow>) => Promise<void>;
  onDeactivate: (id: string, name: string) => Promise<void>;
}

function SubstageRow({ stage, onUpdate, onDeactivate }: SubstageRowProps) {
  return (
    <div className="settings-substage">
      <span className="settings-substage-prefix" aria-hidden>
        <CornerDownRight />
      </span>
      <span className="settings-stage-color" aria-hidden style={{ background: stage.color }} />
      <input
        className="settings-substage-name-input"
        defaultValue={stage.name}
        onBlur={(event) => {
          const value = event.target.value.trim();
          if (value && value !== stage.name) void onUpdate(stage.id, { name: value });
        }}
      />
      <code className="settings-substage-slug">{stage.slug}</code>
      <label className="settings-substage-field">
        <span>Ordem</span>
        <Input
          type="number"
          min={0}
          defaultValue={stage.order_index}
          onBlur={(event) => {
            const value = Number(event.target.value);
            if (value === stage.order_index) return;
            void onUpdate(stage.id, { order_index: value });
          }}
        />
      </label>
      <label className="settings-substage-field">
        <span>Cor</span>
        <input
          type="color"
          className="settings-stage-color-input"
          defaultValue={stage.color}
          onBlur={(event) => {
            if (event.target.value === stage.color) return;
            void onUpdate(stage.id, { color: event.target.value });
          }}
        />
      </label>
      <span className="settings-substage-sla" title="Subetapas herdam o SLA da etapa-mãe">
        SLA herdado ({slaUnitShort[stage.sla_unit]})
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => void onDeactivate(stage.id, stage.name)}
        title="Desativar subetapa"
      >
        <Trash2 />
      </Button>
    </div>
  );
}
