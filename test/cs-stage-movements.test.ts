import { describe, expect, it } from "vitest";
import { buildCsStageMovementData, parseCsMovementsPeriod } from "@/lib/cs/movimentacoes";

const stages = [
  { id: "novo", name: "Mais Novo", slug: "mais-novo", color: "#22c55e", order_index: 1 },
  { id: "onboarding", name: "Onboarding", slug: "onboarding", color: "#8b5cf6", order_index: 2 },
  { id: "roteiro", name: "Roteiro", slug: "roteiro", color: "#ec4899", order_index: 3 },
];

const clients = [
  { id: "cliente-1", nomecliente: "Cliente Um", nome: null, nome_fantasia: null, code: "C001" },
  { id: "cliente-2", nomecliente: null, nome: "Cliente Dois", nome_fantasia: null, code: "C002" },
];

const profiles = [
  { id: "user-1", full_name: "Ana CS" },
];

describe("buildCsStageMovementData", () => {
  it("agrupa fluxos de mudança de etapa e calcula clientes únicos", () => {
    const result = buildCsStageMovementData({
      periodLabel: "Mês atual",
      range: { from: "2026-05-01T00:00:00.000Z", to: "2026-05-31T23:59:59.999Z" },
      stages,
      clients,
      profiles,
      history: [
        {
          id: "h1",
          cliente_id: "cliente-1",
          from_stage_id: "novo",
          to_stage_id: "onboarding",
          changed_by: "user-1",
          action_type: "stage_change",
          created_at: "2026-05-10T12:00:00.000Z",
        },
        {
          id: "h2",
          cliente_id: "cliente-2",
          from_stage_id: "novo",
          to_stage_id: "onboarding",
          changed_by: "user-1",
          action_type: "stage_change",
          created_at: "2026-05-11T12:00:00.000Z",
        },
        {
          id: "h3",
          cliente_id: "cliente-1",
          from_stage_id: "onboarding",
          to_stage_id: "roteiro",
          changed_by: null,
          action_type: "stage_change",
          created_at: "2026-05-12T12:00:00.000Z",
        },
      ],
    });

    expect(result.totalMovements).toBe(3);
    expect(result.uniqueClients).toBe(2);
    expect(result.flows[0]).toMatchObject({
      key: "novo->onboarding",
      count: 2,
      uniqueClients: 2,
      percentage: 66.67,
    });
    expect(result.topFlow?.label).toBe("Mais Novo → Onboarding");
  });

  it("ignora ações que não são mudança de etapa", () => {
    const result = buildCsStageMovementData({
      periodLabel: "Mês atual",
      range: { from: null, to: null },
      stages,
      clients,
      profiles,
      history: [
        {
          id: "h1",
          cliente_id: "cliente-1",
          from_stage_id: "novo",
          to_stage_id: "onboarding",
          changed_by: "user-1",
          action_type: "assignment_change",
          created_at: "2026-05-10T12:00:00.000Z",
        },
      ],
    });

    expect(result.totalMovements).toBe(0);
    expect(result.flows).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it("calcula entradas, saídas e saldo por etapa", () => {
    const result = buildCsStageMovementData({
      periodLabel: "Mês atual",
      range: { from: null, to: null },
      stages,
      clients,
      profiles,
      history: [
        {
          id: "h1",
          cliente_id: "cliente-1",
          from_stage_id: "novo",
          to_stage_id: "onboarding",
          changed_by: "user-1",
          action_type: "stage_change",
          created_at: "2026-05-10T12:00:00.000Z",
        },
        {
          id: "h2",
          cliente_id: "cliente-1",
          from_stage_id: "onboarding",
          to_stage_id: "roteiro",
          changed_by: "user-1",
          action_type: "stage_change",
          created_at: "2026-05-11T12:00:00.000Z",
        },
      ],
    });

    expect(result.balances.find((item) => item.stage.id === "novo")).toMatchObject({ entries: 0, exits: 1, net: -1 });
    expect(result.balances.find((item) => item.stage.id === "onboarding")).toMatchObject({ entries: 1, exits: 1, net: 0 });
    expect(result.balances.find((item) => item.stage.id === "roteiro")).toMatchObject({ entries: 1, exits: 0, net: 1 });
    expect(result.biggestPositiveBalance?.stage.name).toBe("Roteiro");
  });

  it("mantém fallback legível para etapas desconhecidas ou nulas", () => {
    const result = buildCsStageMovementData({
      periodLabel: "Mês atual",
      range: { from: null, to: null },
      stages,
      clients,
      profiles,
      history: [
        {
          id: "h1",
          cliente_id: "cliente-1",
          from_stage_id: null,
          to_stage_id: "stage-inexistente",
          changed_by: null,
          action_type: "stage_change",
          created_at: "2026-05-10T12:00:00.000Z",
        },
      ],
    });

    expect(result.flows[0].fromStage.name).toBe("Sem etapa anterior");
    expect(result.flows[0].toStage.name).toBe("Etapa desconhecida");
    expect(result.events[0].changedByName).toBe("Não informado");
  });
});

describe("parseCsMovementsPeriod", () => {
  it("usa mês atual quando o período é inválido", () => {
    const result = parseCsMovementsPeriod(
      { period: "invalido" },
      new Date(2026, 4, 25, 12),
    );

    expect(result.period).toBe("month");
    expect(result.label).toBe("Mês atual");
    expect(result.range.from?.toISOString()).toBe(new Date(2026, 4, 1, 0, 0, 0, 0).toISOString());
  });

  it("aceita período customizado com datas invertidas", () => {
    const result = parseCsMovementsPeriod(
      { period: "custom", from: "2026-05-20", to: "2026-05-05" },
      new Date(2026, 4, 25, 12),
    );

    expect(result.period).toBe("custom");
    expect(result.range.from?.toISOString()).toBe(new Date(2026, 4, 5, 0, 0, 0, 0).toISOString());
    expect(result.range.to?.toISOString()).toBe(new Date(2026, 4, 20, 23, 59, 59, 999).toISOString());
  });
});
