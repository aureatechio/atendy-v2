export type SortDirection = "asc" | "desc" | "none";

export type PeriodPreset =
  | "all"
  | "today"
  | "last7"
  | "last30"
  | "month"
  | "lastMonth"
  | "monthPick"
  | "year"
  | "custom";

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

export type SlaUnit = "business_days" | "business_hours" | "calendar_hours";

export interface FunilStageMeta {
  id: string;
  slug: string;
  name: string;
  order_index: number;
  color: string;
  is_final: boolean;
  parent_stage_id: string | null;
  sla_amount: number | null;
  sla_unit: SlaUnit;
  warn_at_percent: number;
  followup_days: number | null;
  substages?: FunilStageMeta[];
}

export interface BusinessHoliday {
  date: string;
  description: string;
  scope: "national" | "regional" | "company";
}

export type SlaStatus = "ok" | "warning" | "overdue" | "none";

export type AlertType = "stage_sla" | "task_overdue" | "followup";

export interface Alert {
  id: string;
  type: AlertType;
  status: "warning" | "overdue";
  firedAt: string;
  deadline: string;
  lastSeenAt: string;
  snoozedUntil: string | null;
  cliente: {
    id: string;
    nome: string;
    responsavelId: string | null;
    responsavelNome: string | null;
  };
  stage: { id: string; name: string; slug: string; color: string } | null;
  task: { id: string; title: string | null } | null;
}

/** @deprecated use `Alert` */
export type SlaAlert = Alert;

export interface FunilRow {
  c: string;
  s: string;
  d: number;
  a: string;
  l: string | null;
  slaStatus?: SlaStatus;
  slaDeadline?: string | null;
  slaHoursRemaining?: number | null;
}

export interface FunilClientDetail {
  id: string;
  nome: string;
  whatsapp: string | null;
  valor: number;
  responsavelId: string | null;
  responsavelNome: string | null;
  segmentoId: string | null;
  segmentoNome: string | null;
  subsegmentoNome: string | null;
  prazoFinal: string | null;
  celebridade: string | null;
}

export interface FunilData {
  stages_meta: FunilStageMeta[];
  rows: FunilRow[];
  valor_map: Record<string, number>;
  clients_map: Record<string, FunilClientDetail>;
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
  | "clickSignStatus"
  | "statusProducao"
  | "atendyStageName"
  | "atendyStageOrder"
  | "atendySynced"
  | "cidade"
  | "prazo"
  | "valorTotalCompra"
  | "linkPdf";
