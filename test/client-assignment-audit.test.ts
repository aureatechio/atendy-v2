import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canAccessCS: vi.fn(),
  createClient: vi.fn(),
  getAuditActor: vi.fn(),
  getAuditRequestContext: vi.fn(),
  getAuthSnapshot: vi.fn(),
  logAuditEvent: vi.fn(),
  logAuditEvents: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth/get-auth-snapshot", () => ({
  getAuthSnapshot: mocks.getAuthSnapshot,
}));

vi.mock("@/lib/auth/guards", () => ({
  canAccessCS: mocks.canAccessCS,
}));

vi.mock("@/lib/audit/logger", () => ({
  getAuditActor: mocks.getAuditActor,
  logAuditEvent: mocks.logAuditEvent,
  logAuditEvents: mocks.logAuditEvents,
}));

vi.mock("@/lib/audit/request-context", () => ({
  getAuditRequestContext: mocks.getAuditRequestContext,
}));

const user = {
  email: "admin@example.com",
  id: "11111111-1111-1111-1111-111111111111",
};

const snapshot = {
  status: "active",
  user,
};

const actor = {
  email: user.email,
  id: user.id,
  role: "admin",
  source: "user" as const,
};

const context = {
  requestPath: "/clientes",
  userAgent: "Vitest",
};

function makeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn((table: string) => {
      const value = overrides[table];
      if (!value) throw new Error(`Unexpected table ${table}`);
      return value;
    }),
  };
}

describe("cliente assignment audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canAccessCS.mockReturnValue(true);
    mocks.getAuthSnapshot.mockResolvedValue(snapshot);
    mocks.getAuditActor.mockResolvedValue(actor);
    mocks.getAuditRequestContext.mockResolvedValue(context);
    mocks.logAuditEvent.mockResolvedValue({ ok: true });
    mocks.logAuditEvents.mockResolvedValue({ ok: true });
  });

  it("assignResponsavel logs the reassignment and history operation id", async () => {
    const clienteId = "22222222-2222-2222-2222-222222222222";
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            current_stage_id: "stage-a",
            id: clienteId,
            responsavel_atendimento: "old-user",
          },
          error: null,
        }),
      })),
    }));
    const update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const insertHistory = vi.fn().mockResolvedValue({ error: null });
    const supabase = makeSupabase({
      client_stage_history: { insert: insertHistory },
      clientes_cadastro: { select, update },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const { assignResponsavel } = await import("@/app/(protected)/actions/assign-responsavel");
    const result = await assignResponsavel({
      clienteId,
      responsavelId: "new-user",
    });

    expect(result).toEqual({ ok: true });
    expect(insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: "reassignment",
        changed_by: user.id,
        from_assigned_to: "old-user",
        metadata: expect.objectContaining({
          operation_id: expect.any(String),
        }),
        to_assigned_to: "new-user",
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cliente.responsavel_changed",
        after: { responsavel_atendimento: "new-user", assigned_to: "new-user" },
        before: { responsavel_atendimento: "old-user", assigned_to: "old-user" },
        clienteId,
        operationId: expect.any(String),
      }),
    );
  });

  it("reassignBatch logs one aggregate event and individual reassignment events", async () => {
    const assignments = [
      {
        clienteId: "22222222-2222-2222-2222-222222222222",
        fromAssigneeId: "old-a",
        stageId: "stage-a",
        toAssigneeId: "new-user",
      },
      {
        clienteId: "33333333-3333-3333-3333-333333333333",
        fromAssigneeId: null,
        stageId: "stage-b",
        toAssigneeId: "new-user",
      },
    ];
    const update = vi.fn(() => ({
      in: vi.fn().mockResolvedValue({ error: null }),
    }));
    const insertHistory = vi.fn().mockResolvedValue({ error: null });
    const supabase = makeSupabase({
      client_stage_history: { insert: insertHistory },
      clientes_cadastro: { update },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const { reassignBatch } = await import("@/app/(protected)/cs/forca-tarefa/actions");
    const result = await reassignBatch({
      assignments,
      reason: "redistribuição operacional",
    });

    expect(result.ok).toBe(true);
    expect(mocks.logAuditEvents).toHaveBeenCalledTimes(1);
    const events = mocks.logAuditEvents.mock.calls[0][0];
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual(
      expect.objectContaining({
        action: "cliente.bulk_reassigned",
        entityType: "cliente_batch",
        metadata: expect.objectContaining({
          batch_size: 2,
          reason: "redistribuição operacional",
        }),
        operationId: result.operationId,
      }),
    );
    expect(events.slice(1)).toEqual([
      expect.objectContaining({
        action: "cliente.responsavel_changed",
        after: { responsavel_atendimento: "new-user", assigned_to: "new-user" },
        before: { responsavel_atendimento: "old-a", assigned_to: "old-a" },
        clienteId: assignments[0].clienteId,
        operationId: result.operationId,
      }),
      expect.objectContaining({
        action: "cliente.responsavel_changed",
        after: { responsavel_atendimento: "new-user", assigned_to: "new-user" },
        before: { responsavel_atendimento: null, assigned_to: null },
        clienteId: assignments[1].clienteId,
        operationId: result.operationId,
      }),
    ]);
  });
});
