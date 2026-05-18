import { createClient } from "@/lib/supabase/server";
import { COMPLETED_TASK_STATUS } from "@/lib/production-tasks/status";

export interface ClienteFull {
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
  negocio_id: string | null;
  channel: string | null;
  valor: number | null;
  deal_value: number | null;
  celebridade: string | null;
  celebridade_foto: string | null;
  praca: string | null;
  vigencia: string | null;
  inicio_vigencia: string | null;
  prazo_final: string | null;
  data_contrato_assinado: string | null;
  data_primeira_entrega: string | null;
  link_pasta_drive: string | null;
  link_proposta: string | null;
  link_pasta_entrega: string | null;
  briefing: string | null;
  notes: string | null;
  classificacao: string | null;
  current_stage_id: string | null;
  stage_entered_at: string | null;
  created_at: string | null;
  responsavel_atendimento: string | null;
  assigned_to: string | null;
  is_archived: boolean | null;
  archived_at: string | null;
}

export interface ClienteStage {
  id: string;
  name: string;
  slug: string;
  color: string;
  order_index: number;
  is_final: boolean;
  is_active: boolean;
  parent_stage_id: string | null;
}

export interface ClienteStageHistoryEntry {
  id: string;
  cliente_id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  from_assigned_to: string | null;
  to_assigned_to: string | null;
  changed_by: string | null;
  action_type: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
}

export interface ClienteComment {
  id: string;
  cliente_id: string;
  author_id: string | null;
  content: string | null;
  created_at: string | null;
}

export interface ClienteTask {
  id: string;
  cliente_id: string;
  pipeline_stage_id: string | null;
  assigned_to: string | null;
  title: string | null;
  status: string | null;
  priority: string | null;
  is_urgent: boolean | null;
  deadline: string | null;
  started_at: string | null;
  created_at: string | null;
}

export interface ClienteMeeting {
  id: string;
  cliente_id: string;
  title: string | null;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_type: string | null;
  meeting_link: string | null;
  status: string | null;
  organizer_id: string | null;
}

export interface ClienteAdjustment {
  id: string;
  cliente_id: string;
  task_id: string | null;
  content: string | null;
  status: string | null;
  adjustment_type: string | null;
  created_by: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string | null;
}

export interface ClienteProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface ClienteDetalhes {
  cliente: ClienteFull;
  stages: ClienteStage[];
  stageHistory: ClienteStageHistoryEntry[];
  comments: ClienteComment[];
  tasks: ClienteTask[];
  meetings: ClienteMeeting[];
  adjustments: ClienteAdjustment[];
  profiles: Record<string, ClienteProfile>;
}

function sortPipelineStages(stages: ClienteStage[]) {
  const stageById = new Map(stages.map((stage) => [stage.id, stage]));
  const childrenByParent = new Map<string, ClienteStage[]>();

  for (const stage of stages) {
    const parentId = stage.parent_stage_id;
    if (!parentId || !stageById.has(parentId)) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(stage);
    childrenByParent.set(parentId, list);
  }

  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.order_index - b.order_index);
  }

  const roots = stages
    .filter((stage) => !stage.parent_stage_id || !stageById.has(stage.parent_stage_id))
    .sort((a, b) => a.order_index - b.order_index);

  const result: ClienteStage[] = [];
  const visited = new Set<string>();

  const visit = (stage: ClienteStage) => {
    if (visited.has(stage.id)) return;
    visited.add(stage.id);
    result.push(stage);
    const children = childrenByParent.get(stage.id) ?? [];
    children.forEach(visit);
  };

  roots.forEach(visit);
  for (const stage of stages) {
    if (!visited.has(stage.id)) visit(stage);
  }

  return result;
}

