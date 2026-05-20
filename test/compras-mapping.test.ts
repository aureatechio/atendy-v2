import { describe, expect, it } from "vitest";
import { mapToCompra, type AtendyStageMap, type AtendyStageInfo } from "@/lib/compras/mapping";
import type { CrmCompraRow } from "@/lib/crm/compras";

function baseRow(overrides: Partial<CrmCompraRow> = {}): CrmCompraRow {
  return {
    id: "compra-1",
    data_compra: "2026-03-31T18:44:00+00:00",
    data_pagamento: "2026-03-31T14:03:00+00:00",
    descricao: "CAVEON",
    valor_total: 6365,
    valor_total_proposta: 7000,
    tipo_venda: "Venda",
    statuscompra: "Concluido",
    statusproducao: "Aguardando Inicio",
    checkout_status: "pago",
    vendaaprovada: true,
    parcelado: false,
    numero_parcelas: 1,
    vigencia_meses: 6,
    fimdireitouso: null,
    regiaocomprada: "São Paulo",
    tempoocomprado: null,
    razao_social: "CAVEON COMERCIO DE VINHOS LTDA",
    endereco_completo: null,
    telefone: null,
    is_mgs: false,
    is_test: false,
    clicksign_status: "running",
    data_envio_assinatura: null,
    data_assinatura_concluida: null,
    clicksign_signed_document_url: null,
    leadid: "lead-1",
    imagemproposta_id: "img-uuid-1",
    cliente: {
      id: "cli-1",
      nome: "CAVEON",
      cnpj: "57.020.417/0001-33",
      cpf: null,
      email: "rodrigo@caveon.com.br",
      telefone: "(11) 9475-3468",
      razaosocial: "CAVEON COMERCIO DE VINHOS LTDA",
      cidade: "São Paulo",
      estado: "SP",
    },
    vendedor: { id: "v-1", nome: "Anita Imperatore" },
    celebridade_ref: { id: "c-1", nome: "Dan Stulbach" },
    segmento_ref: { id: "s-1", nome: "Varejo" },
    subsegmento_ref: { id: "ss-1", nome: "Bebidas" },
    imagem: { id: 12340, imagem: "https://x.supabase.co/propostas-pdf/12340.pdf" },
    ...overrides,
  };
}

function stageMapWith(info: AtendyStageInfo): AtendyStageMap {
  const m: AtendyStageMap = new Map();
  m.set(info.clienteId === "compra-1" ? "compra-1" : "compra-1", info);
  return m;
}

describe("mapToCompra", () => {
  it("mapeia campos básicos do CRM para o shape Compra", () => {
    const compra = mapToCompra(baseRow(), new Map());

    expect(compra.compraId).toBe("compra-1");
    expect(compra.cliente).toBe("CAVEON");
    expect(compra.razaoSocial).toBe("CAVEON COMERCIO DE VINHOS LTDA");
    expect(compra.cnpjCpf).toBe("57.020.417/0001-33");
    expect(compra.vendedor).toBe("Anita Imperatore");
    expect(compra.celebridade).toBe("Dan Stulbach");
    expect(compra.segmento).toBe("Varejo");
    expect(compra.subsegmento).toBe("Bebidas");
    expect(compra.statusPagamento).toBe("pago");
    expect(compra.valorTotalCompra).toBe(6365);
    expect(compra.valorTotalProposta).toBe(7000);
    expect(compra.numProposta).toBe("12340");
    expect(compra.linkPdf).toBe("https://x.supabase.co/propostas-pdf/12340.pdf");
    expect(compra.prazo).toBe("6");
    expect(compra.vigencia).toBe("6");
  });

  it("marca atendySynced=false quando não há entry no stageMap", () => {
    const compra = mapToCompra(baseRow(), new Map());
    expect(compra.atendySynced).toBe(false);
    expect(compra.atendyStageId).toBeUndefined();
    expect(compra.atendyCode).toBeUndefined();
  });

  it("enriquece com dados do Atendy quando há entry no stageMap", () => {
    const stageMap: AtendyStageMap = new Map();
    stageMap.set("compra-1", {
      clienteId: "atendy-cli-1",
      code: "12340",
      nomecliente: "CAVEON",
      createdAt: "2026-04-01T10:00:00+00:00",
      stageId: "stage-1",
      stageName: "Em produção",
      stageOrder: 3,
      stageColor: "#2563eb",
      stageIsFinal: false,
    });

    const compra = mapToCompra(baseRow(), stageMap);
    expect(compra.atendySynced).toBe(true);
    expect(compra.atendyClienteId).toBe("atendy-cli-1");
    expect(compra.atendyCode).toBe("12340");
    expect(compra.atendyStageName).toBe("Em produção");
    expect(compra.atendyStageOrder).toBe(3);
    expect(compra.atendyStageIsFinal).toBe(false);
  });

  it("ignora linkPdf quando imagem é placeholder não-URL", () => {
    const row = baseRow();
    row.imagem = { id: 12340, imagem: "__pdf_pending__" };
    const compra = mapToCompra(row, new Map());
    expect(compra.linkPdf).toBeUndefined();
    expect(compra.numProposta).toBe("12340");
  });

  it("usa CPF quando cliente não tem CNPJ", () => {
    const row = baseRow();
    row.cliente = { ...row.cliente!, cnpj: null, cpf: "123.456.789-00" };
    const compra = mapToCompra(row, new Map());
    expect(compra.cnpjCpf).toBe("123.456.789-00");
  });
});

// Suppress unused warning for helper kept for readability
void stageMapWith;
