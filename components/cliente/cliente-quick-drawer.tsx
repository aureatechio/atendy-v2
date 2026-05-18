"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { currencyFormatter, ptDateFormatter } from "@/lib/utils";
import type { ClienteListItem, ClienteQuickDetail } from "@/lib/clientes/types";

interface Props {
  cliente: ClienteListItem | null;
  onClose: () => void;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fmtDate(value: string | null) {
  const date = parseDate(value);
  return date ? ptDateFormatter.format(date) : "—";
}

function whatsappLink(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function DetailLine({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="clientes-drawer-line">
      <span>{label}</span>
      <strong title={value ?? "—"}>{value || "—"}</strong>
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

  const wa = whatsappLink(current.whatsapp);

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
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="clientes-drawer-actions">
          {wa ? (
            <a className="ds-btn ds-btn-primary clientes-action-link" href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          ) : null}
          {current.email ? (
            <a className="ds-btn ds-btn-outline clientes-action-link" href={`mailto:${current.email}`}>
              <Mail className="h-4 w-4" /> E-mail
            </a>
          ) : null}
          <Link className="ds-btn ds-btn-secondary clientes-action-link" href={`/clientes/${current.id}`}>
            <ExternalLink className="h-4 w-4" /> Página completa
          </Link>
        </div>

        <div className="clientes-drawer-kpis">
          <div>
            <Wallet className="h-4 w-4" />
            <span>Valor</span>
            <strong>{currencyFormatter.format(current.valor)}</strong>
          </div>
          <div>
            <Calendar className="h-4 w-4" />
            <span>Prazo</span>
            <strong>{fmtDate(current.prazoFinal)}</strong>
          </div>
          <div>
            <UserRound className="h-4 w-4" />
            <span>Responsável</span>
            <strong>{current.responsavelNome ?? "—"}</strong>
          </div>
        </div>

        <section className="clientes-drawer-section">
          <h3>Dados rápidos</h3>
          <div className="clientes-drawer-lines">
            <DetailLine label="Empresa" value={current.companyName} />
            <DetailLine label="CNPJ" value={current.companyCnpj} />
            <DetailLine label="Instagram" value={current.instagram} />
            <DetailLine label="Segmento" value={current.segmentoNome} />
            <DetailLine label="Subsegmento" value={current.subsegmentoNome} />
            <DetailLine label="Praça" value={current.praca} />
            <DetailLine label="Celebridade" value={current.celebridade} />
            <DetailLine label="Vigência" value={fmtDate(current.inicioVigencia)} />
          </div>
        </section>

        <section className="clientes-drawer-section">
          <h3>Links</h3>
          <div className="clientes-drawer-links">
            {current.linkPastaDrive ? <a href={current.linkPastaDrive} target="_blank" rel="noopener noreferrer">Drive <ExternalLink className="h-3.5 w-3.5" /></a> : null}
            {current.linkProposta ? <a href={current.linkProposta} target="_blank" rel="noopener noreferrer">Proposta <ExternalLink className="h-3.5 w-3.5" /></a> : null}
            {current.linkPastaEntrega ? <a href={current.linkPastaEntrega} target="_blank" rel="noopener noreferrer">Entrega <ExternalLink className="h-3.5 w-3.5" /></a> : null}
            {!current.linkPastaDrive && !current.linkProposta && !current.linkPastaEntrega ? <p>Nenhum link cadastrado.</p> : null}
          </div>
        </section>

        {loading ? (
          <div className="clientes-drawer-state">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando atividades...
          </div>
        ) : null}

        {error ? (
          <div className="clientes-drawer-error">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : null}

        {detail ? (
          <>
            <section className="clientes-drawer-section">
              <h3>Tarefas abertas</h3>
              <div className="clientes-drawer-list">
                {detail.tasks.length === 0 ? <p>Nenhuma tarefa aberta.</p> : null}
                {detail.tasks.map((task) => (
                  <article key={task.id} className="clientes-drawer-item">
                    <div>
                      <strong>{task.title ?? "Tarefa sem título"}</strong>
                      <span>{task.assignedToName ?? "Sem responsável"} · {fmtDate(task.deadline)}</span>
                    </div>
                    {task.isUrgent ? <Badge variant="danger">Urgente</Badge> : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="clientes-drawer-section">
              <h3>Próximas reuniões</h3>
              <div className="clientes-drawer-list">
                {detail.meetings.length === 0 ? <p>Nenhuma reunião encontrada.</p> : null}
                {detail.meetings.map((meeting) => (
                  <article key={meeting.id} className="clientes-drawer-item">
                    <div>
                      <strong>{meeting.title ?? "Reunião sem título"}</strong>
                      <span>{fmtDate(meeting.scheduledAt)} · {meeting.organizerName ?? "Sem organizador"}</span>
                    </div>
                    {meeting.meetingLink ? (
                      <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" aria-label="Abrir reunião">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="clientes-drawer-section">
              <h3>Últimos comentários</h3>
              <div className="clientes-drawer-list">
                {detail.comments.length === 0 ? <p>Nenhum comentário recente.</p> : null}
                {detail.comments.map((comment) => (
                  <article key={comment.id} className="clientes-drawer-comment">
                    <header>
                      <strong>{comment.authorName ?? "Atendy"}</strong>
                      <span>{fmtDate(comment.createdAt)}</span>
                    </header>
                    <p>{comment.content}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : null}

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
