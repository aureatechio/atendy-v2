import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getAuditActor: vi.fn(),
  getAuditRequestContext: vi.fn(),
  logAuditEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/audit/logger", () => ({
  createAuditOperationId: () => "33333333-3333-3333-3333-333333333333",
  getAuditActor: mocks.getAuditActor,
  logAuditEvent: mocks.logAuditEvent,
  mergeAuditMetadata: (...items: Array<Record<string, unknown> | null | undefined>) =>
    Object.assign({}, ...items.filter(Boolean)),
}));

vi.mock("@/lib/audit/request-context", () => ({
  getAuditRequestContext: mocks.getAuditRequestContext,
}));

const user = {
  email: "admin@example.com",
  id: "11111111-1111-1111-1111-111111111111",
};

const actor = {
  email: user.email,
  id: user.id,
  role: "admin",
  source: "user" as const,
};

const context = {
  requestPath: "/clientes/22222222-2222-2222-2222-222222222222",
  userAgent: "Vitest",
};

function makeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn((table: string) => {
      const value = overrides[table];
      if (!value) throw new Error(`Unexpected table ${table}`);
      return value;
    }),
  };
}

describe("cliente actions audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuditActor.mockResolvedValue(actor);
    mocks.getAuditRequestContext.mockResolvedValue(context);
    mocks.logAuditEvent.mockResolvedValue({ ok: true });
  });

  it("setArchived archives with archived_by and an audit event", async () => {
    const clienteId = "22222222-2222-2222-2222-222222222222";
    const current = {
      archived_at: null,
      archived_by: null,
      company_cnpj: "00.000.000/0001-00",
      current_stage_id: "stage-a",
      email: "cliente@example.com",
      is_archived: false,
      responsavel_atendimento: "resp-a",
      whatsapp: "5511999999999",
    };
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({ data: current, error: null }),
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

    const { setArchived } = await import("@/app/(protected)/clientes/[id]/actions");
    const result = await setArchived(clienteId, true);

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        archived_by: user.id,
        is_archived: true,
      }),
    );
    expect(insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: "archived",
        changed_by: user.id,
        cliente_id: clienteId,
        metadata: expect.objectContaining({
          operation_id: expect.any(String),
        }),
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cliente.archived",
        actor,
        before: expect.objectContaining({
          is_archived: false,
        }),
        after: expect.objectContaining({
          archived_by: user.id,
          is_archived: true,
        }),
        clienteId,
        context,
        entityId: clienteId,
        entityType: "cliente",
        operationId: expect.any(String),
      }),
    );
  });

  it("changeStage logs stage changes with operation metadata", async () => {
    const clienteId = "22222222-2222-2222-2222-222222222222";
    const select = vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { current_stage_id: "stage-a" },
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

    const { changeStage } = await import("@/app/(protected)/clientes/[id]/actions");
    const result = await changeStage(clienteId, "stage-b");

    expect(result).toEqual({ ok: true });
    expect(insertHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        action_type: "stage_change",
        changed_by: user.id,
        from_stage_id: "stage-a",
        metadata: expect.objectContaining({
          operation_id: expect.any(String),
        }),
        to_stage_id: "stage-b",
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cliente.stage_changed",
        after: { current_stage_id: "stage-b" },
        before: { current_stage_id: "stage-a" },
        clienteId,
      }),
    );
  });

  it("addComment logs the created comment metadata", async () => {
    const clienteId = "22222222-2222-2222-2222-222222222222";
    const single = vi.fn().mockResolvedValue({ data: { id: "comment-1" }, error: null });
    const select = vi.fn(() => ({ single }));
    const insert = vi.fn(() => ({ select }));
    const supabase = makeSupabase({
      client_comments: { insert },
    });
    mocks.createClient.mockResolvedValue(supabase);

    const { addComment } = await import("@/app/(protected)/clientes/[id]/actions");
    const result = await addComment(clienteId, " Comentário importante para auditoria ");

    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        author_id: user.id,
        cliente_id: clienteId,
        content: "Comentário importante para auditoria",
      }),
    );
    expect(mocks.logAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cliente.comment_added",
        clienteId,
        entityId: "comment-1",
        entityType: "client_comment",
        metadata: expect.objectContaining({
          content_length: 36,
          preview: "Comentário importante para auditoria",
        }),
      }),
    );
  });
});
