import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  requireAdminAccess: vi.fn(),
}));

vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdminAccess: mocks.requireAdminAccess,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

describe("GET /api/admin/audit-events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks users without auditArea access", async () => {
    mocks.requireAdminAccess.mockResolvedValue({
      error: new Response(JSON.stringify({ error: "Acesso negado." }), { status: 403 }),
    });

    const { GET } = await import("@/app/api/admin/audit-events/route");
    const response = await GET(new Request("http://test.local/api/admin/audit-events"));

    expect(response.status).toBe(403);
    expect(mocks.requireAdminAccess).toHaveBeenCalledWith({ capability: "auditArea" });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });

  it("returns paginated audit rows and applies simple filters", async () => {
    mocks.requireAdminAccess.mockResolvedValue({
      user: { email: "admin@example.com", id: "11111111-1111-1111-1111-111111111111" },
    });

    const auditQuery: Record<string, unknown> = {
      count: 1,
      data: [
        {
          action: "cliente.archived",
          actor_email_snapshot: "admin@example.com",
          actor_role_snapshot: "admin",
          actor_source: "user",
          actor_user_id: "11111111-1111-1111-1111-111111111111",
          after: { is_archived: true },
          before: { is_archived: false },
          cliente_id: null,
          created_at: "2026-05-27T12:00:00.000Z",
          diff: { is_archived: { before: false, after: true } },
          entity_id: "22222222-2222-2222-2222-222222222222",
          entity_type: "cliente",
          error: null,
          error_message: null,
          id: "33333333-3333-3333-3333-333333333333",
          metadata: {},
          operation_id: "44444444-4444-4444-4444-444444444444",
          request_path: "/clientes/22222222-2222-2222-2222-222222222222",
          status: "success",
          user_agent: "Vitest",
        },
      ],
      error: null,
    };
    auditQuery.order = vi.fn(() => auditQuery);
    auditQuery.range = vi.fn(() => auditQuery);
    auditQuery.ilike = vi.fn(() => auditQuery);
    auditQuery.eq = vi.fn(() => auditQuery);

    const auditSelect = vi.fn(() => auditQuery);
    const from = vi.fn((table: string) => {
      if (table === "audit_events") return { select: auditSelect };
      throw new Error(`Unexpected table ${table}`);
    });
    mocks.createAdminClient.mockReturnValue({ from });

    const { GET } = await import("@/app/api/admin/audit-events/route");
    const response = await GET(
      new Request(
        "http://test.local/api/admin/audit-events?action=cliente&operation_id=44444444-4444-4444-4444-444444444444&page=2&pageSize=50",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(auditSelect).toHaveBeenCalledWith(expect.any(String), { count: "exact" });
    expect(auditQuery.range).toHaveBeenCalledWith(50, 99);
    expect(auditQuery.ilike).toHaveBeenCalledWith("action", "%cliente%");
    expect(auditQuery.eq).toHaveBeenCalledWith("operation_id", "44444444-4444-4444-4444-444444444444");
    expect(payload.total).toBe(1);
    expect(payload.events[0].actor).toEqual({
      email: "admin@example.com",
      id: "11111111-1111-1111-1111-111111111111",
      role: "admin",
      source: "user",
    });
  });
});
