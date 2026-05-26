"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CornerDownRight,
  Flag,
  GripVertical,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Timer,
  Trash2,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StageCreateDialog } from "@/components/settings/stage-create-dialog";
import { StageEditSheet, type SlaUnit, type StageRow } from "@/components/settings/stage-edit-sheet";
import { StageImpactDialog } from "@/components/settings/stage-impact-dialog";
import {
  applyStageReorderProjection,
  type StageReorderUpdate,
} from "@/lib/settings/stage-reorder";

type Message = { kind: "success" | "error"; text: string } | null;

const slaUnitShort: Record<SlaUnit, string> = {
  business_days: "d. úteis",
  business_hours: "h. úteis",
  calendar_hours: "h. corridas",
};

interface RootDescriptor {
  type: "root";
  id: string;
}
interface SubDescriptor {
  type: "sub";
  id: string;
}
type DraggableId = RootDescriptor | SubDescriptor;

function encodeId(desc: DraggableId): string {
  return desc.type === "root" ? `root:${desc.id}` : `sub:${desc.id}`;
}

function decodeId(raw: string): DraggableId | null {
  const parts = raw.split(":");
  if (parts[0] === "root" && parts[1]) return { type: "root", id: parts[1] };
  if (parts[0] === "sub" && parts[1]) {
    return { type: "sub", id: parts[1] };
  }
  return null;
}

