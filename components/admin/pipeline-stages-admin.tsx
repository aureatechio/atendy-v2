"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Workflow } from "lucide-react";
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
  followup_days: number | null;
}

const slaUnitLabels: Record<SlaUnit, string> = {
  business_days: "dias úteis",
  business_hours: "horas úteis",
  calendar_hours: "horas corridas",
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
  followup_days: string;
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
  followup_days: "",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function PipelineStagesAdmin() {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newStage, setNewStage] = useState<NewStageState>(initialNewStage);

  async function loadStages() {
    setLoading(true);
    const response = await fetch("/api/admin/pipeline-stages", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel carregar etapas.");
      setLoading(false);
      return;
    }
    setStages(payload.stages);
    setLoading(false);
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
      followup_days: newStage.followup_days ? Number(newStage.followup_days) : null,
    };

    const response = await fetch("/api/admin/pipeline-stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setSaving(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel criar a etapa.");
      return;
    }

    setNewStage(initialNewStage);
    setMessage("Etapa criada.");
    await loadStages();
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
      setMessage(payload.error ?? "Nao foi possivel atualizar a etapa.");
      return;
    }
    setStages((current) => current.map((item) => (item.id === id ? { ...item, ...payload.stage } : item)));
  }

  async function deactivateStage(id: string) {
    setMessage(null);
    const response = await fetch(`/api/admin/pipeline-stages/${id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error ?? "Nao foi possivel desativar a etapa.");
      return;
    }
    setStages((current) => current.map((item) => (item.id === id ? { ...item, is_active: false } : item)));
  }

  return (
    <div className="admin-users">
      <section className="panel-card">
        <div className="panel-card-header admin-users-title">
          <div>
            <p className="auth-eyebrow">Pipeline</p>
            <h2>Etapas e SLAs</h2>
            <p>Configure etapas, subetapas e prazos por etapa-mãe.</p>
          </div>
          <Workflow />
        </div>

        <form className="panel-card-content admin-create-form" onSubmit={createStage}>
          {message ? <div className="auth-alert admin-message">{message}</div> : null}

          <div>
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
            />
          </div>

          <div>
            <label className="label" htmlFor="stage-slug">Slug</label>
            <Input
              id="stage-slug"
              value={newStage.slug}
              onChange={(event) => setNewStage((current) => ({ ...current, slug: event.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="stage-parent">Etapa-mãe (opcional)</label>
            <Select
              id="stage-parent"
              value={newStage.parent_stage_id}
              onChange={(event) => setNewStage((current) => ({ ...current, parent_stage_id: event.target.value }))}
            >
              <option value="">— Sem etapa-mãe (raiz)</option>
              {rootStages.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="label" htmlFor="stage-color">Cor</label>
            <Input
              id="stage-color"
              type="color"
              value={newStage.color}
              onChange={(event) => setNewStage((current) => ({ ...current, color: event.target.value }))}
            />
          </div>

          <div>
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

          <div>
            <label className="label" htmlFor="stage-sla-amount">SLA (deixe vazio = sem prazo)</label>
            <Input
              id="stage-sla-amount"
              type="number"
              min={1}
              value={newStage.sla_amount}
              disabled={Boolean(newStage.parent_stage_id)}
              onChange={(event) => setNewStage((current) => ({ ...current, sla_amount: event.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="stage-sla-unit">Unidade</label>
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

          <div>
            <label className="label" htmlFor="stage-warn">Alerta preventivo (% do prazo)</label>
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

          <div>
            <label className="label" htmlFor="stage-followup">Follow-up (dias)</label>
            <Input
              id="stage-followup"
              type="number"
              min={1}
              placeholder="ex.: 14, vazio = desligado"
              value={newStage.followup_days}
              disabled={Boolean(newStage.parent_stage_id)}
              onChange={(event) =>
                setNewStage((current) => ({ ...current, followup_days: event.target.value }))
              }
            />
          </div>

          <Button type="submit" disabled={saving}>
            <Plus />
            {saving ? "Criando..." : "Criar etapa"}
          </Button>
        </form>
      </section>

      <section className="panel-card">
        <div className="panel-card-header">
          <h3 className="text-[15px] font-semibold">Hierarquia atual</h3>
        </div>
        <div className="panel-card-content admin-users-table-wrap">
          {loading ? (
            <p className="admin-empty">Carregando etapas...</p>
          ) : (
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Etapa</th>
                  <th>Slug</th>
                  <th>Ordem</th>
                  <th>SLA</th>
                  <th>Alerta %</th>
                  <th>Follow-up (dias)</th>
                  <th>Final</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rootStages.map((stage) => (
                  <StageGroup
                    key={stage.id}
                    stage={stage}
                    substages={substagesByParent.get(stage.id) ?? []}
                    onUpdate={updateStage}
                    onDeactivate={deactivateStage}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

interface StageGroupProps {
  stage: StageRow;
  substages: StageRow[];
  onUpdate: (id: string, changes: Partial<StageRow>) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}

function StageGroup({ stage, substages, onUpdate, onDeactivate }: StageGroupProps) {
  return (
    <>
      <StageRowView stage={stage} isSubstage={false} onUpdate={onUpdate} onDeactivate={onDeactivate} />
      {substages.map((sub) => (
        <StageRowView key={sub.id} stage={sub} isSubstage onUpdate={onUpdate} onDeactivate={onDeactivate} />
      ))}
    </>
  );
}

interface StageRowProps {
  stage: StageRow;
  isSubstage: boolean;
  onUpdate: (id: string, changes: Partial<StageRow>) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}

function StageRowView({ stage, isSubstage, onUpdate, onDeactivate }: StageRowProps) {
  return (
    <tr style={isSubstage ? { background: "rgba(148,163,184,0.08)" } : undefined}>
      <td>
        <span style={{ paddingLeft: isSubstage ? 24 : 0, display: "inline-flex", gap: 8, alignItems: "center" }}>
          <span
            aria-hidden
            style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, background: stage.color }}
          />
          <input
            className="admin-inline-input"
            value={stage.name}
            onChange={(event) => void onUpdate(stage.id, { name: event.target.value })}
          />
        </span>
      </td>
      <td><span>{stage.slug}</span></td>
      <td>
        <input
          className="admin-inline-input"
          type="number"
          min={0}
          defaultValue={stage.order_index}
          onBlur={(event) => void onUpdate(stage.id, { order_index: Number(event.target.value) })}
          style={{ width: 70 }}
        />
      </td>
      <td>
        {isSubstage ? (
          <span style={{ color: "#94a3b8" }}>—</span>
        ) : (
          <span style={{ display: "inline-flex", gap: 6 }}>
            <input
              className="admin-inline-input"
              type="number"
              min={1}
              defaultValue={stage.sla_amount ?? ""}
              placeholder="—"
              onBlur={(event) => {
                const raw = event.target.value.trim();
                const value = raw === "" ? null : Number(raw);
                void onUpdate(stage.id, { sla_amount: value });
              }}
              style={{ width: 70 }}
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
        )}
      </td>
      <td>
        <input
          className="admin-inline-input"
          type="number"
          min={1}
          max={100}
          defaultValue={stage.warn_at_percent}
          onBlur={(event) => void onUpdate(stage.id, { warn_at_percent: Number(event.target.value) })}
          style={{ width: 70 }}
        />
      </td>
      <td>
        {isSubstage ? (
          <span style={{ color: "#94a3b8" }}>—</span>
        ) : (
          <input
            className="admin-inline-input"
            type="number"
            min={1}
            defaultValue={stage.followup_days ?? ""}
            placeholder="—"
            onBlur={(event) => {
              const raw = event.target.value.trim();
              const value = raw === "" ? null : Number(raw);
              void onUpdate(stage.id, { followup_days: value });
            }}
            style={{ width: 70 }}
          />
        )}
      </td>
      <td>
        <input
          type="checkbox"
          checked={stage.is_final}
          onChange={(event) => void onUpdate(stage.id, { is_final: event.target.checked })}
        />
      </td>
      <td>
        <Button type="button" variant="ghost" size="sm" onClick={() => void onDeactivate(stage.id)}>
          Desativar
        </Button>
      </td>
    </tr>
  );
}
