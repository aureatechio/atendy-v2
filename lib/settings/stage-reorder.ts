export type StageReorderUpdate = {
  id: string;
  order_index: number;
  parent_stage_id: string | null;
};

export type ReorderableStage = {
  id: string;
  order_index: number;
  parent_stage_id: string | null;
};

export function applyStageReorderProjection<TStage extends ReorderableStage>(
  stages: TStage[],
  updates: StageReorderUpdate[],
): TStage[] {
  const updatesById = new Map(updates.map((update) => [update.id, update]));

  return stages.map((stage) => {
    const update = updatesById.get(stage.id);
    if (!update) return stage;

    return {
      ...stage,
      order_index: update.order_index,
      parent_stage_id: update.parent_stage_id,
    };
  });
}
