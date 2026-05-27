import type { ClienteStageSummary } from "@/lib/clientes/types";

export function getActiveParentClienteStages(stages: ClienteStageSummary[]) {
  return stages
    .filter((stage) => stage.is_active && stage.parent_stage_id === null)
    .sort((a, b) => a.order_index - b.order_index);
}

export function getActiveClienteStageFilterOptions(stages: ClienteStageSummary[]) {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));

  return stages
    .filter((stage) => stage.is_active)
    .slice()
    .sort((a, b) => {
      const rootA = getClienteStageRootId(a.id, stageById);
      const rootB = getClienteStageRootId(b.id, stageById);
      const rootStageA = rootA ? stageById.get(rootA) : null;
      const rootStageB = rootB ? stageById.get(rootB) : null;
      const rootOrder = Number(rootStageA?.order_index ?? a.order_index) - Number(rootStageB?.order_index ?? b.order_index);
      if (rootOrder !== 0) return rootOrder;
      if (a.parent_stage_id === null && b.parent_stage_id !== null) return -1;
      if (a.parent_stage_id !== null && b.parent_stage_id === null) return 1;
      const stageOrder = a.order_index - b.order_index;
      if (stageOrder !== 0) return stageOrder;
      return a.name.localeCompare(b.name, "pt-BR");
    })
    .map((stage) => {
      const parent = stage.parent_stage_id ? stageById.get(stage.parent_stage_id) : null;
      return {
        id: stage.id,
        name: parent ? `${parent.name} / ${stage.name}` : stage.name,
      };
    });
}

export function getClienteStageRootId(
  stageId: string | null,
  stageById: Map<string, ClienteStageSummary>,
) {
  if (!stageId) return null;

  let currentId = stageId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const stage = stageById.get(currentId);
    if (!stage) return currentId;
    if (!stage.parent_stage_id) return stage.id;
    currentId = stage.parent_stage_id;
  }

  return currentId || stageId;
}
