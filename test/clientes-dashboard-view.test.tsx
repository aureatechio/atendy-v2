import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientesDashboard } from "@/components/cliente/clientes-dashboard";
import type { ClienteListItem, ClientesData } from "@/lib/clientes/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/(protected)/clientes/[id]/actions", () => ({
  changeStage: vi.fn().mockResolvedValue({ ok: true }),
}));

const baseItem: ClienteListItem = {
  id: "cliente-base",
  code: null,
  nome: "Cliente Base",
  nomeFantasia: null,
  companyName: null,
  companyCnpj: null,
  whatsapp: null,
  email: null,
  instagram: null,
  stageId: null,
  stageName: null,
  stageColor: null,
  stageOrder: 0,
  responsavelId: null,
  responsavelNome: null,
  segmentoId: null,
  segmentoNome: null,
  subsegmentoId: null,
  subsegmentoNome: null,
  celebridade: null,
  praca: null,
  classificacao: null,
  valor: 0,
  prazoFinal: null,
  createdAt: "2026-05-01T12:00:00.000Z",
  stageEnteredAt: null,
  contratoAssinadoAt: null,
  inicioVigencia: null,
  archivedAt: null,
  isArchived: false,
  diasNaEtapa: null,
  tarefasAbertas: 0,
  tarefasUrgentes: 0,
  nextMeetingAt: null,
  lastActivityAt: null,
  linkPastaDrive: null,
  linkProposta: null,
  linkPastaEntrega: null,
};

const data: ClientesData = {
  stages: [
    {
      id: "stage-novo",
      name: "Novo",
      slug: "novo",
      color: "#2563eb",
      order_index: 1,
      is_final: false,
      is_active: true,
    },
  ],
  profiles: [],
  items: [
    { ...baseItem, id: "cliente-acme", nome: "Acme Brasil", stageId: "stage-novo", valor: 1000 },
    { ...baseItem, id: "cliente-beta", nome: "Beta Conteudo", stageId: "stage-novo", valor: 2000 },
  ],
};

describe("ClientesDashboard view switch", () => {
  beforeAll(() => {
    vi.stubGlobal("React", React);
  });

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("abre o Kanban por padrao quando nao ha preferencia salva", () => {
    render(<ClientesDashboard initialData={data} />);

    expect(screen.getByLabelText("Funil kanban de clientes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Kanban/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("alterna para Kanban reaproveitando a busca filtrada", () => {
    window.localStorage.setItem("atendy:clientes:view", "list");
    render(<ClientesDashboard initialData={data} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Busca" }), { target: { value: "acme" } });
    fireEvent.click(screen.getByRole("button", { name: /Kanban/i }));

    expect(screen.getByLabelText("Funil kanban de clientes")).toBeInTheDocument();
    expect(screen.getByText("Acme Brasil")).toBeInTheDocument();
    expect(screen.queryByText("Beta Conteudo")).not.toBeInTheDocument();
  });
});
