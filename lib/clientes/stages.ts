import type { ClienteStageSummary } from "@/lib/clientes/types";

export function getActiveParentClienteStages(stages: ClienteStageSummary[]) {
  return stages
    .filter((stage) => stage.is_active && stage.parent_stage_id === null)
    .sort((a, b) => a.order_index - b.order_index);
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
