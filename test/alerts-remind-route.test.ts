import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/alerts/[id]/remind/route";

const serverMock = vi.hoisted(() => ({
  getAlertAuthContext: vi.fn(),
  fetchAccessibleAlertById: vi.fn(),
  remindAlertForUser: vi.fn(),
}));

vi.mock("@/lib/alerts/server", () => serverMock);

const context = {
  user: { id: "user-1" },
  profile: { id: "user-1", role: "attendant" },
  admin: {},
};

const alert = {
  id: "alert-1",
  type: "contract_expiry",
  status: "warning",
  cliente: {
    id: "cliente-1",
    nomecliente: "Cliente Teste",
    nome: null,
    responsavel_atendimento: "user-1",
    assigned_to: null,
  },
};

function request(body: unknown) {
  return new Request("http://localhost/api/alerts/alert-1/remind", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ id: "alert-1" }) };

describe("POST /api/alerts/[id]/remind", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serverMock.getAlertAuthContext.mockResolvedValue({
      ok: true,
      context,
    });
    serverMock.fetchAccessibleAlertById.mockResolvedValue({
      ok: true,
      alert,
    });
    serverMock.remindAlertForUser.mockResolvedValue({
      ok: true,
      notification: { id: "notification-1" },
      snoozedUntil: "2026-05-26T15:05:00.000Z",
    });
  });

  it("rejects unauthenticated users", async () => {
    serverMock.getAlertAuthContext.mockResolvedValue({
      ok: false,
      status: 401,
      error: "Unauthorized",
    });

    const res = await POST(request({ reminder: 5 }), params);

    expect(res.status).toBe(401);
    expect(serverMock.fetchAccessibleAlertById).not.toHaveBeenCalled();
  });

  it("rejects unsupported reminder values", async () => {
    const res = await POST(request({ reminder: 45 }), params);

    expect(res.status).toBe(400);
    expect(serverMock.fetchAccessibleAlertById).not.toHaveBeenCalled();
  });

  it("creates a reminder for accessible alerts", async () => {
    const res = await POST(request({ reminder: 5 }), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      notificationId: "notification-1",
      snoozedUntil: "2026-05-26T15:05:00.000Z",
    });
    expect(serverMock.fetchAccessibleAlertById).toHaveBeenCalledWith(
      context,
      "alert-1",
    );
    expect(serverMock.remindAlertForUser).toHaveBeenCalledWith(
      context,
      alert,
      5,
    );
  });
});
