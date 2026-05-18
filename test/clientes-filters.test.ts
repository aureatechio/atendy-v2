import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useClientesFilters } from "@/hooks/useClientesFilters";
import type { ClienteListItem, ClientesData } from "@/lib/clientes/types";

const baseItem: ClienteListItem = {
  id: "base",
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

function makeData(items: ClienteListItem[]): ClientesData {
  return {
    items,
    stages: [
      {
        id: "stage-a",
        name: "Briefing",
        slug: "briefing",
        color: "#2563eb",
        order_index: 1,
        is_final: false,
        is_active: true,
      },
    ],
    profiles: [{ id: "user-a", full_name: "Ana Produção", avatar_url: null }],
  };
}

describe("useClientesFilters", () => {
  const data = makeData([
    {
      ...baseItem,
      id: "cliente-a",
      nome: "Acme Brasil",
      code: "CLI-001",
      companyName: "Acme Ltda",
      companyCnpj: "00.000.000/0001-00",
      whatsapp: "11999999999",
      email: "ops@acme.test",
      instagram: "@acme",
      stageId: "stage-a",
      stageName: "Briefing",
      stageOrder: 1,
      responsavelId: "user-a",
      responsavelNome: "Ana Produção",
      segmentoNome: "Alimentos",
      celebridade: "Celebridade A",
      prazoFinal: "2026-05-20",
      createdAt: "2026-05-03T12:00:00.000Z",
      stageEnteredAt: "2026-05-10T12:00:00.000Z",
      valor: 1000,
      diasNaEtapa: 8,
      tarefasAbertas: 2,
      tarefasUrgentes: 1,
      nextMeetingAt: "2026-05-19T12:00:00.000Z",
      lastActivityAt: "2026-05-16T12:00:00.000Z",
    },
    {
      ...baseItem,
      id: "cliente-b",
      nome: "Beta Arquivado",
      isArchived: true,
      createdAt: "2026-04-10T12:00:00.000Z",
      prazoFinal: "2026-05-10",
      valor: 300,
      lastActivityAt: "2026-05-12T12:00:00.000Z",
    },
    {
      ...baseItem,
      id: "cliente-c",
      nome: "Gamma Sem Responsável",
      createdAt: "2026-03-15T12:00:00.000Z",
      prazoFinal: "2026-05-12",
      valor: 2000,
      lastActivityAt: "2026-05-11T12:00:00.000Z",
    },
  ]);

  it("filtra por busca textual e status padrão ativo", () => {
    const { result } = renderHook(() => useClientesFilters(data, { now: new Date("2026-05-18T12:00:00.000Z") }));

    expect(result.current.rows.map((item) => item.id)).toEqual(["cliente-a", "cliente-c"]);

    act(() => result.current.setFilter("search", "acme"));

    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].id).toBe("cliente-a");
  });

  it("filtra período por cadastro, prazo final e mês selecionado", () => {
    const { result } = renderHook(() => useClientesFilters(data, { now: new Date("2026-05-18T12:00:00.000Z") }));

    act(() => result.current.setFilter("period", "monthPick"));
    act(() => result.current.setFilter("monthIndex", 4));
    expect(result.current.rows.map((item) => item.id)).toEqual(["cliente-a"]);

    act(() => result.current.setFilter("periodField", "prazoFinal"));
    expect(result.current.rows.map((item) => item.id)).toEqual(["cliente-a", "cliente-c"]);
  });

  it("filtra arquivados, prazo vencido, sem responsável e tarefa urgente", () => {
    const { result } = renderHook(() => useClientesFilters(data, { now: new Date("2026-05-18T12:00:00.000Z") }));

    act(() => result.current.setFilter("status", "archived"));
    expect(result.current.rows.map((item) => item.id)).toEqual(["cliente-b"]);

    act(() => result.current.setFilter("status", "active"));
    act(() => result.current.setFilter("prazo", "overdue"));
    expect(result.current.rows.map((item) => item.id)).toEqual(["cliente-c"]);

    act(() => result.current.setFilter("prazo", "all"));
    act(() => result.current.setFilter("semResponsavel", true));
    expect(result.current.rows.map((item) => item.id)).toEqual(["cliente-c"]);

    act(() => result.current.setFilter("semResponsavel", false));
    act(() => result.current.setFilter("tarefaUrgente", true));
    expect(result.current.rows.map((item) => item.id)).toEqual(["cliente-a"]);
  });

  it("ordena por valor e expõe chips removíveis", () => {
    const { result } = renderHook(() => useClientesFilters(data, { now: new Date("2026-05-18T12:00:00.000Z") }));

    act(() => result.current.setFilter("sortKey", "valor"));
    act(() => result.current.setFilter("sortDir", "asc"));

    expect(result.current.rows.map((item) => item.id)).toEqual(["cliente-a", "cliente-c"]);

    act(() => result.current.setFilter("search", "gamma"));
    expect(result.current.activeFilterChips.some((chip) => chip.key === "search")).toBe(true);

    act(() => result.current.clearFilter("search"));
    expect(result.current.state.search).toBe("");
  });
});
