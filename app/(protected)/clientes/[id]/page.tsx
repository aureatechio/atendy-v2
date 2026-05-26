import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  History,
  Mail,
  MapPin,
  MessageSquare,
  Star,
  Tag,
  User,
  Wallet,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import {
  getClienteDetalhes,
  type ClienteFull,
  type ClienteStage,
  type ClienteStageHistoryEntry,
  type ClienteProfile,
  type ClienteComment,
  type ClienteTask,
  type ClienteMeeting,
  type ClienteAdjustment,
} from "@/lib/api/cliente";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buildWhatsappHref, formatCnpj, formatPhone } from "@/lib/clientes/format";
import { ClienteActions, ClienteAddComment } from "@/components/cliente/cliente-actions";
import { htmlToPlainText } from "@/lib/utils";
import { WhatsAppCopyButton } from "@/components/cliente/whatsapp-copy-button";

export const dynamic = "force-dynamic";

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATETIME_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : DATE_FMT.format(d);
}

function fmtDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : DATETIME_FMT.format(d);
}

function fmtCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return CURRENCY.format(Number(value));
}

function daysSince(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(Math.round((Date.now() - d.getTime()) / 86_400_000), 0);
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

function profileName(profiles: Record<string, ClienteProfile>, id: string | null) {
  if (!id) return null;
  return profiles[id]?.full_name ?? null;
}

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let data;
  try {
    data = await getClienteDetalhes(id);
  } catch (error) {
    return (
      <div className="cliente-page-error">
        <AlertTriangle className="h-5 w-5" />
        <div>
          <p className="font-medium">Erro ao carregar cliente</p>
          <p className="text-xs ds-text-muted">
            {(error as Error)?.message ?? "Sem detalhes adicionais."}
          </p>
        </div>
      </div>
    );
  }

  if (!data) notFound();

  const { cliente, stages, stageHistory, comments, tasks, meetings, adjustments, profiles } = data;

  const currentStage = stages.find((s) => s.id === cliente.current_stage_id) ?? null;
  const mainStages = stages.filter((stage) => !stage.parent_stage_id);
  const dias = daysSince(cliente.stage_entered_at ?? cliente.created_at);
  const responsavel = profileName(profiles, cliente.responsavel_atendimento ?? cliente.assigned_to);
  const valor = cliente.valor ?? cliente.deal_value;

  const nome = cliente.nomecliente || cliente.nome || cliente.nome_fantasia || "Cliente sem nome";

  return (
    <div className="cliente-page">
      <header className="cliente-header">
        <div className="cliente-header-top">
          <Link href="/funil" className="cliente-back">
            <ArrowLeft className="h-4 w-4" /> Voltar ao funil
          </Link>
          {cliente.is_archived ? (
            <Badge className="cliente-archived-badge">Arquivado</Badge>
          ) : null}
        </div>
        <div className="cliente-header-main">
          <div className="cliente-header-id">
            <p className="cliente-eyebrow">Cliente</p>
            <h1 className="cliente-title">{nome}</h1>
            <div className="cliente-header-meta">
              {cliente.code ? <span className="cliente-chip">{cliente.code}</span> : null}
              {currentStage ? (
                <span
                  className="cliente-chip cliente-chip--stage"
                  style={{ borderColor: currentStage.color, color: currentStage.color }}
                >
                  <span
                    className="cliente-chip-dot"
                    style={{ background: currentStage.color }}
                    aria-hidden
                  />
                  {currentStage.name}
                </span>
              ) : null}
              {dias !== null ? (
                <span className="cliente-chip">
                  {dias === 0 ? "hoje" : `${dias}d na etapa`}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="cliente-kpi-grid">
          <KpiTile icon={Wallet} label="Valor" value={fmtCurrency(valor)} />
          <KpiTile icon={User} label="Responsável" value={responsavel ?? "—"} />
          <KpiTile icon={Star} label="Celebridade" value={cliente.celebridade ?? "—"} />
          <KpiTile icon={Calendar} label="Prazo final" value={fmtDate(cliente.prazo_final)} />
        </div>

        <ClienteActions
          clienteId={cliente.id}
          whatsapp={cliente.whatsapp}
          currentStageId={cliente.current_stage_id}
          stages={mainStages}
          isArchived={Boolean(cliente.is_archived)}
        />
      </header>

      <div className="cliente-grid">
        <section className="cliente-col">
          <InfoCard cliente={cliente} />
          <StageHistoryCard history={stageHistory} stages={stages} profiles={profiles} />
        </section>
        <section className="cliente-col">
          <CommentsCard
            clienteId={cliente.id}
            comments={comments}
            profiles={profiles}
          />
          <TasksCard tasks={tasks} stages={stages} profiles={profiles} />
          <MeetingsCard meetings={meetings} profiles={profiles} />
          <AdjustmentsCard adjustments={adjustments} profiles={profiles} />
        </section>
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="cliente-kpi">
      <span className="cliente-kpi-icon">
        <Icon className="h-4 w-4" />
      </span>
      <span className="cliente-kpi-label">{label}</span>
      <span className="cliente-kpi-value" title={value}>
        {value}
      </span>
    </div>
  );
}

function InfoCard({ cliente }: { cliente: ClienteFull }) {
  const vigenciaDias = daysUntil(cliente.vigencia);
  const vigenciaFinal =
    cliente.vigencia == null
      ? null
      : `${fmtDate(cliente.vigencia)} · ${
          vigenciaDias === null
            ? "Sem data final de vigência"
              : vigenciaDias > 0
                ? `Faltam ${vigenciaDias} dias`
                : "Vigência vencida"
        }`;

  const whatsappHref = buildWhatsappHref(cliente.whatsapp);
  const whatsappValue = formatPhone(cliente.whatsapp);
  const whatsappCopyValue = whatsappValue || cliente.whatsapp || "";

  const items: { label: string; value: string | null; href?: string; icon?: React.ComponentType<{ className?: string }> }[] = [
    { label: "WhatsApp", value: whatsappValue || "—", href: whatsappHref || undefined, icon: MessageSquare },
    { label: "E-mail", value: cliente.email, icon: Mail, href: cliente.email ? `mailto:${cliente.email}` : undefined },
    { label: "Instagram", value: cliente.instagram, icon: Tag },
    { label: "Razão social", value: cliente.company_name },
    { label: "CNPJ", value: formatCnpj(cliente.company_cnpj) || "—" },
    { label: "Segmento", value: cliente.segment },
    { label: "Subsegmento", value: cliente.subsegment },
    { label: "Praça", value: cliente.praca, icon: MapPin },
    { label: "Início vigência", value: cliente.inicio_vigencia ? fmtDate(cliente.inicio_vigencia) : null },
    { label: "Vigência final", value: vigenciaFinal },
    { label: "Contrato assinado em", value: cliente.data_contrato_assinado ? fmtDate(cliente.data_contrato_assinado) : null },
    {
      label: "Drive",
      value: cliente.link_pasta_drive ? "Abrir pasta" : null,
      href: cliente.link_pasta_drive ?? undefined,
      icon: ExternalLink,
    },
    {
      label: "Proposta",
      value: cliente.link_proposta ? "Abrir proposta" : null,
      href: cliente.link_proposta ?? undefined,
      icon: ExternalLink,
    },
  ].filter((item) => item.value);

  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>
          <User className="inline h-4 w-4 mr-1.5" /> Informações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="cliente-info-grid">
          {items.map((item) => (
            <div key={item.label} className="cliente-info-row">
              <dt>{item.label}</dt>
              <dd>
                {item.href ? (
                  <div className="cliente-info-value-line">
                    <a
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      title={item.value ?? undefined}
                    >
                      {item.value}
                    </a>
                    {item.label === "WhatsApp" && whatsappCopyValue ? (
                      <WhatsAppCopyButton value={whatsappCopyValue} />
                    ) : null}
                  </div>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
          {items.length === 0 ? (
            <p className="cliente-empty">Sem informações adicionais.</p>
          ) : null}
        </dl>
        {cliente.briefing ? (
          <div className="cliente-text-block">
            <strong>Briefing</strong>
            <p>{htmlToPlainText(cliente.briefing)}</p>
          </div>
        ) : null}
        {cliente.notes ? (
          <div className="cliente-text-block">
            <strong>Notas</strong>
            <p>{cliente.notes}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StageHistoryCard({
  history,
  stages,
  profiles,
}: {
  history: ClienteStageHistoryEntry[];
  stages: ClienteStage[];
  profiles: Record<string, ClienteProfile>;
}) {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const stageHistory = history;

  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>
          <History className="inline h-4 w-4 mr-1.5" /> Histórico de etapas e atribuições
        </CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="cliente-empty">Sem alterações registradas.</p>
        ) : (
          <ol className="cliente-timeline">
            {stageHistory.map((entry) => {
              const from = entry.from_stage_id ? stageById.get(entry.from_stage_id) : null;
              const to = entry.to_stage_id ? stageById.get(entry.to_stage_id) : null;
              const author = profileName(profiles, entry.changed_by);
              const fromAssigned = profileName(profiles, entry.from_assigned_to);
              const toAssigned = profileName(profiles, entry.to_assigned_to);
              const isAssignment = entry.action_type === "assignment_change";

              const actionLabel =
                entry.action_type === "stage_change"
                  ? "Mudança de etapa"
                  : isAssignment
                    ? "Mudança de responsável"
                    : entry.action_type === "created"
                      ? "Cliente criado"
                      : entry.action_type ?? "Ação";

              const title =
                isAssignment ? (
                  <>
                    <strong>{fromAssigned ?? "Sem responsável anterior"}</strong>
                    {" → "}
                    <strong>{toAssigned ?? "Sem responsável atual"}</strong>
                  </>
                ) : (
                  <>
                    {from?.name ? `${from.name} → ` : ""}
                    <strong>{to?.name ?? "—"}</strong>
                  </>
                );

              return (
                <li key={entry.id} className="cliente-timeline-item">
                  <span
                    className="cliente-timeline-dot"
                    style={{ background: to?.color ?? "var(--text-subtle)" }}
                    aria-hidden
                  />
                  <div>
                    <p className="cliente-timeline-title">
                      {title}
                    </p>
                    <p className="cliente-timeline-meta">
                      {fmtDateTime(entry.created_at)}
                      {author ? ` · por ${author}` : ""}
                      {actionLabel ? ` · ${actionLabel}` : ""}
                    </p>
                    {entry.reason ? <p className="cliente-timeline-note">{entry.reason}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function CommentsCard({
  clienteId,
  comments,
  profiles,
}: {
  clienteId: string;
  comments: ClienteComment[];
  profiles: Record<string, ClienteProfile>;
}) {
  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>
          <MessageSquare className="inline h-4 w-4 mr-1.5" /> Comentários internos
        </CardTitle>
      </CardHeader>
      <CardContent className="cliente-comments">
        <ClienteAddComment clienteId={clienteId} />
        {comments.length === 0 ? (
          <p className="cliente-empty">Ainda sem comentários.</p>
        ) : (
          <ul className="cliente-comment-list">
            {comments.map((c) => (
              <li key={c.id} className="cliente-comment">
                <header>
                  <strong>{profileName(profiles, c.author_id) ?? "—"}</strong>
                  <span>{fmtDateTime(c.created_at)}</span>
                </header>
                <p>{htmlToPlainText(c.content)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TasksCard({
  tasks,
  stages,
  profiles,
}: {
  tasks: ClienteTask[];
  stages: ClienteStage[];
  profiles: Record<string, ClienteProfile>;
}) {
  const stageById = new Map(stages.map((s) => [s.id, s]));

  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>
          <ClipboardList className="inline h-4 w-4 mr-1.5" /> Tarefas em aberto
          {tasks.length > 0 ? <span className="cliente-count-pill">{tasks.length}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="cliente-empty">Sem tarefas em aberto.</p>
        ) : (
          <ul className="cliente-task-list">
            {tasks.map((task) => {
              const stage = task.pipeline_stage_id ? stageById.get(task.pipeline_stage_id) : null;
              const assigned = profileName(profiles, task.assigned_to);
              return (
                <li key={task.id} className="cliente-task">
                  <div className="cliente-task-head">
                    <p className="cliente-task-title">{task.title ?? "Tarefa sem título"}</p>
                    {task.is_urgent ? <Badge className="cliente-urgent">Urgente</Badge> : null}
                  </div>
                  <p className="cliente-task-meta">
                    {stage ? (
                      <span
                        className="cliente-task-stage"
                        style={{ color: stage.color, borderColor: stage.color }}
                      >
                        {stage.name}
                      </span>
                    ) : null}
                    {task.status ? <span>{task.status}</span> : null}
                    {task.priority ? <span>prioridade: {task.priority}</span> : null}
                    {assigned ? <span>· {assigned}</span> : null}
                    {task.deadline ? <span>prazo: {fmtDate(task.deadline)}</span> : null}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MeetingsCard({
  meetings,
  profiles,
}: {
  meetings: ClienteMeeting[];
  profiles: Record<string, ClienteProfile>;
}) {
  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>
          <Calendar className="inline h-4 w-4 mr-1.5" /> Reuniões
          {meetings.length > 0 ? <span className="cliente-count-pill">{meetings.length}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <p className="cliente-empty">Sem reuniões registradas.</p>
        ) : (
          <ul className="cliente-meeting-list">
            {meetings.map((m) => {
              const organizer = profileName(profiles, m.organizer_id);
              return (
                <li key={m.id} className="cliente-meeting">
                  <div>
                    <p className="cliente-meeting-title">{m.title ?? "Reunião"}</p>
                    <p className="cliente-meeting-meta">
                      {fmtDateTime(m.scheduled_at)}
                      {m.duration_minutes ? ` · ${m.duration_minutes} min` : ""}
                      {organizer ? ` · ${organizer}` : ""}
                      {m.status ? ` · ${m.status}` : ""}
                    </p>
                  </div>
                  {m.meeting_link ? (
                    <a
                      className="cliente-meeting-link"
                      href={m.meeting_link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AdjustmentsCard({
  adjustments,
  profiles,
}: {
  adjustments: ClienteAdjustment[];
  profiles: Record<string, ClienteProfile>;
}) {
  return (
    <Card className="panel-card">
      <CardHeader>
        <CardTitle>
          <Wrench className="inline h-4 w-4 mr-1.5" /> Ajustes
          {adjustments.length > 0 ? <span className="cliente-count-pill">{adjustments.length}</span> : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {adjustments.length === 0 ? (
          <p className="cliente-empty">Sem ajustes registrados.</p>
        ) : (
          <ul className="cliente-adjust-list">
            {adjustments.map((a) => {
              const author = profileName(profiles, a.created_by);
              const isDone = Boolean(a.completed_at);
              return (
                <li key={a.id} className={`cliente-adjust ${isDone ? "is-done" : ""}`}>
                  <header>
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    <strong>{a.adjustment_type ?? "Ajuste"}</strong>
                    <span>{a.status ?? "—"}</span>
                  </header>
                  <p className="cliente-adjust-content">{a.content ?? "—"}</p>
                  <p className="cliente-adjust-meta">
                    {fmtDateTime(a.created_at)}
                    {author ? ` · por ${author}` : ""}
                    {isDone ? ` · concluído em ${fmtDateTime(a.completed_at)}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
