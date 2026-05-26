import { describe, expect, it } from "vitest";
import { buildSlaEstouradoClientes } from "@/lib/dashboard/sla-estourado";
import type { FunilData } from "@/lib/types";

const baseFunil: FunilData = {
  stages_meta: [
    {
      id: "stage-briefing",
      slug: "briefing",
      name: "Briefing",
      order_index: 1,
      color: "#2563eb",
      is_final: false,
      parent_stage_id: null,
      sla_amount: 1,
      sla_unit: "business_days",
      warn_at_percent: 80,
      followup_days: null,
    },
    {
      id: "stage-producao",
      slug: "producao",
      name: "Producao",
      order_index: 2,
      color: "#dc2626",
      is_final: false,
      parent_stage_id: null,
      sla_amount: 2,
      sla_unit: "business_days",
      warn_at_percent: 80,
      followup_days: null,
    },
  ],
  valor_map: {},
  clients_map: {
    "cliente-a": {
      id: "cliente-a",
      nome: "Acme Brasil",
      whatsapp: null,
      valor: 1000,
      responsavelId: "user-a",
      responsavelNome: "Ana Producao",
      segmentoId: null,
      segmentoNome: "Alimentos",
      subsegmentoNome: null,
      prazoFinal: null,
      celebridade: null,
    },
    "cliente-b": {
      id: "cliente-b",
      nome: "Beta Conteudo",
      whatsapp: null,
      valor: 2000,
      responsavelId: null,
      responsavelNome: null,
      segmentoId: null,
      segmentoNome: "Moda",
      subsegmentoNome: null,
      prazoFinal: null,
      celebridade: null,
    },
    "cliente-c": {
      id: "cliente-c",
      nome: "Cliente Dentro do Prazo",
      whatsapp: null,
      valor: 3000,
      responsavelId: "user-c",
      responsavelNome: "Carla CS",
      segmentoId: null,
      segmentoNome: null,
      subsegmentoNome: null,
      prazoFinal: null,
      celebridade: null,
    },
  },
  rows: [
    {
      c: "cliente-a",
      s: "briefing",
      d: 3,
      a: "2026-05-20",
      l: "cliente-a",
      slaStatus: "overdue",
      slaHoursRemaining: -8,
    },
    {
      c: "cliente-a",
      s: "producao",
      d: 5,
      a: "2026-05-18",
      l: "cliente-a",
      slaStatus: "overdue",
      slaHoursRemaining: -18,
    },
    {
      c: "cliente-b",
      s: "briefing",
      d: 9,
      a: "2026-05-14",
      l: "cliente-b",
      slaStatus: "overdue",
      slaHoursRemaining: -4,
    },
    {
      c: "cliente-c",
      s: "briefing",
      d: 1,
      a: "2026-05-23",
      l: "cliente-c",
      slaStatus: "ok",
      slaHoursRemaining: 12,
    },
  ],
};

describe("buildSlaEstouradoClientes", () => {
  it("lista apenas clientes com SLA estourado, deduplica por cliente e prioriza o maior atraso", () => {
    const result = buildSlaEstouradoClientes(baseFunil);

    expect(result.map((cliente) => cliente.id)).toEqual(["cliente-a", "cliente-b"]);
    expect(result[0]).toMatchObject({
      id: "cliente-a",
      nome: "Acme Brasil",
      stageSlug: "producao",
      stageName: "Producao",
      stageColor: "#dc2626",
      diasNaEtapa: 5,
      slaHoursRemaining: -18,
      responsavelNome: "Ana Producao",
    });
  });
});
