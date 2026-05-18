import { buildClientesData, type ClienteRawClient, type ClienteRawMeeting, type ClienteRawProfile, type ClienteRawSegmento, type ClienteRawStage, type ClienteRawSubsegmento, type ClienteRawTask } from "@/lib/clientes/build-data";
import type { ClienteQuickComment, ClienteQuickDetail, ClienteQuickMeeting, ClienteQuickTask } from "@/lib/clientes/types";
import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

type SupabasePageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

type ClienteRawComment = {
  id: string;
  cliente_id: string;
  author_id: string | null;
  content: string | null;
  created_at: string | null;
};

async function fetchSupabaseAll<T>(
  fetchPage: (from: number, to: number) => PromiseLike<SupabasePageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase request failed: ${error.message}`);

    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

function profileName(profiles: Map<string, ClienteRawProfile>, id: string | null) {
  if (!id) return null;
  return profiles.get(id)?.full_name ?? null;
}

function collectProfileIds(
  clients: ClienteRawClient[],
  tasks: ClienteRawTask[],
  meetings: ClienteRawMeeting[],
  comments: ClienteRawComment[] = [],
) {
  const ids = new Set<string>();
  for (const client of clients) {
    if (client.responsavel_atendimento) ids.add(client.responsavel_atendimento);
    if (client.assigned_to) ids.add(client.assigned_to);
  }
  for (const task of tasks) if (task.assigned_to) ids.add(task.assigned_to);
  for (const meeting of meetings) if (meeting.organizer_id) ids.add(meeting.organizer_id);
  for (const comment of comments) if (comment.author_id) ids.add(comment.author_id);
  return [...ids];
}

async function requireAuthenticatedClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Authenticated Supabase session is required.");
  }

  return supabase;
}

export async function getClientesDados() {
  const supabase = await requireAuthenticatedClient();

  const [stages, clients, segmentos, subsegmentos, tasks, meetings] = await Promise.all([
    fetchSupabaseAll<ClienteRawStage>((from, to) =>
      supabase
        .from("client_pipeline_stages")
        .select("id,name,slug,color,order_index,is_final,is_active")
        .order("order_index", { ascending: true })
        .range(from, to),
    ),
    fetchSupabaseAll<ClienteRawClient>((from, to) =>
      supabase
        .from("clientes_cadastro")
        .select(
          "id,code,nomecliente,nome,nome_fantasia,whatsapp,email,instagram,company_name,company_cnpj,segment,subsegment,segmento_id,subsegmento_id,valor,deal_value,celebridade,praca,classificacao,current_stage_id,stage_entered_at,created_at,responsavel_atendimento,assigned_to,prazo_final,data_contrato_assinado,inicio_vigencia,is_archived,archived_at,link_pasta_drive,link_proposta,link_pasta_entrega",
        )
        .range(from, to),
    ),
    fetchSupabaseAll<ClienteRawSegmento>((from, to) =>
      supabase.from("segmentos").select("id,nome").range(from, to),
    ),
    fetchSupabaseAll<ClienteRawSubsegmento>((from, to) =>
      supabase.from("subsegmentos").select("id,nome").range(from, to),
    ),
    fetchSupabaseAll<ClienteRawTask>((from, to) =>
      supabase
        .from("production_tasks")
        .select("id,cliente_id,pipeline_stage_id,assigned_to,title,status,priority,is_urgent,deadline,started_at,created_at")
        .neq("status", COMPLETED_TASK_STATUS)
        .range(from, to),
    ),
    fetchSupabaseAll<ClienteRawMeeting>((from, to) =>
      supabase
        .from("client_meetings")
        .select("id,cliente_id,title,scheduled_at,duration_minutes,meeting_type,meeting_link,status,organizer_id")
        .range(from, to),
    ),
  ]);

  const profileIds = collectProfileIds(clients, tasks, meetings);
  const profiles =
    profileIds.length > 0
      ? ((await supabase.from("profiles").select("id,full_name,avatar_url").in("id", profileIds)).data ?? [])
      : [];

  return buildClientesData({
    stages,
    clients,
    profiles: profiles as ClienteRawProfile[],
    segmentos,
    subsegmentos,
    tasks,
    meetings,
  });
}

export async function getClienteQuickDetail(id: string): Promise<ClienteQuickDetail | null> {
  const supabase = await requireAuthenticatedClient();

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes_cadastro")
    .select(
      "id,code,nomecliente,nome,nome_fantasia,whatsapp,email,instagram,company_name,company_cnpj,segment,subsegment,segmento_id,subsegmento_id,valor,deal_value,celebridade,praca,classificacao,current_stage_id,stage_entered_at,created_at,responsavel_atendimento,assigned_to,prazo_final,data_contrato_assinado,inicio_vigencia,is_archived,archived_at,link_pasta_drive,link_proposta,link_pasta_entrega",
    )
    .eq("id", id)
    .maybeSingle();

  if (clienteError) throw new Error(`Erro ao buscar cliente: ${clienteError.message}`);
  if (!cliente) return null;

  const [stagesRes, segmentosRes, subsegmentosRes, tasksRes, meetingsRes, commentsRes] = await Promise.all([
    supabase
      .from("client_pipeline_stages")
      .select("id,name,slug,color,order_index,is_final,is_active")
      .order("order_index", { ascending: true }),
    supabase.from("segmentos").select("id,nome"),
    supabase.from("subsegmentos").select("id,nome"),
    supabase
      .from("production_tasks")
      .select("id,cliente_id,pipeline_stage_id,assigned_to,title,status,priority,is_urgent,deadline,started_at,created_at")
      .eq("cliente_id", id)
      .neq("status", COMPLETED_TASK_STATUS)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("client_meetings")
      .select("id,cliente_id,title,scheduled_at,duration_minutes,meeting_type,meeting_link,status,organizer_id")
      .eq("cliente_id", id)
      .order("scheduled_at", { ascending: true })
      .limit(6),
    supabase
      .from("client_comments")
      .select("id,cliente_id,author_id,content,created_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  for (const res of [stagesRes, segmentosRes, subsegmentosRes, tasksRes, meetingsRes, commentsRes]) {
    if (res.error) throw new Error(`Erro ao buscar resumo do cliente: ${res.error.message}`);
  }

  const tasks = (tasksRes.data ?? []) as ClienteRawTask[];
  const meetings = (meetingsRes.data ?? []) as ClienteRawMeeting[];
  const comments = (commentsRes.data ?? []) as ClienteRawComment[];
  const profileIds = collectProfileIds([cliente as ClienteRawClient], tasks, meetings, comments);
  const profiles =
    profileIds.length > 0
      ? ((await supabase.from("profiles").select("id,full_name,avatar_url").in("id", profileIds)).data ?? [])
      : [];
  const profileMap = new Map((profiles as ClienteRawProfile[]).map((profile) => [profile.id, profile]));

  const data = buildClientesData({
    stages: (stagesRes.data ?? []) as ClienteRawStage[],
    clients: [cliente as ClienteRawClient],
    profiles: profiles as ClienteRawProfile[],
    segmentos: (segmentosRes.data ?? []) as ClienteRawSegmento[],
    subsegmentos: (subsegmentosRes.data ?? []) as ClienteRawSubsegmento[],
    tasks,
    meetings,
  });

  const item = data.items[0];
  if (!item) return null;

  return {
    cliente: item,
    tasks: tasks.map<ClienteQuickTask>((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      isUrgent: Boolean(task.is_urgent),
      deadline: task.deadline,
      assignedToName: profileName(profileMap, task.assigned_to),
    })),
    comments: comments.map<ClienteQuickComment>((comment) => ({
      id: comment.id,
      content: comment.content,
      authorName: profileName(profileMap, comment.author_id),
      createdAt: comment.created_at,
    })),
    meetings: meetings.map<ClienteQuickMeeting>((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      scheduledAt: meeting.scheduled_at,
      durationMinutes: meeting.duration_minutes,
      meetingType: meeting.meeting_type,
      meetingLink: meeting.meeting_link,
      status: meeting.status,
      organizerName: profileName(profileMap, meeting.organizer_id),
    })),
  };
}
