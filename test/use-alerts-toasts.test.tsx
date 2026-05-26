import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersistentAlertToast } from "@/components/alerts/persistent-alert-toast";
import { useAlerts } from "@/hooks/useAlerts";
import type { Alert } from "@/lib/types";

const toastMock = vi.hoisted(() => ({
  custom: vi.fn(),
  dismiss: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

function alertFixture(overrides: Partial<Alert> = {}): Alert {
  return {
    id: "alert-1",
    type: "contract_expiry",
    status: "warning",
    firedAt: "2026-05-26T10:00:00.000Z",
    deadline: "2026-05-27T02:59:59.999Z",
    lastSeenAt: "2026-05-26T10:00:00.000Z",
    snoozedUntil: null,
    cliente: {
      id: "cliente-1",
      nome: "Cliente Teste",
      responsavelId: "user-1",
      responsavelNome: "Giovanna",
    },
    assignment: {
      responsavelAtendimentoId: "user-1",
      assignedToId: null,
    },
    notification: {
      id: "notification-1",
      state: "pending",
      snoozedUntil: null,
      lastShownAt: null,
      nextToastAt: null,
      shouldToast: true,
    },
    stage: null,
    task: null,
    ...overrides,
  };
}

function Probe() {
  const { allAlerts } = useAlerts({ enableToasts: true });
  return <span data-testid="count">{allAlerts.length}</span>;
}

describe("useAlerts persistent toasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/alerts") {
          return {
            ok: true,
            json: async () => ({
              alerts: [
                alertFixture(),
                alertFixture({
                  id: "alert-2",
                  status: "overdue",
                  notification: {
                    ...alertFixture().notification!,
                    id: "notification-2",
                    shouldToast: true,
                  },
                }),
              ],
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }),
    );
  });

  it("shows persistent toasts for warning and overdue alerts", async () => {
    render(<Probe />);

    await waitFor(() => expect(toastMock.custom).toHaveBeenCalledTimes(2));
    expect(toastMock.custom.mock.calls[0][1]).toMatchObject({
      id: "alert-alert-1",
      duration: Infinity,
    });
    expect(toastMock.custom.mock.calls[1][1]).toMatchObject({
      id: "alert-alert-2",
      duration: Infinity,
    });
  });

  it("logs toast_shown events for displayed alerts", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Probe />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/alerts/toast-events",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            event: "toast_shown",
            alertIds: ["alert-1", "alert-2"],
          }),
        }),
      ),
    );
  });
});

describe("PersistentAlertToast", () => {
  it("calls reminder and open actions", async () => {
    const onOpen = vi.fn();
    const onRemind = vi.fn();
    render(
      <PersistentAlertToast
        alert={alertFixture()}
        typeLabel="Fim de vigência"
        onOpen={onOpen}
        onRemind={onRemind}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "5 min" }));
    await waitFor(() => expect(onRemind).toHaveBeenCalledWith(5));

    fireEvent.click(screen.getByRole("button", { name: "Abrir alerta" }));
    await waitFor(() => expect(onOpen).toHaveBeenCalled());
  });
});
