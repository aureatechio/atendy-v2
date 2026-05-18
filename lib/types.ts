export type SortDirection = "asc" | "desc" | "none";

export type PeriodPreset = "all" | "month" | "lastMonth" | "year" | "custom";

export interface DateRange {
  from?: string;
  to?: string;
}

export interface Compra {
  dataCompra: string;
  dataPagamento?: string;
  numProposta?: string;
  linkPdf?: string;
  statusPagamento?: string;
  statusCompra?: string;
  statusProducao?: string;
  tipoVenda?: string;
  cliente?: string;
  razaoSocial?: string;
  cnpjCpf?: string;
  email?: string;
  telefone?: string;
  vendedor?: string;
  agencia?: string;
  celebridade?: string;
  prazo?: string;
  cidade?: string;
  estado?: string;
  regiao?: string;
  segmento?: string;
  subsegmento?: string;
  negocio?: string;
  valorTotalProposta?: number;
  valorTotalCompra?: number;
  vigencia?: string;
  fimDireitoUso?: string;
  pracaComprada?: string;
  numParcelas?: string;
  mgs?: string;
  clickSignStatus?: string;
  envioAssinatura?: string;
  assinaturaConcluida?: string;
  compraId?: string;
  leadId?: string;
  atendyClienteId?: string;
  atendyCode?: string;
  atendyNomeCliente?: string;
  atendyCreatedAt?: string;
  atendyStageId?: string;
  atendyStageName?: string;
  atendyStageOrder?: number;
  atendyStageColor?: string;
  atendyStageIsFinal?: boolean;
  atendySynced?: boolean;
  [key: string]: unknown;
}

export interface FunilStageMeta {
  slug: string;
  name: string;
  order_index: number;
  color: string;
  is_final: boolean;
}

export interface FunilRow {
  c: string;
  s: string;
  d: number;
  a: string;
  l: string | null;
}

export interface FunilData {
  stages_meta: FunilStageMeta[];
  rows: FunilRow[];
  valor_map: Record<string, number>;
}

export type CompraColumnKey =
  | "dataCompra"
  | "dataPagamento"
  | "numProposta"
  | "cliente"
  | "vendedor"
  | "celebridade"
  | "segmento"
  | "tipoVenda"
  | "statusPagamento"
  | "statusProducao"
  | "atendyStageName"
  | "atendyStageOrder"
  | "atendySynced"
  | "cidade"
  | "prazo"
  | "valorTotalCompra"
  | "linkPdf";
