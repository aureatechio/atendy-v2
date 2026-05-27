import { describe, expect, it } from "vitest";
import { buildClientStageHistoryRow, buildTaskHistoryRow } from "@/lib/audit/history";

describe("audit history builders", () => {
  it("buildClientStageHistoryRow includes operation metadata and changed_by", () => {
    const row = buildClientStageHistoryRow({
      actionType: "stage_change",
      changedBy: "11111111-1111-1111-1111-111111111111",
      clienteId: "22222222-2222-2222-2222-222222222222",
      fromStageId: "33333333-3333-3333-3333-333333333333",
      metadata: { migration: true },
      operationId: "44444444-4444-4444-4444-444444444444",
      toStageId: "55555555-5555-5555-5555-555555555555",
    });

    expect(row).toMatchObject({
      action_type: "stage_change",
      changed_by: "11111111-1111-1111-1111-111111111111",
      cliente_id: "22222222-2222-2222-2222-222222222222",
      from_stage_id: "33333333-3333-3333-3333-333333333333",
      operation_id: "44444444-4444-4444-4444-444444444444",
      to_stage_id: "55555555-5555-5555-5555-555555555555",
    });
    expect(row.metadata).toEqual({
      actor_source: "user",
      migration: true,
      operation_id: "44444444-4444-4444-4444-444444444444",
    });
  });

  it("buildTaskHistoryRow marks service-origin rows when no actor is provided", () => {
    const row = buildTaskHistoryRow({
      actionType: "stage_change",
      clienteId: "22222222-2222-2222-2222-222222222222",
      taskId: "33333333-3333-3333-3333-333333333333",
      toStageId: "44444444-4444-4444-4444-444444444444",
    });

    expect(row.operation_id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(row.changed_by).toBeNull();
    expect(row.metadata).toMatchObject({
      actor_source: "service",
      operation_id: row.operation_id,
    });
  });
});
