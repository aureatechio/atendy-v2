import { afterEach, describe, expect, it, vi } from "vitest";
import { buildFunilData, getFunilDados } from "@/lib/api/funil";
import { computeFunilKpis, isBottleneck } from "@/lib/funil/computeMetrics";
import type { FunilData } from "@/lib/types";

const baseData: FunilData = {
  stages_meta: [
    {
      id: "stage-mais-novo",
      slug: "mais-novo",
      name: "Mais Novo",
      order_index: 1,
      color: "#22c55e",
      is_final: false,
      parent_stage_id: null,
      sla_amount: 1,
      sla_unit: "business_days",
      warn_at_percent: 80,
    },
    {
      id: "stage-finalizado",
      slug: "finalizado",
      name: "Finalizado",
      order_index: 2,
      color: "#6b7280",
      is_final: true,
      parent_stage_id: null,
      sla_amount: null,
      sla_unit: "business_days",
      warn_at_percent: 80,
    },
  ],
  valor_map: {
    cliente1: 300,
    cliente2: 500,
    cliente3: 700,
  },
  clients_map: {},
  rows: [
    { c: "100", s: "mais-novo", d: 5, a: "2026-01-05", l: "cliente1" },
    { c: "101", s: "mais-novo", d: 6, a: "2026-01-06", l: "cliente2" },
    { c: "102", s: "mais-novo", d: 8, a: "2026-01-07", l: "cliente2" },
    { c: "103", s: "finalizado", d: 4, a: "2026-01-08", l: "cliente3" },
  ],
};

describe("computeFunilKpis", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falha quando chamado sem request scope (createClient exige cookies do Next)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(getFunilDados()).rejects.toThrow();
  });

  it("deduplica valor por cliente no total", () => {
    const { kpis, stageSummary } = computeFunilKpis(baseData, baseData.rows);
    expect(kpis.clientesUnicos).toBe(4);
    expect(kpis.valorTotal).toBe(1500);
    expect(stageSummary.find((item) => item.slug === "mais-novo")?.valor).toBe(800);
    const final = stageSummary.find((item) => item.is_final);
    expect(final?.clientes).toBe(1);
  });

  it("identifica gargalo", () => {
    expect(isBottleneck({ clientes: 5, meanDays: 45, medianDays: 10 })).toBe(true);
    expect(isBottleneck({ clientes: 1, meanDays: 45, medianDays: 50 })).toBe(false);
  });

  it("ignora tarefas de clientes arquivados ao montar dados remotos", () => {
    const stages = [
      {
        id: "stage-active",
        slug: "onboarding",
        name: "Onboarding",
        color: "#22c55e",
        order_index: 1,
        is_final: false,
        parent_stage_id: null,
        sla_amount: 1,
        sla_unit: "business_days",
        warn_at_percent: 80,
      },
    ];
    const tasks = [
      {
        id: "task-active",
        cliente_id: "client-active",
        pipeline_stage_id: "stage-active",
        status: "a_fazer",
        started_at: "2026-01-10T00:00:00.000Z",
        created_at: "2026-01-10T00:00:00.000Z",
      },
      {
        id: "task-archived",
        cliente_id: "client-archived",
        pipeline_stage_id: "stage-active",
        status: "a_fazer",
        started_at: "2026-01-10T00:00:00.000Z",
        created_at: "2026-01-10T00:00:00.000Z",
      },
    ];
    const clients = [
      {
        id: "client-active",
        valor: 100,
        deal_value: null,
        current_stage_id: "stage-active",
        stage_entered_at: "2026-01-09T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        is_archived: false,
      },
      {
        id: "client-archived",
        valor: 200,
        deal_value: null,
        current_stage_id: "stage-active",
        stage_entered_at: "2026-01-09T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        is_archived: true,
      },
    ];

    const result = buildFunilData(stages, tasks, clients);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      c: "client-active",
      s: "onboarding",
      l: "client-active",
    });
    expect(result.valor_map).toEqual({ "client-active": 100 });
  });

  it("ignora tarefas concluidas ao montar dados remotos", () => {
    const stages = [
      {
        id: "stage-active",
        slug: "onboarding",
        name: "Onboarding",
        color: "#22c55e",
        order_index: 1,
        is_final: false,
        parent_stage_id: null,
        sla_amount: 1,
        sla_unit: "business_days",
        warn_at_percent: 80,
      },
    ];
    const tasks = [
      {
        id: "task-completed",
        cliente_id: "client-completed",
        pipeline_stage_id: "stage-active",
        status: "concluido",
        started_at: "2026-01-10T00:00:00.000Z",
        created_at: "2026-01-10T00:00:00.000Z",
      },
    ];
    const clients = [
      {
        id: "client-completed",
        valor: 100,
        deal_value: null,
        current_stage_id: null,
        stage_entered_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        is_archived: false,
      },
    ];

    const result = buildFunilData(stages, tasks, clients);

    expect(result.rows).toHaveLength(0);
  });
});
