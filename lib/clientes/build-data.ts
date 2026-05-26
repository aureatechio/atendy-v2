import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";
import type {
  ClienteListItem,
  ClienteProfileSummary,
  ClientesData,
  ClienteStageSummary,
} from "@/lib/clientes/types";

export interface ClienteRawStage {
  id: string;
  name: string | null;
  slug: string | null;
  color: string | null;
  order_index: number | null;
  is_final: boolean | null;
  is_active: boolean | null;
}

export interface ClienteRawProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface ClienteRawSegmento {
  id: string;
  nome: string | null;
}

export interface ClienteRawSubsegmento {
  id: string;
  nome: string | null;
}

export interface ClienteRawClient {
  id: string;
  code: string | null;
  nomecliente: string | null;
  nome: string | null;
  nome_fantasia: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  company_name: string | null;
  company_cnpj: string | null;
  segment: string | null;
  subsegment: string | null;
  segmento_id: string | null;
  subsegmento_id: string | null;
  valor: number | string | null;
  deal_value: number | string | null;
  celebridade: string | null;
  praca: string | null;
  classificacao: string | null;
  current_stage_id: string | null;
  stage_entered_at: string | null;
  created_at: string | null;
  responsavel_atendimento: string | null;
  assigned_to: string | null;
  prazo_final: string | null;
  vigencia: string | null;
  data_contrato_assinado: string | null;
  inicio_vigencia: string | null;
  is_archived: boolean | null;
  archived_at: string | null;
  link_pasta_drive: string | null;
  link_proposta: string | null;
  link_pasta_entrega: string | null;
}

export interface ClienteRawTask {
  id: string;
  cliente_id: string | null;
  title: string | null;
  status: string | null;
  priority: string | null;
  is_urgent: boolean | null;
  deadline: string | null;
  created_at: string | null;
  started_at: string | null;
  assigned_to: string | null;
  pipeline_stage_id: string | null;
}

export interface ClienteRawMeeting {
  id: string;
  cliente_id: string | null;
  title: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_type: string | null;
  meeting_link: string | null;
  status: string | null;
  organizer_id: string | null;
}

