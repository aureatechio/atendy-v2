import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

const defaultAlerts: Alert[] = [
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
  {
    id: "alert-carla",
    type: "contract_expiry",
    status: "warning",
    firedAt: "2026-05-26T11:00:00.000Z",
    deadline: "2026-06-05T02:59:59.999Z",
    lastSeenAt: "2026-05-26T11:00:00.000Z",
    snoozedUntil: null,
    cliente: {
      id: "cliente-carla",
      nome: "Cliente Carla",
      responsavelId: "user-carla",
      responsavelNome: "Carla CS",
    },
    stage: null,
    task: null,
  },
];

let alerts: Alert[] = defaultAlerts;

describe("AlertsView", () => {
  beforeAll(() => {
    vi.stubGlobal("React", React);
  });

  beforeEach(() => {
    alerts = defaultAlerts;
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
    expect(within(select).getByRole("option", { name: "Carla CS" })).toHaveValue(
      "user-carla",
    );
    expect(within(select).queryByRole("option", { name: /user-ana/i })).not.toBeInTheDocument();
  });

  it("mostra alerta de fim de vigência no filtro, resumo e contexto da tabela", () => {
    render(<AlertsView />);

    const typeSelect = screen.getByRole("combobox", {
      name: "Filtrar por tipo",
    });

    expect(
      within(typeSelect).getByRole("option", { name: "Fim de vigência" }),
    ).toHaveValue("contract_expiry");
    expect(screen.getAllByText("Fim de vigência").length).toBeGreaterThan(0);
    expect(screen.getByText("Vigência do contrato")).toBeInTheDocument();

    fireEvent.change(typeSelect, {
      target: { value: "contract_expiry" },
    });

    expect(screen.getByText("Cliente Carla")).toBeInTheDocument();
    expect(screen.queryByText("Cliente Ana")).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente Bruno")).not.toBeInTheDocument();
  });

  it("explica quando o filtro de fim de vigência não tem alertas gerados", () => {
    alerts = defaultAlerts.filter((alert) => alert.type !== "contract_expiry");

    render(<AlertsView />);

    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por tipo" }), {
      target: { value: "contract_expiry" },
    });

    expect(
      screen.getByText(
        "Nenhum alerta de vigência aberto. Se há contratos vencidos, aguarde o cron de alertas processar a nova regra.",
      ),
    ).toBeInTheDocument();
  });
});
