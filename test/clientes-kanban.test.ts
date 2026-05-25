import { describe, expect, it } from "vitest";
import { buildClientesKanbanColumns, CLIENTES_NO_STAGE_COLUMN_ID } from "@/lib/clientes/kanban";
import type { ClienteListItem, ClienteStageSummary } from "@/lib/clientes/types";

const baseStage: ClienteStageSummary = {
  id: "stage-base",
  name: "Base",
  slug: "base",
  color: "#64748b",
  order_index: 1,
  is_final: false,
  is_active: true,
};

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

describe("buildClientesKanbanColumns", () => {
  it("ordena etapas ativas, inclui finais e calcula totais por coluna", () => {
    const columns = buildClientesKanbanColumns(
      [
        { ...baseItem, id: "cliente-proposta", nome: "Cliente Proposta", stageId: "stage-proposta", valor: 1500 },
        { ...baseItem, id: "cliente-ganho", nome: "Cliente Ganho", stageId: "stage-ganho", valor: 3000 },
        { ...baseItem, id: "cliente-proposta-2", nome: "Cliente Proposta 2", stageId: "stage-proposta", valor: 700 },
      ],
      [
        { ...baseStage, id: "stage-ganho", name: "Ganhou", slug: "ganhou", color: "#10b981", order_index: 30, is_final: true },
        { ...baseStage, id: "stage-inativa", name: "Inativa", slug: "inativa", order_index: 10, is_active: false },
        { ...baseStage, id: "stage-proposta", name: "Proposta", slug: "proposta", color: "#2563eb", order_index: 20 },
      ],
    );

    expect(columns.map((column) => column.id)).toEqual(["stage-proposta", "stage-ganho"]);
    expect(columns[0]).toMatchObject({
      name: "Proposta",
      count: 2,
      totalValue: 2200,
      isFinal: false,
    });
    expect(columns[0].items.map((item) => item.id)).toEqual(["cliente-proposta", "cliente-proposta-2"]);
    expect(columns[1]).toMatchObject({
      name: "Ganhou",
      count: 1,
      totalValue: 3000,
      isFinal: true,
    });
  });

  it("cria coluna Sem etapa apenas para clientes sem etapa ativa correspondente", () => {
    const columns = buildClientesKanbanColumns(
      [
        { ...baseItem, id: "cliente-qualificado", stageId: "stage-qualificacao", valor: 400 },
        { ...baseItem, id: "cliente-sem-etapa", stageId: null, valor: 250 },
        { ...baseItem, id: "cliente-inativo", stageId: "stage-inativa", valor: 100 },
      ],
      [
        { ...baseStage, id: "stage-qualificacao", name: "Qualificacao", slug: "qualificacao", order_index: 1 },
        { ...baseStage, id: "stage-inativa", name: "Inativa", slug: "inativa", order_index: 2, is_active: false },
      ],
    );

    expect(columns.map((column) => column.id)).toEqual(["stage-qualificacao", CLIENTES_NO_STAGE_COLUMN_ID]);
    expect(columns[0].items.map((item) => item.id)).toEqual(["cliente-qualificado"]);
    expect(columns[1]).toMatchObject({
      name: "Sem etapa",
      count: 2,
      totalValue: 350,
      isFinal: false,
    });
    expect(columns[1].items.map((item) => item.id)).toEqual(["cliente-sem-etapa", "cliente-inativo"]);
  });

  it("omite a coluna Sem etapa quando todos os clientes pertencem a etapas ativas", () => {
    const columns = buildClientesKanbanColumns(
      [{ ...baseItem, id: "cliente-briefing", stageId: "stage-briefing", valor: 100 }],
      [{ ...baseStage, id: "stage-briefing", name: "Briefing", slug: "briefing", order_index: 1 }],
    );

    expect(columns.map((column) => column.id)).toEqual(["stage-briefing"]);
  });
});
