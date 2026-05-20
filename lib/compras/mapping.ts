import type { Compra } from "@/lib/types";
import type { CrmCompraRow } from "@/lib/crm/compras";

export type AtendyStageInfo = {
  clienteId: string;
  code: string;
  nomecliente: string | null;
  createdAt: string | null;
  stageId: string | null;
  stageName: string | null;
  stageOrder: number | null;
  stageColor: string | null;
  stageIsFinal: boolean | null;
};

export type AtendyStageMap = Map<string, AtendyStageInfo>;

function numberOrUndefined(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stringOrUndefined(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

function cnpjOrCpf(cliente: CrmCompraRow["cliente"]): string | undefined {
  if (!cliente) return undefined;
  return stringOrUndefined(cliente.cnpj) ?? stringOrUndefined(cliente.cpf);
}

export function mapToCompra(row: CrmCompraRow, stageMap: AtendyStageMap): Compra {
  const stageInfo = stageMap.get(row.id);
  const cliente = row.cliente;
  const proposta = row.imagem;

  return {
    dataCompra: row.data_compra ?? "",
    dataPagamento: row.data_pagamento ?? undefined,
    numProposta: proposta?.id != null ? String(proposta.id) : undefined,
    linkPdf: isHttpUrl(proposta?.imagem) ? proposta!.imagem! : undefined,
    statusPagamento: stringOrUndefined(row.checkout_status),
    statusCompra: stringOrUndefined(row.statuscompra),
    statusProducao: stringOrUndefined(row.statusproducao),
    tipoVenda: stringOrUndefined(row.tipo_venda),
    cliente: stringOrUndefined(cliente?.nome) ?? stringOrUndefined(row.descricao),
    razaoSocial: stringOrUndefined(cliente?.razaosocial) ?? stringOrUndefined(row.razao_social),
    cnpjCpf: cnpjOrCpf(cliente),
    email: stringOrUndefined(cliente?.email),
    telefone: stringOrUndefined(cliente?.telefone) ?? stringOrUndefined(row.telefone),
    vendedor: stringOrUndefined(row.vendedor?.nome),
    agencia: undefined,
    celebridade: stringOrUndefined(row.celebridade_ref?.nome),
    prazo: row.vigencia_meses != null ? String(row.vigencia_meses) : undefined,
    cidade: stringOrUndefined(cliente?.cidade),
    estado: stringOrUndefined(cliente?.estado),
    regiao: stringOrUndefined(row.regiaocomprada),
    segmento: stringOrUndefined(row.segmento_ref?.nome),
    subsegmento: stringOrUndefined(row.subsegmento_ref?.nome),
    negocio: undefined,
    valorTotalProposta: numberOrUndefined(row.valor_total_proposta),
    valorTotalCompra: numberOrUndefined(row.valor_total),
    vigencia: row.vigencia_meses != null ? String(row.vigencia_meses) : undefined,
    fimDireitoUso: row.fimdireitouso ?? undefined,
    pracaComprada: stringOrUndefined(row.regiaocomprada),
    numParcelas: row.numero_parcelas != null ? String(row.numero_parcelas) : undefined,
    mgs: row.is_mgs ? "true" : undefined,
    clickSignStatus: stringOrUndefined(row.clicksign_status),
    envioAssinatura: row.data_envio_assinatura ?? undefined,
    assinaturaConcluida: row.data_assinatura_concluida ?? undefined,
    compraId: row.id,
    leadId: row.leadid ?? undefined,
    atendyClienteId: stageInfo?.clienteId,
    atendyCode: stageInfo?.code,
    atendyNomeCliente: stageInfo?.nomecliente ?? undefined,
    atendyCreatedAt: stageInfo?.createdAt ?? undefined,
    atendyStageId: stageInfo?.stageId ?? undefined,
    atendyStageName: stageInfo?.stageName ?? undefined,
    atendyStageOrder: stageInfo?.stageOrder ?? undefined,
    atendyStageColor: stageInfo?.stageColor ?? undefined,
    atendyStageIsFinal: stageInfo?.stageIsFinal ?? undefined,
    atendySynced: stageInfo !== undefined,
  };
}
