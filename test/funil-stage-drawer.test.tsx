import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { FunilStageDrawer } from "@/components/dashboard/funil-stage-drawer";
import type { StageSummary } from "@/lib/funil/computeMetrics";
import type { FunilData, FunilRow } from "@/lib/types";

const stage: StageSummary = {
  slug: "mais-novo",
  name: "Mais novo",
  color: "#10b981",
  order_index: 1,
  is_final: false,
  clientes: 4,
  valor: 85000,
  valorLabel: "R$ 85.000,00",
  leadTimes: [0.5, 3.25, 8, 1.2],
  meanDays: 3.24,
  medianDays: 2.22,
  minDays: 0.5,
  maxDays: 8,
  bottleneck: false,
  slaAmount: 1,
  slaUnit: "business_days",
  slaOverdue: 1,
  slaWarning: 1,
  slaOk: 1,
};

const rows: FunilRow[] = [
  {
    c: "cliente-overdue",
    s: "mais-novo",
    d: 3.25,
    a: "2026-05-14",
    l: "cliente-overdue",
    slaStatus: "overdue",
    slaHoursRemaining: -6,
  },
  {
    c: "cliente-warning",
    s: "mais-novo",
    d: 0.5,
    a: "2026-05-17",
    l: "cliente-warning",
    slaStatus: "warning",
    slaHoursRemaining: 2,
  },
  {
    c: "cliente-ok",
    s: "mais-novo",
    d: 1.2,
    a: "2026-05-16",
    l: "cliente-ok",
    slaStatus: "ok",
    slaHoursRemaining: 18,
  },
  {
    c: "cliente-none",
    s: "mais-novo",
    d: 8,
    a: "2026-05-10",
    l: "cliente-none",
    slaStatus: "none",
    slaHoursRemaining: null,
  },
];

const clients: FunilData["clients_map"] = {
  "cliente-overdue": {
    id: "cliente-overdue",
    nome: "Cliente Atrasado Com Nome Completo",
    whatsapp: null,
    valor: 42123.45,
    responsavelId: "user-1",
    responsavelNome: "Maria Luiza Marques",
    segmentoId: "seg-1",
    segmentoNome: "Saude",
    subsegmentoNome: "Clinica",
    prazoFinal: null,
    celebridade: "Celebridade A",
  },
  "cliente-warning": {
    id: "cliente-warning",
    nome: "Cliente Em Alerta",
    whatsapp: null,
    valor: 21870,
    responsavelId: "user-2",
    responsavelNome: "Giovanna Moraes",
    segmentoId: "seg-2",
    segmentoNome: "Varejo",
    subsegmentoNome: null,
    prazoFinal: null,
    celebridade: null,
  },
  "cliente-ok": {
    id: "cliente-ok",
    nome: "Cliente No Prazo",
    whatsapp: null,
    valor: 15000,
    responsavelId: "user-3",
    responsavelNome: "Emily Soares",
    segmentoId: null,
    segmentoNome: null,
    subsegmentoNome: null,
    prazoFinal: null,
    celebridade: null,
  },
  "cliente-none": {
    id: "cliente-none",
    nome: "Cliente Sem SLA",
    whatsapp: null,
    valor: 6027.47,
    responsavelId: null,
    responsavelNome: null,
    segmentoId: null,
    segmentoNome: null,
    subsegmentoNome: null,
    prazoFinal: null,
    celebridade: null,
  },
};

function renderDrawer() {
  return render(<FunilStageDrawer stage={stage} rows={rows} clients={clients} onClose={vi.fn()} />);
}

describe("FunilStageDrawer", () => {
  beforeAll(() => {
    vi.stubGlobal("React", React);
  });

  it("renders the redesigned operational list with formatted money, time and entry date metadata", () => {
    renderDrawer();

    expect(screen.getByText("Entrou em")).toBeInTheDocument();
    expect(screen.getByText("R$ 42.123,45")).toBeInTheDocument();
    expect(screen.getByText("12h")).toBeInTheDocument();
    expect(screen.getByText("3,3 dias")).toBeInTheDocument();
    expect(screen.getByText("Maria Luiza Marques")).toBeInTheDocument();
    expect(screen.getByText("Cliente Atrasado Com Nome Completo")).toHaveAttribute(
      "title",
      "Cliente Atrasado Com Nome Completo",
    );
  });

  it("filters visible rows by overdue and no-SLA status tabs", () => {
    renderDrawer();

    fireEvent.click(screen.getByRole("button", { name: /Atrasados/i }));
    expect(screen.getByText("Cliente Atrasado Com Nome Completo")).toBeInTheDocument();
    expect(screen.queryByText("Cliente Em Alerta")).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente Sem SLA")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sem SLA/i }));
    expect(screen.getByText("Cliente Sem SLA")).toBeInTheDocument();
    expect(screen.queryByText("Cliente Atrasado Com Nome Completo")).not.toBeInTheDocument();
  });

  it("keeps SLA status counts scoped to the current search result", () => {
    renderDrawer();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "alerta" } });

    const warningTab = screen.getByRole("button", { name: /Em alerta/i });
    expect(within(warningTab).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Atrasados/i })).getByText("0")).toBeInTheDocument();
  });
});
