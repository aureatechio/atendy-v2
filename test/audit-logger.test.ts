import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  buildAuditDiff,
  createAuditOperationId,
  createServiceAuditActor,
  createSystemAuditActor,
  logAuditEvents,
  mergeAuditMetadata,
  sanitizeAuditValue,
  toAuditRow,
  type AuditEventInput,
} from "@/lib/audit/logger";

describe("audit logger helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("buildAuditDiff returns only shallow changed fields", () => {
    expect(
      buildAuditDiff(
        {
          archived_at: null,
          email: "old@example.com",
          is_archived: false,
          unchanged: "same",
        },
        {
          archived_at: "2026-05-15T19:27:12.825Z",
          email: "new@example.com",
          is_archived: true,
          unchanged: "same",
        },
      ),
    ).toEqual({
      archived_at: {
        after: "2026-05-15T19:27:12.825Z",
        before: null,
      },
      email: {
        after: "new@example.com",
        before: "old@example.com",
      },
      is_archived: {
        after: true,
        before: false,
      },
    });
  });

  it("sanitizeAuditValue redacts sensitive keys recursively", () => {
    expect(
      sanitizeAuditValue({
        email: "user@example.com",
        nested: {
          service_role: "secret",
          token: "abc",
        },
        password: "pass",
        refreshSecret: "hidden",
      }),
    ).toEqual({
      email: "user@example.com",
      nested: {
        service_role: "[REDACTED]",
        token: "[REDACTED]",
      },
      password: "[REDACTED]",
      refreshSecret: "[REDACTED]",
    });
  });

  it("mergeAuditMetadata redacts sensitive data and drops undefined values", () => {
    expect(
      mergeAuditMetadata(
        { operation_id: "op-1", token: "abc" },
        { token: "override", optional: undefined, source: "test" },
      ),
    ).toEqual({
      operation_id: "op-1",
      source: "test",
      token: "[REDACTED]",
    });
  });

  it("creates system/service actors and operation ids", () => {
    expect(createAuditOperationId()).toMatch(/^[0-9a-f-]{36}$/i);
    expect(createSystemAuditActor("cron")).toEqual({
      email: null,
      id: null,
      role: "cron",
      source: "system",
    });
    expect(createServiceAuditActor()).toEqual({
      email: null,
      id: null,
      role: "service",
      source: "service",
    });
  });

  it("toAuditRow preserves actor snapshots, entity data, context, and diff", () => {
    const input: AuditEventInput = {
      action: "cliente.archived",
      actor: {
        email: "admin@example.com",
        id: "11111111-1111-1111-1111-111111111111",
        role: "admin",
        source: "user",
      },
      after: {
        archived_by: "11111111-1111-1111-1111-111111111111",
        is_archived: true,
      },
      before: {
        archived_by: null,
        is_archived: false,
      },
      clienteId: "22222222-2222-2222-2222-222222222222",
      context: {
        requestPath: "/clientes/22222222-2222-2222-2222-222222222222",
        userAgent: "Vitest",
      },
      entityId: "22222222-2222-2222-2222-222222222222",
      entityType: "cliente",
      metadata: {
        reason: "manual",
      },
      operationId: "33333333-3333-3333-3333-333333333333",
    };

    expect(toAuditRow(input)).toEqual({
      action: "cliente.archived",
      actor_email_snapshot: "admin@example.com",
      actor_role_snapshot: "admin",
      actor_source: "user",
      actor_user_id: "11111111-1111-1111-1111-111111111111",
      after: {
        archived_by: "11111111-1111-1111-1111-111111111111",
        is_archived: true,
      },
      before: {
        archived_by: null,
        is_archived: false,
      },
      cliente_id: "22222222-2222-2222-2222-222222222222",
      diff: {
        archived_by: {
          after: "11111111-1111-1111-1111-111111111111",
          before: null,
        },
        is_archived: {
          after: true,
          before: false,
        },
      },
      entity_id: "22222222-2222-2222-2222-222222222222",
      entity_type: "cliente",
      error_message: null,
      metadata: {
        reason: "manual",
      },
      operation_id: "33333333-3333-3333-3333-333333333333",
      request_path: "/clientes/22222222-2222-2222-2222-222222222222",
      status: "success",
      user_agent: "Vitest",
    });
  });

  it("logAuditEvents inserts audit rows in chunks", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ insert }));
    mocks.createAdminClient.mockReturnValue({ from });

    const inputs: AuditEventInput[] = Array.from({ length: 205 }, (_, index) => ({
      action: "test.event",
      entityId: "22222222-2222-2222-2222-222222222222",
      entityType: "test",
      metadata: { index },
    }));

    await expect(logAuditEvents(inputs)).resolves.toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("audit_events");
    expect(insert).toHaveBeenCalledTimes(3);
    expect(insert.mock.calls[0][0]).toHaveLength(100);
    expect(insert.mock.calls[1][0]).toHaveLength(100);
    expect(insert.mock.calls[2][0]).toHaveLength(5);
  });
});
