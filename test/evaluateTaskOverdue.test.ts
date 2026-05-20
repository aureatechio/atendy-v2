import { describe, expect, it } from "vitest";
import {
  evaluateTaskOverdue,
  type TaskOverdueRow,
} from "@/lib/alerts/evaluateTaskOverdue";

const NOW = new Date("2026-05-20T12:00:00Z");

function task(overrides: Partial<TaskOverdueRow>): TaskOverdueRow {
  return {
    id: "task-1",
    cliente_id: "c1",
    pipeline_stage_id: "s1",
    status: "a_fazer",
    deadline: null,
    started_at: null,
    created_at: "2026-05-19T00:00:00Z",
    ...overrides,
  };
}

describe("evaluateTaskOverdue", () => {
  it("ignores tasks without a deadline", () => {
    const res = evaluateTaskOverdue({ tasks: [task({})], now: NOW });
    expect(res).toEqual([]);
  });

  it("ignores future deadlines", () => {
    const res = evaluateTaskOverdue({
      tasks: [task({ deadline: "2026-06-01T00:00:00Z" })],
      now: NOW,
    });
    expect(res).toEqual([]);
  });

  it("ignores tasks already concluido", () => {
    const res = evaluateTaskOverdue({
      tasks: [
        task({ deadline: "2026-05-10T00:00:00Z", status: "concluido" }),
      ],
      now: NOW,
    });
    expect(res).toEqual([]);
  });

  it("emits overdue when deadline has passed and task is pending", () => {
    const res = evaluateTaskOverdue({
      tasks: [task({ deadline: "2026-05-10T00:00:00Z", status: "fazendo" })],
      now: NOW,
    });
    expect(res).toHaveLength(1);
    expect(res[0].type).toBe("task_overdue");
    expect(res[0].status).toBe("overdue");
    expect(res[0].taskId).toBe("task-1");
    expect(res[0].clienteId).toBe("c1");
    expect(res[0].stageId).toBe("s1");
  });

  it("ignores tasks without cliente_id", () => {
    const res = evaluateTaskOverdue({
      tasks: [
        task({
          deadline: "2026-05-10T00:00:00Z",
          cliente_id: null,
        }),
      ],
      now: NOW,
    });
    expect(res).toEqual([]);
  });
});
