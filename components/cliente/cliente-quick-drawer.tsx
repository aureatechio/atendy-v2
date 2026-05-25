"use client";

import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildWhatsappHref, formatNullableDate } from "@/lib/clientes/format";
import { currencyFormatter, htmlToPlainText } from "@/lib/utils";
import type { ClienteListItem, ClienteQuickDetail } from "@/lib/clientes/types";

interface Props {
  cliente: ClienteListItem | null;
  onClose: () => void;
}

function DetailLine({ label, value }: { label: string; value: string | null }) {
  const text = value || "—";

  return (
    <div className="clientes-drawer-line">
      <span>{label}</span>
      <strong title={text}>{text}</strong>
    </div>
  );
}

function DrawerMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="clientes-drawer-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function DrawerLoadingState({ label }: { label: string }) {
  return (
    <div className="clientes-drawer-state inline">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

function DrawerEmptyState({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="clientes-drawer-empty">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

function ExternalResourceLinks({ links }: { links: Array<{ label: string; href: string | null }> }) {
  const availableLinks = links.filter((link): link is { label: string; href: string } => Boolean(link.href));

  return (
    <div className="clientes-drawer-links">
      {availableLinks.map((link) => (
        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
          {link.label} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ))}
      {availableLinks.length === 0 ? <p>Nenhum link cadastrado.</p> : null}
    </div>
  );
}

export function ClienteQuickDrawer({ cliente, onClose }: Props) {
  const [detail, setDetail] = useState<ClienteQuickDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = cliente !== null;
  const current = detail?.cliente ?? cliente;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!cliente) {
      setDetail(null);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setDetail(null);
    setError(null);
    setLoading(true);

    fetch(`/api/clientes/${cliente.id}/quick`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar o resumo.");
        setDetail(payload.detail as ClienteQuickDetail);
      })
      .catch((err) => {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [cliente]);

  if (!open || !current) return null;

  const wa = buildWhatsappHref(current.whatsapp);
  const loadingDetail = loading && !detail;
  const metrics = [
    { icon: Wallet, label: "Valor", value: currencyFormatter.format(current.valor) },
    { icon: Calendar, label: "Prazo", value: formatNullableDate(current.prazoFinal) },
    { icon: UserRound, label: "Responsável", value: current.responsavelNome ?? "—" },
  ];
  const quickDetails = [
    { label: "Empresa", value: current.companyName },
    { label: "CNPJ", value: current.companyCnpj },
    { label: "Instagram", value: current.instagram },
    { label: "Segmento", value: current.segmentoNome },
    { label: "Subsegmento", value: current.subsegmentoNome },
    { label: "Praça", value: current.praca },
    { label: "Celebridade", value: current.celebridade },
    { label: "Vigência", value: formatNullableDate(current.inicioVigencia) },
  ];
  const resourceLinks = [
    { label: "Drive", href: current.linkPastaDrive },
    { label: "Proposta", href: current.linkProposta },
    { label: "Entrega", href: current.linkPastaEntrega },
  ];

  return (
    <div className="clientes-drawer-overlay" role="dialog" aria-modal="true">
      <button type="button" className="clientes-drawer-backdrop" onClick={onClose} aria-label="Fechar painel" />
      <aside className="clientes-drawer">
        <header className="clientes-drawer-head">
          <div className="clientes-drawer-title-block">
            <span className="clientes-drawer-eyebrow">Resumo do cliente</span>
            <h2>{current.nome}</h2>
            <div className="clientes-drawer-meta">
              {current.code ? <span>{current.code}</span> : null}
              {current.stageName ? (
                <span className="clientes-stage-pill" style={{ ["--stage-color" as string]: current.stageColor ?? "#64748b" }}>
                  {current.stageName}
                </span>
              ) : null}
              {current.isArchived ? <Badge>Arquivado</Badge> : null}
            </div>
          </div>
          <div className="clientes-drawer-head-actions">
            <a
              className="ds-btn ds-btn-primary clientes-action-link"
              href={`/clientes/${current.id}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir página completa em nova aba"
            >
              <ArrowUpRight className="h-4 w-4" /> Ver detalhes
            </a>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="clientes-drawer-actions">
          {wa ? (
            <a className="ds-btn ds-btn-outline clientes-action-link" href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          ) : null}
          {current.email ? (
            <a className="ds-btn ds-btn-outline clientes-action-link" href={`mailto:${current.email}`}>
              <Mail className="h-4 w-4" /> E-mail
            </a>
          ) : null}
          {!wa && !current.email ? (
            <span className="clientes-drawer-actions-empty">Nenhum contato cadastrado.</span>
          ) : null}
        </div>

        <div className="clientes-drawer-kpis">
          {metrics.map((metric) => (
            <DrawerMetric key={metric.label} {...metric} />
          ))}
        </div>

        <DrawerSection title="Dados rápidos">
          <div className="clientes-drawer-lines">
            {quickDetails.map((item) => (
              <DetailLine key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </DrawerSection>

        <DrawerSection title="Links">
          <ExternalResourceLinks links={resourceLinks} />
        </DrawerSection>

        {error ? (
          <div className="clientes-drawer-error">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : null}

        <DrawerSection title="Tarefas abertas">
          {loadingDetail ? (
            <DrawerLoadingState label="Carregando tarefas..." />
          ) : (
            <div className="clientes-drawer-list">
              {detail && detail.tasks.length === 0 ? (
                <DrawerEmptyState icon={Inbox} label="Nenhuma tarefa aberta." />
              ) : null}
              {detail?.tasks.map((task) => (
                <article key={task.id} className="clientes-drawer-item">
                  <div>
                    <strong>{task.title ?? "Tarefa sem título"}</strong>
                    <span>{task.assignedToName ?? "Sem responsável"} · {formatNullableDate(task.deadline)}</span>
                  </div>
                  {task.isUrgent ? <Badge variant="danger">Urgente</Badge> : null}
                </article>
              ))}
            </div>
          )}
        </DrawerSection>

        <DrawerSection title="Próximas reuniões">
          {loadingDetail ? (
            <DrawerLoadingState label="Carregando reuniões..." />
          ) : (
            <div className="clientes-drawer-list">
              {detail && detail.meetings.length === 0 ? (
                <DrawerEmptyState icon={Calendar} label="Nenhuma reunião agendada." />
              ) : null}
              {detail?.meetings.map((meeting) => (
                <article key={meeting.id} className="clientes-drawer-item">
                  <div>
                    <strong>{meeting.title ?? "Reunião sem título"}</strong>
                    <span>{formatNullableDate(meeting.scheduledAt)} · {meeting.organizerName ?? "Sem organizador"}</span>
                  </div>
                  {meeting.meetingLink ? (
                    <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" aria-label="Abrir reunião">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </DrawerSection>

        <DrawerSection title="Últimos comentários">
          {loadingDetail ? (
            <DrawerLoadingState label="Carregando comentários..." />
          ) : (
            <div className="clientes-drawer-list">
              {detail && detail.comments.length === 0 ? (
                <DrawerEmptyState icon={MessageCircle} label="Nenhum comentário recente." />
              ) : null}
              {detail?.comments.map((comment) => (
                <article key={comment.id} className="clientes-drawer-comment">
                  <header>
                    <strong>{comment.authorName ?? "Atendy"}</strong>
                    <span>{formatNullableDate(comment.createdAt)}</span>
                  </header>
                  <p>{htmlToPlainText(comment.content)}</p>
                </article>
              ))}
            </div>
          )}
        </DrawerSection>

        {detail && detail.tasks.length > 0 ? (
          <div className="clientes-drawer-foot">
            <CheckCircle2 className="h-4 w-4" />
            <span>{detail.tasks.length} tarefa{detail.tasks.length === 1 ? "" : "s"} em aberto no resumo.</span>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
