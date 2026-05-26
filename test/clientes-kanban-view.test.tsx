import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ClientesKanbanView } from "@/components/cliente/clientes-kanban-view";
import type { ClienteListItem, ClienteStageSummary } from "@/lib/clientes/types";

const stages: ClienteStageSummary[] = [
  {
    id: "stage-novo",
    name: "Novo",
    slug: "novo",
    color: "#2563eb",
    order_index: 1,
    is_final: false,
    is_active: true,
  },
  {
    id: "stage-proposta",
    name: "Proposta",
    slug: "proposta",
    color: "#f97316",
    order_index: 2,
    is_final: false,
    is_active: true,
  },
];

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
  createdAt: null,
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

function dataTransfer() {
  const store = new Map<string, string>();
  return {
    dropEffect: "",
    effectAllowed: "",
    setData: vi.fn((type: string, value: string) => store.set(type, value)),
    getData: vi.fn((type: string) => store.get(type) ?? ""),
  };
}

describe("ClientesKanbanView", () => {
  beforeAll(() => {
    vi.stubGlobal("React", React);
  });

  it("renderiza colunas com totais e cards com metadados do cliente", () => {
    render(
      <ClientesKanbanView
        rows={[
          {
            ...baseItem,
            id: "cliente-a",
            nome: "Acme Brasil",
            code: "CLI-001",
            companyName: "Acme Ltda",
            stageId: "stage-novo",
            responsavelNome: "Ana Producao",
            valor: 1200,
            prazoFinal: "2026-05-30",
            diasNaEtapa: 4,
            tarefasAbertas: 2,
            tarefasUrgentes: 1,
          },
        ]}
        stages={stages}
        movingIds={new Set()}
        onOpenCliente={vi.fn()}
        onMoveCliente={vi.fn()}
      />,
    );

    const novo = screen.getByRole("list", { name: /Novo/i });
    expect(within(novo).getByLabelText("1 cliente")).toBeInTheDocument();
    expect(within(novo).getAllByText("R$ 1.200,00")).toHaveLength(2);
    expect(within(novo).getByText("Acme Brasil")).toBeInTheDocument();
    expect(within(novo).getByText("CLI-001 · Acme Ltda")).toBeInTheDocument();
    expect(within(novo).getByText("Ana Producao")).toBeInTheDocument();
    expect(within(novo).getByText("4d na etapa")).toBeInTheDocument();
    expect(within(novo).getByText("2 tarefas")).toBeInTheDocument();
    expect(within(novo).getByText("1 urgente")).toBeInTheDocument();
    expect(within(novo).getByTitle("Tempo na etapa")).toHaveClass("ds-badge-success");
    expect(within(novo).getByTitle("Prazo")).toHaveClass("ds-badge-warning");
    expect(within(novo).getByTitle("Tarefas abertas")).toHaveClass("ds-badge-danger");
  });

  it("chama onMoveCliente quando um card e solto em outra etapa", () => {
    const onMoveCliente = vi.fn();
    render(
      <ClientesKanbanView
        rows={[{ ...baseItem, id: "cliente-a", nome: "Acme Brasil", stageId: "stage-novo", valor: 1200 }]}
        stages={stages}
        movingIds={new Set()}
        onOpenCliente={vi.fn()}
        onMoveCliente={onMoveCliente}
      />,
    );

    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByTestId("clientes-kanban-card-cliente-a"), { dataTransfer: transfer });
    fireEvent.drop(screen.getByRole("list", { name: /Proposta/i }), { dataTransfer: transfer });

    expect(onMoveCliente).toHaveBeenCalledWith("cliente-a", "stage-proposta");
  });
});
