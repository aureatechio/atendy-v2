import type { SortDirection } from "@/lib/types";

export interface ClienteStageSummary {
  id: string;
  name: string;
  slug: string;
  color: string;
  order_index: number;
  is_final: boolean;
  is_active: boolean;
}

export interface ClienteProfileSummary {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export type ClientesPeriodField =
  | "createdAt"
  | "stageEnteredAt"
  | "prazoFinal"
  | "contratoAssinadoAt"
  | "inicioVigencia";

export type ClientesSortKey =
  | "nome"
  | "stageOrder"
  | "responsavelNome"
  | "prazoFinal"
  | "diasNaEtapa"
  | "valor"
  | "lastActivityAt";

export type ClientesColumnKey =
  | "cliente"
  | "stage"
  | "responsavel"
  | "prazo"
  | "tempo"
  | "tarefas"
  | "valor"
  | "celebridade"
  | "praca"
  | "actions";

export type ClientesStatusFilter = "active" | "archived" | "all";
export type ClientesPrazoFilter = "all" | "overdue" | "today" | "next7" | "none";

export interface ClienteListItem {
  id: string;
  code: string | null;
  nome: string;
  nomeFantasia: string | null;
  companyName: string | null;
  companyCnpj: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  stageId: string | null;
  stageName: string | null;
  stageColor: string | null;
  stageOrder: number;
  responsavelId: string | null;
  responsavelNome: string | null;
  segmentoId: string | null;
  segmentoNome: string | null;
  subsegmentoId: string | null;
  subsegmentoNome: string | null;
  celebridade: string | null;
  praca: string | null;
  classificacao: string | null;
  valor: number;
  prazoFinal: string | null;
  createdAt: string | null;
  stageEnteredAt: string | null;
  contratoAssinadoAt: string | null;
  inicioVigencia: string | null;
  archivedAt: string | null;
  isArchived: boolean;
  diasNaEtapa: number | null;
  tarefasAbertas: number;
  tarefasUrgentes: number;
  nextMeetingAt: string | null;
  lastActivityAt: string | null;
  linkPastaDrive: string | null;
  linkProposta: string | null;
  linkPastaEntrega: string | null;
}

export interface ClientesData {
  items: ClienteListItem[];
  stages: ClienteStageSummary[];
  profiles: ClienteProfileSummary[];
}

export interface ClienteQuickTask {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  isUrgent: boolean;
  deadline: string | null;
  assignedToName: string | null;
}

export interface ClienteQuickComment {
  id: string;
  content: string | null;
  authorName: string | null;
  createdAt: string | null;
}

export interface ClienteQuickMeeting {
  id: string;
  title: string | null;
  scheduledAt: string | null;
  durationMinutes: number | null;
  meetingType: string | null;
  meetingLink: string | null;
  status: string | null;
  organizerName: string | null;
}

export interface ClienteQuickDetail {
  cliente: ClienteListItem;
  tasks: ClienteQuickTask[];
  comments: ClienteQuickComment[];
  meetings: ClienteQuickMeeting[];
}

export interface ClientesFiltersState {
  search: string;
  period: import("@/lib/types").PeriodPreset;
  periodFrom: string;
  periodTo: string;
  monthIndex: number;
  periodField: ClientesPeriodField;
  stageId: string;
  responsavelId: string;
  status: ClientesStatusFilter;
  prazo: ClientesPrazoFilter;
  segmento: string;
  subsegmento: string;
  celebridade: string;
  praca: string;
  classificacao: string;
  valorMin: string;
  valorMax: string;
  diasMin: string;
  diasMax: string;
  tarefaUrgente: boolean;
  semResponsavel: boolean;
  comReuniao: boolean;
  sortKey: ClientesSortKey;
  sortDir: SortDirection;
}