export interface BuildClientesDataInput {
  stages: ClienteRawStage[];
  clients: ClienteRawClient[];
  profiles?: ClienteRawProfile[];
  segmentos?: ClienteRawSegmento[];
  subsegmentos?: ClienteRawSubsegmento[];
  tasks?: ClienteRawTask[];
  meetings?: ClienteRawMeeting[];
  now?: Date;
}

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateMs(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function maxIso(values: Array<string | null | undefined>) {
  let max = 0;
  for (const value of values) {
    max = Math.max(max, dateMs(value));
  }
  return max > 0 ? new Date(max).toISOString() : null;
}

function daysSince(value: string | null | undefined, now: Date) {
  const ms = dateMs(value);
  if (!ms) return null;
  return Math.max(Math.floor((now.getTime() - ms) / 86_400_000), 0);
}

function isOpenTask(task: ClienteRawTask) {
  return task.status !== COMPLETED_TASK_STATUS;
}

function isUpcomingMeeting(meeting: ClienteRawMeeting, now: Date) {
  if (!meeting.scheduled_at) return false;
  const status = String(meeting.status ?? "").toLowerCase();
  if (["cancelled", "canceled", "cancelada", "cancelado", "done", "completed", "concluida", "concluido"].includes(status)) {
    return false;
  }
  return dateMs(meeting.scheduled_at) >= now.getTime();
}

export function buildClientesData(input: BuildClientesDataInput): ClientesData {
  const now = input.now ?? new Date();
  const stages: ClienteStageSummary[] = input.stages
    .filter((stage) => stage.id)
    .map((stage) => ({
      id: stage.id,
      name: stage.name ?? stage.slug ?? "Etapa sem nome",
      slug: stage.slug ?? stage.id,
      color: stage.color ?? "#64748b",
      order_index: Number(stage.order_index ?? 0),
      is_final: Boolean(stage.is_final),
      is_active: stage.is_active !== false,
    }))
    .sort((a, b) => a.order_index - b.order_index);

  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const profileById = new Map((input.profiles ?? []).map((profile) => [profile.id, profile]));
  const segmentoById = new Map((input.segmentos ?? []).map((segmento) => [segmento.id, segmento]));
  const subsegmentoById = new Map((input.subsegmentos ?? []).map((subsegmento) => [subsegmento.id, subsegmento]));
  const tasksByClient = new Map<string, ClienteRawTask[]>();
  const meetingsByClient = new Map<string, ClienteRawMeeting[]>();

  for (const task of input.tasks ?? []) {
    if (!task.cliente_id || !isOpenTask(task)) continue;
    const list = tasksByClient.get(task.cliente_id) ?? [];
    list.push(task);
    tasksByClient.set(task.cliente_id, list);
  }

  for (const meeting of input.meetings ?? []) {
    if (!meeting.cliente_id) continue;
    const list = meetingsByClient.get(meeting.cliente_id) ?? [];
    list.push(meeting);
    meetingsByClient.set(meeting.cliente_id, list);
  }

  const profiles: ClienteProfileSummary[] = (input.profiles ?? []).map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    avatar_url: profile.avatar_url,
  }));

  const items: ClienteListItem[] = input.clients.map((client) => {
    const stage = client.current_stage_id ? stageById.get(client.current_stage_id) ?? null : null;
    const responsavelId = client.responsavel_atendimento ?? client.assigned_to ?? null;
    const responsavel = responsavelId ? profileById.get(responsavelId) ?? null : null;
    const segmento = client.segmento_id ? segmentoById.get(client.segmento_id) ?? null : null;
    const subsegmento = client.subsegmento_id ? subsegmentoById.get(client.subsegmento_id) ?? null : null;
    const tasks = tasksByClient.get(client.id) ?? [];
    const meetings = meetingsByClient.get(client.id) ?? [];
    const nextMeeting = meetings
      .filter((meeting) => isUpcomingMeeting(meeting, now))
      .sort((a, b) => dateMs(a.scheduled_at) - dateMs(b.scheduled_at))[0] ?? null;

    return {
      id: client.id,
      code: client.code,
      nome: client.nomecliente ?? client.nome ?? client.nome_fantasia ?? "Cliente sem nome",
      nomeFantasia: client.nome_fantasia,
      companyName: client.company_name,
      companyCnpj: client.company_cnpj,
      whatsapp: client.whatsapp,
      email: client.email,
      instagram: client.instagram,
      stageId: stage?.id ?? client.current_stage_id,
      stageName: stage?.name ?? null,
      stageColor: stage?.color ?? null,
      stageOrder: stage?.order_index ?? 0,
      responsavelId,
      responsavelNome: responsavel?.full_name ?? null,
      segmentoId: client.segmento_id,
      segmentoNome: segmento?.nome ?? client.segment,
      subsegmentoId: client.subsegmento_id,
      subsegmentoNome: subsegmento?.nome ?? client.subsegment,
      celebridade: client.celebridade,
      praca: client.praca,
      classificacao: client.classificacao,
      valor: numberValue(client.valor) || numberValue(client.deal_value),
      prazoFinal: client.prazo_final,
      vigenciaFinal: client.vigencia,
      createdAt: client.created_at,
      stageEnteredAt: client.stage_entered_at,
      contratoAssinadoAt: client.data_contrato_assinado,
      inicioVigencia: client.inicio_vigencia,
      archivedAt: client.archived_at,
      isArchived: Boolean(client.is_archived),
      diasNaEtapa: daysSince(client.stage_entered_at ?? client.created_at, now),
      tarefasAbertas: tasks.length,
      tarefasUrgentes: tasks.filter((task) => task.is_urgent).length,
      nextMeetingAt: nextMeeting?.scheduled_at ?? null,
      lastActivityAt: maxIso([
        client.created_at,
        client.stage_entered_at,
        client.archived_at,
        ...tasks.map((task) => task.created_at),
        ...meetings.map((meeting) => meeting.scheduled_at),
      ]),
      linkPastaDrive: client.link_pasta_drive,
      linkProposta: client.link_proposta,
      linkPastaEntrega: client.link_pasta_entrega,
    };
  });

  return { items, stages, profiles };
}