function isPointInsideRect(
  point: { x: number; y: number },
  rect: { top: number; right: number; bottom: number; left: number },
) {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function findStageIn(stages: StageRow[], id: string): StageRow | undefined {
  return stages.find((stage) => stage.id === id);
}

function getSubstagesByParent(stages: StageRow[]) {
  const map = new Map<string, StageRow[]>();
  for (const stage of stages) {
    if (!stage.is_active || !stage.parent_stage_id) continue;
    const list = map.get(stage.parent_stage_id) ?? [];
    list.push(stage);
    map.set(stage.parent_stage_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.order_index - b.order_index);
  }
  return map;
}

function projectSubstageMove(
  stages: StageRow[],
  activeId: string,
  overDesc: DraggableId,
  options?: { allowSameParentReorder?: boolean },
): StageRow[] | null {
  const activeStage = findStageIn(stages, activeId);
  const sourceParentId = activeStage?.parent_stage_id ?? null;
  if (!activeStage || !sourceParentId) return null;

  const overStage = findStageIn(stages, overDesc.id);
  const targetParentId = overDesc.type === "root" ? overDesc.id : (overStage?.parent_stage_id ?? null);
  if (!targetParentId) return null;

  const targetParent = findStageIn(stages, targetParentId);
  if (!targetParent || !targetParent.is_active || targetParent.parent_stage_id) return null;

  const substagesByParent = getSubstagesByParent(stages);
  if (targetParentId === sourceParentId) {
    if (!options?.allowSameParentReorder || overDesc.type !== "sub") return null;
    const currentList = substagesByParent.get(sourceParentId) ?? [];
    const oldIndex = currentList.findIndex((stage) => stage.id === activeId);
    const newIndex = currentList.findIndex((stage) => stage.id === overDesc.id);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null;

    const reordered = arrayMove(currentList, oldIndex, newIndex);
    const updatesById = new Map<string, Pick<StageRow, "order_index" | "parent_stage_id">>();
    reordered.forEach((stage, index) => {
      updatesById.set(stage.id, { order_index: index, parent_stage_id: sourceParentId });
    });

    return stages.map((stage) => {
      const update = updatesById.get(stage.id);
      return update ? { ...stage, ...update } : stage;
    });
  }

  const sourceList = (substagesByParent.get(sourceParentId) ?? []).filter((stage) => stage.id !== activeId);
  const targetListWithoutActive = (substagesByParent.get(targetParentId) ?? []).filter(
    (stage) => stage.id !== activeId,
  );
  let insertIndex = targetListWithoutActive.length;

  if (overDesc.type === "sub" && overDesc.id !== activeId) {
    const overIndex = targetListWithoutActive.findIndex((stage) => stage.id === overDesc.id);
    if (overIndex >= 0) insertIndex = overIndex;
  }

  const nextTargetList = [
    ...targetListWithoutActive.slice(0, insertIndex),
    activeStage,
    ...targetListWithoutActive.slice(insertIndex),
  ];

  const updatesById = new Map<string, Pick<StageRow, "order_index" | "parent_stage_id">>();
  sourceList.forEach((stage, index) => {
    updatesById.set(stage.id, { order_index: index, parent_stage_id: sourceParentId });
  });
  nextTargetList.forEach((stage, index) => {
    updatesById.set(stage.id, { order_index: index, parent_stage_id: targetParentId });
  });

  return stages.map((stage) => {
    const update = updatesById.get(stage.id);
    return update ? { ...stage, ...update } : stage;
  });
}

function buildReorderUpdatesFromStages(stages: StageRow[]): StageReorderUpdate[] {
  const activeStages = stages.filter((stage) => stage.is_active);
  const roots = activeStages
    .filter((stage) => stage.parent_stage_id === null)
    .sort((a, b) => a.order_index - b.order_index);
  const substagesByParent = getSubstagesByParent(activeStages);
  const updates: StageReorderUpdate[] = [];

  roots.forEach((stage, index) => {
    updates.push({ id: stage.id, order_index: index, parent_stage_id: null });
  });
  for (const [parentId, list] of substagesByParent.entries()) {
    list.forEach((stage, index) => {
      updates.push({ id: stage.id, order_index: index, parent_stage_id: parentId });
    });
  }

  return updates;
}

function hasPositionChanges(before: StageRow[], after: StageRow[]) {
  const beforeById = new Map(before.map((stage) => [stage.id, stage]));
  return after.some((stage) => {
    const previous = beforeById.get(stage.id);
    return (
      previous &&
      (previous.order_index !== stage.order_index ||
        previous.parent_stage_id !== stage.parent_stage_id)
    );
  });
}

export function EtapasSettings() {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [dragPreviewStages, setDragPreviewStages] = useState<StageRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [editStage, setEditStage] = useState<StageRow | null>(null);
  const [impactStage, setImpactStage] = useState<StageRow | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showInactive, setShowInactive] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [pendingReorderIds, setPendingReorderIds] = useState<Set<string>>(() => new Set());
  const dragStartStagesRef = useRef<StageRow[] | null>(null);

  const displayStages = dragPreviewStages ?? stages;

  const loadStages = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/admin/pipeline-stages", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ kind: "error", text: payload.error ?? "Não foi possível carregar etapas." });
        return;
      }
      setDragPreviewStages(null);
      setStages(payload.stages);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStages();
  }, [loadStages]);

  const activeStages = useMemo(
    () => displayStages.filter((s) => s.is_active),
    [displayStages],
  );

  const rootStages = useMemo(
    () =>
      activeStages
        .filter((s) => s.parent_stage_id === null)
        .sort((a, b) => a.order_index - b.order_index),
    [activeStages],
  );

  const substagesByParent = useMemo(() => {
    const map = new Map<string, StageRow[]>();
    for (const stage of activeStages) {
      if (!stage.parent_stage_id) continue;
      const list = map.get(stage.parent_stage_id) ?? [];
      list.push(stage);
      map.set(stage.parent_stage_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.order_index - b.order_index);
    }
    return map;
  }, [activeStages]);

  const inactiveStages = useMemo(
    () =>
      displayStages
        .filter((s) => !s.is_active)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [displayStages],
  );

  const totalSubstages = useMemo(
    () => activeStages.filter((s) => s.parent_stage_id).length,
    [activeStages],
  );
  const totalWithSla = useMemo(
    () => activeStages.filter((s) => s.sla_amount && s.sla_amount > 0).length,
    [activeStages],
  );
  const totalWithFollowup = useMemo(
    () => activeStages.filter((s) => s.followup_days && s.followup_days > 0).length,
    [activeStages],
  );

  function toggleExpanded(id: string) {
    setExpanded((curr) => ({ ...curr, [id]: !curr[id] }));
  }

  async function createStage(payload: Parameters<typeof onCreate>[0]) {
    return onCreate(payload);
  }

  async function onCreate(
    payload: Omit<StageRow, "id" | "is_active"> & { is_active?: boolean },
  ) {
    const response = await fetch("/api/admin/pipeline-stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Falha ao criar.");
    }
    setStages((curr) => [...curr, data.stage as StageRow]);
    setMessage({ kind: "success", text: "Etapa criada com sucesso." });
  }

  async function onSaveEdit(id: string, changes: Partial<StageRow>) {
    const response = await fetch(`/api/admin/pipeline-stages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Falha ao salvar.");
    }
    setStages((curr) =>
      curr.map((item) => (item.id === id ? ({ ...item, ...data.stage } as StageRow) : item)),
    );
    setMessage({ kind: "success", text: "Etapa atualizada." });
  }

  async function onConfirmDeactivate({
    stageId,
    targetStageId,
  }: {
    stageId: string;
    targetStageId: string | null;
  }) {
    if (targetStageId) {
      const migrateRes = await fetch(`/api/admin/pipeline-stages/${stageId}/migrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_stage_id: targetStageId }),
      });
      const migrateData = await migrateRes.json();
      if (!migrateRes.ok) {
        throw new Error(migrateData.error ?? "Falha ao migrar.");
      }
      setMessage({
        kind: "success",
        text: `Migrados ${migrateData.clientes_migrated} clientes e ${migrateData.tasks_migrated} tasks.`,
      });
    }

    const deleteRes = await fetch(`/api/admin/pipeline-stages/${stageId}`, {
      method: "DELETE",
    });
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok) {
      throw new Error(deleteData.error ?? "Falha ao desativar.");
    }
    setStages((curr) =>
      curr.map((item) => (item.id === stageId ? { ...item, is_active: false } : item)),
    );
    setMessage({ kind: "success", text: "Etapa desativada." });
    setImpactStage(null);
  }

  async function onReactivate(id: string) {
    try {
      await onSaveEdit(id, { is_active: true } as Partial<StageRow>);
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : "Falha." });
    }
  }

  async function applyReorder(updates: StageReorderUpdate[]) {
    const previousStages = stages;
    const pendingIds = new Set(updates.map((update) => update.id));

    setReordering(true);
    setPendingReorderIds(pendingIds);
    setMessage(null);
    setStages((curr) => applyStageReorderProjection(curr, updates));

    try {
      const response = await fetch("/api/admin/pipeline-stages/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Falha ao reordenar.");
      }
      const updatedById = new Map<string, StageRow>(
        (data.stages as StageRow[]).map((s) => [s.id, s]),
      );
      setStages((curr) => curr.map((item) => updatedById.get(item.id) ?? item));
      setMessage({ kind: "success", text: "Ordem atualizada." });
    } catch (err) {
      setStages(previousStages);
      setMessage({
        kind: "error",
        text:
          err instanceof Error
            ? `${err.message} A lista foi recarregada.`
            : "Não foi possível salvar a nova ordem. A lista foi recarregada.",
      });
      await loadStages({ showLoading: false });
    } finally {
      setReordering(false);
      setPendingReorderIds(new Set());
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const collisionDetection = useCallback<CollisionDetection>(
    (args) => {
      const activeDesc = decodeId(String(args.active.id));
      if (activeDesc?.type !== "sub") return closestCenter(args);

      const substageDroppables = args.droppableContainers.filter(
        (container) => decodeId(String(container.id))?.type === "sub",
      );
      if (substageDroppables.length === 0) return closestCenter(args);

      const pointerSubstageCollisions = pointerWithin({
        ...args,
        droppableContainers: substageDroppables,
      });
      if (pointerSubstageCollisions.length > 0) return pointerSubstageCollisions;

      if (args.pointerCoordinates) {
        const containingRoot = args.droppableContainers.find((container) => {
          const desc = decodeId(String(container.id));
          if (desc?.type !== "root") return false;
          const rect = args.droppableRects.get(container.id);
          return rect ? isPointInsideRect(args.pointerCoordinates!, rect) : false;
        });
        const containingRootDesc = containingRoot ? decodeId(String(containingRoot.id)) : null;

        if (containingRootDesc?.type === "root") {
          const containedSubstageIds = new Set(
            (substagesByParent.get(containingRootDesc.id) ?? []).map((stage) =>
              encodeId({ type: "sub", id: stage.id }),
            ),
          );
          const containedSubstageDroppables = substageDroppables.filter((container) =>
            containedSubstageIds.has(String(container.id)),
          );

          if (containedSubstageDroppables.length > 0) {
            return closestCenter({
              ...args,
              droppableContainers: containedSubstageDroppables,
            });
          }
        }
      }

      const intersectingSubstages = rectIntersection({
        ...args,
        droppableContainers: substageDroppables,
      });
      if (intersectingSubstages.length > 0) return intersectingSubstages;

      return closestCenter(args);
    },
    [substagesByParent],
  );

  function findStage(id: string, source: StageRow[] = stages): StageRow | undefined {
    return findStageIn(source, id);
  }

  function handleDragStart(event: DragStartEvent) {
    if (reordering) return;
    dragStartStagesRef.current = stages;
    setDragPreviewStages(null);
    setActiveDragId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    if (reordering) return;
    const fromDesc = decodeId(String(event.active.id));
    const toDesc = event.over ? decodeId(String(event.over.id)) : null;
    if (fromDesc?.type !== "sub" || !toDesc) return;

    setDragPreviewStages((currentPreview) => {
      const baseStages = currentPreview ?? dragStartStagesRef.current ?? stages;
      return (
        projectSubstageMove(baseStages, fromDesc.id, toDesc, {
          allowSameParentReorder: currentPreview !== null,
        }) ?? currentPreview
      );
    });
  }

  function handleDragCancel() {
    setActiveDragId(null);
    setDragPreviewStages(null);
    dragStartStagesRef.current = null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const previewStages = dragPreviewStages;
    const dragStartStages = dragStartStagesRef.current ?? stages;
    setActiveDragId(null);
    setDragPreviewStages(null);
    dragStartStagesRef.current = null;
    if (reordering) return;
    if (!over) return;
    const fromDesc = decodeId(String(active.id));
    const toDesc = decodeId(String(over.id));
    if (!fromDesc || !toDesc) return;
    if (fromDesc.type === "root" && toDesc.type === "root" && fromDesc.id === toDesc.id) return;

    if (previewStages && fromDesc.type === "sub") {
      if (!hasPositionChanges(dragStartStages, previewStages)) return;
      await applyReorder(buildReorderUpdatesFromStages(previewStages));
      return;
    }

    if (fromDesc.type === "sub" && toDesc.type === "sub" && fromDesc.id === toDesc.id) return;

    const sourceStage = findStage(fromDesc.id);
    if (!sourceStage) return;
    const sourceParentId = sourceStage.parent_stage_id;
    const targetStage = findStage(toDesc.id);
    const targetParentId = toDesc.type === "sub" ? (targetStage?.parent_stage_id ?? null) : null;

    // Bloqueia mover etapa final para subetapa
    if (sourceStage.is_final && toDesc.type !== "root") {
      setMessage({ kind: "error", text: "Etapas finais não podem ser subetapas." });
      return;
    }

    // Bloqueia mover etapa-mãe que tem subetapas para virar subetapa
    const sourceHasChildren = (substagesByParent.get(sourceStage.id) ?? []).length > 0;
    if (sourceHasChildren && toDesc.type !== "root") {
      setMessage({
        kind: "error",
        text: "Etapas com subetapas não podem virar subetapa (limite de 2 níveis).",
      });
      return;
    }

    // Caso 1: reorder entre etapas-mãe
    if (fromDesc.type === "root" && toDesc.type === "root") {
      const oldIndex = rootStages.findIndex((s) => s.id === fromDesc.id);
      const newIndex = rootStages.findIndex((s) => s.id === toDesc.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(rootStages, oldIndex, newIndex);
      const updates: StageReorderUpdate[] = reordered.map((s, idx) => ({
        id: s.id,
        order_index: idx,
        parent_stage_id: null,
      }));
      await applyReorder(updates);
      return;
    }

    // Caso 2: reorder dentro de uma mesma mãe (subs)
    if (fromDesc.type === "sub" && toDesc.type === "sub" && sourceParentId === targetParentId && sourceParentId) {
      const subs = substagesByParent.get(sourceParentId) ?? [];
      const oldIndex = subs.findIndex((s) => s.id === fromDesc.id);
      const newIndex = subs.findIndex((s) => s.id === toDesc.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const reordered = arrayMove(subs, oldIndex, newIndex);
      const updates: StageReorderUpdate[] = reordered.map((s, idx) => ({
        id: s.id,
        order_index: idx,
        parent_stage_id: sourceParentId,
      }));
      await applyReorder(updates);
      return;
    }

    // Caso 3: mudou de pai (sub→outra-mãe, root→sub, sub→root)
    let newParentId: string | null = null;
    let insertIndex = 0;

    if (toDesc.type === "root") {
      // Soltou sobre uma etapa-mãe: vira sub dela
      // exceto se for a própria etapa origem
      if (toDesc.id === fromDesc.id) return;
      newParentId = toDesc.id;
      insertIndex = (substagesByParent.get(toDesc.id) ?? []).length;
    } else if (toDesc.type === "sub") {
      newParentId = targetParentId;
      if (!newParentId) return;
      const subs = substagesByParent.get(newParentId) ?? [];
      insertIndex = subs.findIndex((s) => s.id === toDesc.id);
      if (insertIndex < 0) insertIndex = subs.length;
    }

    // Quando o destino é uma etapa-mãe que já é subetapa, bloqueia
    if (newParentId) {
      const newParent = findStage(newParentId);
      if (newParent?.parent_stage_id) {
        setMessage({
          kind: "error",
          text: "Hierarquia limitada a 2 níveis.",
        });
        return;
      }
    }

    // Constrói lista projetada
    let projectedRoots = rootStages.filter((s) => s.id !== fromDesc.id);
    const projectedSubs = new Map<string, StageRow[]>();
    for (const [pid, list] of substagesByParent.entries()) {
      projectedSubs.set(
        pid,
        list.filter((s) => s.id !== fromDesc.id),
      );
    }

    if (newParentId === null) {
      // virou root
      projectedRoots = [...projectedRoots, sourceStage];
      // se quiser inserir em posição específica, refazer com toDesc
    } else {
      const subs = projectedSubs.get(newParentId) ?? [];
      const before = subs.slice(0, insertIndex);
      const after = subs.slice(insertIndex);
      projectedSubs.set(newParentId, [...before, sourceStage, ...after]);
    }

    const updates: StageReorderUpdate[] = [];
    projectedRoots.forEach((s, idx) => {
      updates.push({ id: s.id, order_index: idx, parent_stage_id: null });
    });
    for (const [pid, list] of projectedSubs.entries()) {
      list.forEach((s, idx) => {
        updates.push({ id: s.id, order_index: idx, parent_stage_id: pid });
      });
    }
    await applyReorder(updates);
  }

  const draggedDescriptor = activeDragId ? decodeId(activeDragId) : null;
  const draggedStage = draggedDescriptor ? findStage(draggedDescriptor.id) : undefined;

  return (
    <div className="settings-section">
      <header className="settings-section-header">
        <div>
          <p className="auth-eyebrow">Funil</p>
          <h2>Etapas e SLAs</h2>
          <p>
            Configure as etapas-mãe, suas subetapas e os prazos (SLA + follow-up). Arraste pela
            alça <GripVertical className="settings-inline-icon" aria-hidden /> para reordenar ou
            mover entre níveis.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateParentId(null);
            setCreateOpen(true);
          }}
        >
          <Plus />
          Nova etapa
        </Button>
      </header>

      <div className="settings-summary">
        <SummaryCard label="Etapas-mãe" value={rootStages.length} />
        <SummaryCard label="Subetapas ativas" value={totalSubstages} />
        <SummaryCard label="Com SLA" value={totalWithSla} icon={<Timer />} />
        <SummaryCard label="Com Follow-up" value={totalWithFollowup} icon={<Clock />} />
      </div>

      {message ? (
        <div
          className={`settings-alert settings-alert--${message.kind}`}
          role="status"
          onClick={() => setMessage(null)}
        >
          {message.kind === "success" ? <CheckCircle2 /> : <AlertTriangle />}
          <span>{message.text}</span>
        </div>
      ) : null}

      {reordering ? (
        <div className="settings-alert settings-alert--info">
          <Loader2 className="settings-spin" />
          <span>Ordem aplicada. Salvando…</span>
        </div>
      ) : null}

      <section
        className={`settings-stage-list${reordering ? " is-reordering" : ""}`}
        aria-label="Etapas do funil"
        aria-busy={reordering}
      >
        {loading ? (
          <div className="settings-empty panel-card">Carregando etapas…</div>
        ) : rootStages.length === 0 ? (
          <div className="settings-empty panel-card">
            <Workflow />
            <p>Nenhuma etapa cadastrada ainda. Clique em "Nova etapa" para começar.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={rootStages.map((s) => encodeId({ type: "root", id: s.id }))}
              strategy={verticalListSortingStrategy}
            >
              <ol className="settings-dnd-list">
                {rootStages.map((stage, index) => (
                  <RootStageCard
                    key={stage.id}
                    stage={stage}
                    index={index}
                    substages={substagesByParent.get(stage.id) ?? []}
                    expanded={expanded[stage.id] ?? true}
                    onToggle={() => toggleExpanded(stage.id)}
                    onEdit={() => setEditStage(stage)}
                    onDeactivate={() => setImpactStage(stage)}
                    onAddSub={() => {
                      setCreateParentId(stage.id);
                      setCreateOpen(true);
                    }}
                    onEditSub={(sub) => setEditStage(sub)}
                    onDeactivateSub={(sub) => setImpactStage(sub)}
                    isReordering={reordering}
                    savingStageIds={pendingReorderIds}
                  />
                ))}
              </ol>
            </SortableContext>
            <DragOverlay>
              {draggedStage && draggedDescriptor?.type === "sub" ? (
                <SubStageDragOverlay stage={draggedStage} />
              ) : draggedStage ? (
                <RootStageDragOverlay stage={draggedStage} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </section>

      {inactiveStages.length > 0 ? (
        <section className="settings-inactive">
          <button
            type="button"
            className="settings-inactive-toggle"
            onClick={() => setShowInactive((v) => !v)}
          >
            {showInactive ? <ChevronDown /> : <ChevronRight />}
            <span>
              Etapas inativas ({inactiveStages.length})
            </span>
          </button>
          {showInactive ? (
            <ul className="settings-inactive-list">
              {inactiveStages.map((stage) => (
                <li key={stage.id} className="settings-inactive-row panel-card">
                  <span
                    className="settings-stage-color"
                    style={{ background: stage.color }}
                    aria-hidden
                  />
                  <span className="settings-inactive-name">{stage.name}</span>
                  <code>{stage.slug}</code>
                  <Button type="button" size="sm" variant="ghost" onClick={() => void onReactivate(stage.id)}>
                    <TrendingUp /> Reativar
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <StageCreateDialog
        open={createOpen}
        defaultParentId={createParentId}
        parents={rootStages.map((s) => ({ id: s.id, name: s.name }))}
        nextOrderIndex={
          createParentId
            ? (substagesByParent.get(createParentId)?.length ?? 0)
            : rootStages.length
        }
        onClose={() => setCreateOpen(false)}
        onCreate={async (payload) => {
          try {
            await createStage(payload);
          } catch (err) {
            throw err instanceof Error ? err : new Error("Falha ao criar.");
          }
        }}
      />

      <StageEditSheet
        open={!!editStage}
        stage={editStage}
        onClose={() => setEditStage(null)}
        onSave={onSaveEdit}
      />

      <StageImpactDialog
        open={!!impactStage}
        stageId={impactStage?.id ?? null}
        stageName={impactStage?.name ?? ""}
        destinations={rootStages
          .filter((s) => s.id !== impactStage?.id)
          .map((s) => ({ id: s.id, name: s.name }))}
        onClose={() => setImpactStage(null)}
        onConfirm={onConfirmDeactivate}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="settings-summary-card">
      <span className="settings-summary-card-label">
        {icon ? <span className="settings-summary-card-icon">{icon}</span> : null}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function RootStageDragOverlay({ stage }: { stage: StageRow }) {
  return (
    <div className="settings-stage settings-stage--overlay">
      <GripVertical className="settings-stage-grip" />
      <span
        className="settings-stage-color"
        style={{ background: stage.color }}
        aria-hidden
      />
      <strong>{stage.name}</strong>
    </div>
  );
}

function SubStageDragOverlay({ stage }: { stage: StageRow }) {
  return (
    <div className="settings-substage settings-substage--overlay">
      <GripVertical className="settings-substage-grip" />
      <span className="settings-substage-prefix" aria-hidden>
        <CornerDownRight />
      </span>
      <span className="settings-stage-color" aria-hidden style={{ background: stage.color }} />
      <span className="settings-substage-name">{stage.name}</span>
      <code className="settings-substage-slug">{stage.slug}</code>
      {stage.sla_amount ? (
        <span className="settings-substage-sla">
          <Timer /> {stage.sla_amount} {slaUnitShort[stage.sla_unit]}
        </span>
      ) : (
        <span className="settings-substage-sla settings-substage-sla--muted">SLA herdado</span>
      )}
    </div>
  );
}

interface RootStageCardProps {
  stage: StageRow;
  index: number;
  substages: StageRow[];
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onAddSub: () => void;
  onEditSub: (sub: StageRow) => void;
  onDeactivateSub: (sub: StageRow) => void;
  isReordering: boolean;
  savingStageIds: Set<string>;
}

function RootStageCard({
  stage,
  index,
  substages,
  expanded,
  onToggle,
  onEdit,
  onDeactivate,
  onAddSub,
  onEditSub,
  onDeactivateSub,
  isReordering,
  savingStageIds,
}: RootStageCardProps) {
  const id = encodeId({ type: "root", id: stage.id });
  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({
    id,
    disabled: isReordering,
  });
  const isSaving = savingStageIds.has(stage.id);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    borderLeftColor: stage.color,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`settings-stage panel-card${isSaving ? " is-saving" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <header className="settings-stage-header">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="settings-stage-grip"
          aria-label="Arrastar"
          disabled={isReordering}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </button>
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
          <div className="settings-stage-title">
            <span className="settings-stage-order">{index + 1}.</span>
            <strong>{stage.name}</strong>
            {stage.is_final ? (
              <span className="settings-stage-flag">
                <Flag /> Final
              </span>
            ) : null}
          </div>
          <div className="settings-stage-meta">
            <code>{stage.slug}</code>
            <span>·</span>
            <span>
              {substages.length} subetapa{substages.length === 1 ? "" : "s"}
            </span>
            {stage.sla_amount ? (
              <>
                <span>·</span>
                <span className="settings-stage-meta-pill">
                  <Timer /> {stage.sla_amount} {slaUnitShort[stage.sla_unit]}
                </span>
              </>
            ) : null}
            {stage.followup_days ? (
              <>
                <span>·</span>
                <span className="settings-stage-meta-pill">
                  <Clock /> Follow-up {stage.followup_days}d
                </span>
              </>
            ) : null}
          </div>
        </div>

        {isSaving ? (
          <span className="settings-stage-save-status">
            <Loader2 className="settings-spin" />
            Salvando
          </span>
        ) : null}

        <div className="settings-stage-actions">
          <Button type="button" size="sm" variant="ghost" onClick={onAddSub} title="Adicionar subetapa">
            <Plus />
            Subetapa
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onEdit} title="Editar">
            <Pencil />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDeactivate}
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
              Sem subetapas. Clique em "Subetapa" para adicionar, ou arraste outra etapa-mãe para cá.
            </p>
          ) : (
            <SortableContext
              items={substages.map((s) =>
                encodeId({ type: "sub", id: s.id }),
              )}
              strategy={verticalListSortingStrategy}
            >
              <ol className="settings-substage-items">
                {substages.map((sub, subIndex) => (
                  <SubStageRow
                    key={sub.id}
                    stage={sub}
                    index={subIndex}
                    onEdit={() => onEditSub(sub)}
                    onDeactivate={() => onDeactivateSub(sub)}
                    isReordering={isReordering}
                    isSaving={savingStageIds.has(sub.id)}
                  />
                ))}
              </ol>
            </SortableContext>
          )}
        </div>
      ) : null}
    </li>
  );
}

interface SubStageRowProps {
  stage: StageRow;
  index: number;
  onEdit: () => void;
  onDeactivate: () => void;
  isReordering: boolean;
  isSaving: boolean;
}

function SubStageRow({
  stage,
  index,
  onEdit,
  onDeactivate,
  isReordering,
  isSaving,
}: SubStageRowProps) {
  const id = encodeId({ type: "sub", id: stage.id });
  const {
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({
    id,
    disabled: isReordering,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`settings-substage${isSaving ? " is-saving" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        className="settings-substage-grip"
        aria-label="Arrastar"
        disabled={isReordering}
        {...attributes}
        {...listeners}
      >
        <GripVertical />
      </button>
      <span className="settings-substage-prefix" aria-hidden>
        <CornerDownRight />
      </span>
      <span className="settings-stage-color" aria-hidden style={{ background: stage.color }} />
      <span className="settings-substage-order">{index + 1}.</span>
      <span className="settings-substage-name">{stage.name}</span>
      <code className="settings-substage-slug">{stage.slug}</code>
      {stage.sla_amount ? (
        <span className="settings-substage-sla">
          <Timer /> {stage.sla_amount} {slaUnitShort[stage.sla_unit]}
        </span>
      ) : (
        <span className="settings-substage-sla settings-substage-sla--muted">SLA herdado</span>
      )}
      {isSaving ? (
        <span className="settings-substage-save-status">
          <Loader2 className="settings-spin" />
          Salvando
        </span>
      ) : null}
      <div className="settings-substage-actions">
        <Button type="button" size="sm" variant="ghost" onClick={onEdit} title="Editar">
          <Pencil />
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDeactivate} title="Desativar">
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}
