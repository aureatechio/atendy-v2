import { describe, expect, it } from "vitest";
import { applyStageReorderProjection } from "@/lib/settings/stage-reorder";

type TestStage = {
  id: string;
  name: string;
  color: string;
  order_index: number;
  parent_stage_id: string | null;
};

const stages: TestStage[] = [
  { id: "briefing", name: "Briefing", color: "#2563eb", order_index: 0, parent_stage_id: null },
  { id: "roteiro", name: "Roteiro", color: "#16a34a", order_index: 1, parent_stage_id: null },
  { id: "edicao", name: "Edicao", color: "#dc2626", order_index: 0, parent_stage_id: "roteiro" },
];

describe("applyStageReorderProjection", () => {
  it("aplica a ordem projetada preservando os demais dados das etapas", () => {
    const result = applyStageReorderProjection(stages, [
      { id: "roteiro", order_index: 0, parent_stage_id: null },
      { id: "briefing", order_index: 1, parent_stage_id: null },
      { id: "edicao", order_index: 0, parent_stage_id: "briefing" },
    ]);

    expect(result).toEqual([
      { id: "briefing", name: "Briefing", color: "#2563eb", order_index: 1, parent_stage_id: null },
      { id: "roteiro", name: "Roteiro", color: "#16a34a", order_index: 0, parent_stage_id: null },
      { id: "edicao", name: "Edicao", color: "#dc2626", order_index: 0, parent_stage_id: "briefing" },
    ]);
  });

  it("mantem etapas sem update exatamente como estavam", () => {
    const result = applyStageReorderProjection(stages, [
      { id: "briefing", order_index: 4, parent_stage_id: null },
    ]);

    expect(result[1]).toBe(stages[1]);
    expect(result[2]).toBe(stages[2]);
  });
});