export async function getClienteDetalhes(id: string): Promise<ClienteDetalhes | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    throw new Error("Authenticated Supabase session is required.");
  }

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes_cadastro")
    .select(
      "id, code, nomecliente, nome, nome_fantasia, whatsapp, email, instagram, company_name, company_cnpj, segment, subsegment, segmento_id, subsegmento_id, negocio_id, channel, valor, deal_value, celebridade, celebridade_foto, praca, vigencia, inicio_vigencia, prazo_final, data_contrato_assinado, data_primeira_entrega, link_pasta_drive, link_proposta, link_pasta_entrega, briefing, notes, classificacao, current_stage_id, stage_entered_at, created_at, responsavel_atendimento, assigned_to, is_archived, archived_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (clienteError) throw new Error(`Erro ao buscar cliente: ${clienteError.message}`);
  if (!cliente) return null;

  const [
    stagesRes,
    historyRes,
    commentsRes,
    tasksRes,
    meetingsRes,
    adjustmentsRes,
  ] = await Promise.all([
    supabase
      .from("client_pipeline_stages")
      .select("id, name, slug, color, order_index, is_final, is_active, parent_stage_id")
      .eq("is_active", true)
      .order("order_index", { ascending: true }),
    supabase
      .from("client_stage_history")
      .select(
        "id, cliente_id, from_stage_id, to_stage_id, from_assigned_to, to_assigned_to, changed_by, action_type, reason, metadata, created_at",
      )
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("client_comments")
      .select("id, cliente_id, author_id, content, created_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("production_tasks")
      .select(
        "id, cliente_id, pipeline_stage_id, assigned_to, title, status, priority, is_urgent, deadline, started_at, created_at",
      )
      .eq("cliente_id", id)
      .neq("status", COMPLETED_TASK_STATUS)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("client_meetings")
      .select("id, cliente_id, title, scheduled_at, duration_minutes, meeting_type, meeting_link, status, organizer_id")
      .eq("cliente_id", id)
      .order("scheduled_at", { ascending: false })
      .limit(50),
    supabase
      .from("client_adjustments")
      .select(
        "id, cliente_id, task_id, content, status, adjustment_type, created_by, completed_by, completed_at, created_at",
      )
      .eq("cliente_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const stages = sortPipelineStages((stagesRes.data ?? []) as ClienteStage[]);
  const stageHistory = (historyRes.data ?? []) as ClienteStageHistoryEntry[];
  const comments = (commentsRes.data ?? []) as ClienteComment[];
  const tasks = (tasksRes.data ?? []) as ClienteTask[];
  const meetings = (meetingsRes.data ?? []) as ClienteMeeting[];
  const adjustments = (adjustmentsRes.data ?? []) as ClienteAdjustment[];

  const profileIds = new Set<string>();
  if (cliente.responsavel_atendimento) profileIds.add(cliente.responsavel_atendimento);
  if (cliente.assigned_to) profileIds.add(cliente.assigned_to);
  for (const h of stageHistory) if (h.changed_by) profileIds.add(h.changed_by);
  for (const h of stageHistory) {
    if (h.from_assigned_to) profileIds.add(h.from_assigned_to);
    if (h.to_assigned_to) profileIds.add(h.to_assigned_to);
  }
  for (const c of comments) if (c.author_id) profileIds.add(c.author_id);
  for (const t of tasks) if (t.assigned_to) profileIds.add(t.assigned_to);
  for (const m of meetings) if (m.organizer_id) profileIds.add(m.organizer_id);
  for (const a of adjustments) {
    if (a.created_by) profileIds.add(a.created_by);
    if (a.completed_by) profileIds.add(a.completed_by);
  }

  const profiles: Record<string, ClienteProfile> = {};
  if (profileIds.size > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", [...profileIds]);
    for (const p of profilesData ?? []) {
      profiles[p.id] = p as ClienteProfile;
    }
  }

  return {
    cliente: cliente as ClienteFull,
    stages,
    stageHistory,
    comments,
    tasks,
    meetings,
    adjustments,
    profiles,
  };
}
