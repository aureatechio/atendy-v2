import React from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AlertsView } from "@/components/alerts/alerts-view";
import type { Alert } from "@/lib/types";

const refetch = vi.fn();

vi.mock("@/hooks/useAlerts", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useAlerts")>(
    "@/hooks/useAlerts",
  );
  return {
    ...actual,
    useAlerts: () => ({
      allAlerts: alerts,
      loading: false,
      refetch,
    }),
  };
});

const alerts: Alert[] = [
  {
    id: "alert-ana",
    type: "stage_sla",
    status: "overdue",
    firedAt: "2026-05-26T10:00:00.000Z",
    deadline: "2026-05-26T09:00:00.000Z",
    lastSeenAt: "2026-05-26T10:00:00.000Z",
    snoozedUntil: null,
    cliente: {
      id: "cliente-ana",
      nome: "Cliente Ana",
      responsavelId: "user-ana",
      responsavelNome: "Ana Produção",
    },
    stage: {
      id: "stage-1",
      name: "Atendimento",
      slug: "atendimento",
      color: "#2563eb",
    },
    task: null,
  },
  {
    id: "alert-bruno",
    type: "followup",
    status: "warning",
    firedAt: "2026-05-26T10:30:00.000Z",
    deadline: "2026-05-26T12:00:00.000Z",
    lastSeenAt: "2026-05-26T10:30:00.000Z",
    snoozedUntil: null,
    cliente: {
      id: "cliente-bruno",
      nome: "Cliente Bruno",
      responsavelId: "user-bruno",
      responsavelNome: "Bruno CS",
    },
    stage: {
      id: "stage-2",
      name: "Follow-up",
      slug: "follow-up",
      color: "#f59e0b",
    },
    task: null,
  },
];

describe("AlertsView", () => {
  beforeAll(() => {
    vi.stubGlobal("React", React);
  });

  it("mostra nomes dos responsáveis no filtro", () => {
    render(<AlertsView />);

    const select = screen.getByRole("combobox", {
      name: "Filtrar por responsável",
    });

    expect(within(select).getByRole("option", { name: "Ana Produção" })).toHaveValue(
      "user-ana",
    );
    expect(within(select).getByRole("option", { name: "Bruno CS" })).toHaveValue(
      "user-bruno",
    );
    expect(within(select).queryByRole("option", { name: /user-ana/i })).not.toBeInTheDocument();
  });
});
