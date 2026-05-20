import { describe, expect, it } from "vitest";
import {
  evaluateFollowup,
  type FollowupClienteRow,
  type FollowupStageRow,
} from "@/lib/alerts/evaluateFollowup";

const NOW = new Date("2026-05-20T12:00:00Z");

function makeStages(rows: FollowupStageRow[]) {
  return new Map(rows.map((r) => [r.id, r]));
}

describe("evaluateFollowup", () => {
  it("emits nothing when stage has no followup_days", () => {
    const clientes: FollowupClienteRow[] = [
      { id: "c1", current_stage_id: "s1", stage_entered_at: "2026-04-01T00:00:00Z" },
    ];
    const stages = makeStages([
      { id: "s1", followup_days: null, is_final: false },
    ]);
    const res = evaluateFollowup({
      clientes,
      stageById: stages,
      lastInteractionByCliente: new Map(),
      now: NOW,
    });
    expect(res).toEqual([]);
  });

  it("emits nothing when stage is final", () => {
    const stages = makeStages([
      { id: "s1", followup_days: 3, is_final: true },
    ]);
    const res = evaluateFollowup({
      clientes: [{ id: "c1", current_stage_id: "s1", stage_entered_at: null }],
      stageById: stages,
      lastInteractionByCliente: new Map([["c1", "2026-04-01T00:00:00Z"]]),
      now: NOW,
    });
    expect(res).toEqual([]);
  });

  it("returns ok (no alert) when last interaction is recent", () => {
    const stages = makeStages([
      { id: "s1", followup_days: 10, is_final: false },
    ]);
    const res = evaluateFollowup({
      clientes: [{ id: "c1", current_stage_id: "s1", stage_entered_at: null }],
      stageById: stages,
      lastInteractionByCliente: new Map([["c1", "2026-05-19T12:00:00Z"]]), // 1d atrás
      now: NOW,
    });
    expect(res).toEqual([]);
  });

  it("emits warning at >=80% of the budget", () => {
    const stages = makeStages([
      { id: "s1", followup_days: 10, is_final: false },
    ]);
    // 8.5d atrás de NOW (~85% de 10d)
    const last = new Date(NOW.getTime() - 8.5 * 86_400_000).toISOString();
    const res = evaluateFollowup({
      clientes: [{ id: "c1", current_stage_id: "s1", stage_entered_at: null }],
      stageById: stages,
      lastInteractionByCliente: new Map([["c1", last]]),
      now: NOW,
    });
    expect(res).toHaveLength(1);
    expect(res[0].type).toBe("followup");
    expect(res[0].status).toBe("warning");
  });

  it("emits overdue when budget elapsed", () => {
    const stages = makeStages([
      { id: "s1", followup_days: 3, is_final: false },
    ]);
    const last = new Date(NOW.getTime() - 5 * 86_400_000).toISOString();
    const res = evaluateFollowup({
      clientes: [{ id: "c1", current_stage_id: "s1", stage_entered_at: null }],
      stageById: stages,
      lastInteractionByCliente: new Map([["c1", last]]),
      now: NOW,
    });
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe("overdue");
    expect(res[0].clienteId).toBe("c1");
    expect(res[0].stageId).toBe("s1");
  });

  it("falls back to stage_entered_at when no last interaction recorded", () => {
    const stages = makeStages([
      { id: "s1", followup_days: 3, is_final: false },
    ]);
    const stageEntered = new Date(NOW.getTime() - 5 * 86_400_000).toISOString();
    const res = evaluateFollowup({
      clientes: [
        { id: "c1", current_stage_id: "s1", stage_entered_at: stageEntered },
      ],
      stageById: stages,
      lastInteractionByCliente: new Map(),
      now: NOW,
    });
    expect(res).toHaveLength(1);
    expect(res[0].status).toBe("overdue");
  });
});
