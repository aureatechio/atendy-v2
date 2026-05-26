"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, Clock3, Sparkles, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AtribuirResponsavelDrawer,
  type ResponsavelOption,
} from "@/components/dashboard/atribuir-responsavel-drawer";
import { ClienteQuickDrawer } from "@/components/cliente/cliente-quick-drawer";
import type { ClienteListItem } from "@/lib/clientes/types";
import type { SlaStatus } from "@/lib/types";

export interface SemProprietarioClienteItem {
  id: string;
  nome: string;
  segmentoNome: string | null;
  diasNaEtapa: number;
  slaStatus: SlaStatus;
}

const SLA_LABEL: Record<SlaStatus, string> = {
  ok: "No prazo",
  warning: "Em alerta",
  overdue: "SLA estourado",
  none: "Sem SLA",
};

function getInitials(nome: string): string {
  const cleaned = nome.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

function formatDias(d: number): string {
  if (d < 1) return "hoje";
  const dias = Math.floor(d);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function buildClienteListItemSkeleton(cliente: SemProprietarioClienteItem): ClienteListItem {
  return {
    id: cliente.id,
    code: null,
    nome: cliente.nome,
    nomeFantasia: null,
    companyName: null,
    companyCnpj: null,
    whatsapp: null,
    email: null,
    instagram: null,
    stageId: null,
    stageName: "Mais novo",
    stageColor: "#a78bfa",
    stageOrder: 1,
    responsavelId: null,
    responsavelNome: null,
    segmentoId: null,
    segmentoNome: cliente.segmentoNome,
    subsegmentoId: null,
    subsegmentoNome: null,
    celebridade: null,
    praca: null,
    classificacao: null,
    valor: 0,
    prazoFinal: null,
    createdAt: null,
    stageEnteredAt: null,
    contratoAssinadoAt: null,
    inicioVigencia: null,
    archivedAt: null,
    isArchived: false,
    diasNaEtapa: cliente.diasNaEtapa,
    tarefasAbertas: 0,
    tarefasUrgentes: 0,
    nextMeetingAt: null,
    lastActivityAt: null,
    linkPastaDrive: null,
    linkProposta: null,
    linkPastaEntrega: null,
  };
}

export function SemProprietarioMaisNovoCard({
  clientes,
  responsaveis,
}: {
  clientes: SemProprietarioClienteItem[];
  responsaveis: ResponsavelOption[];
}) {
  const [detailClienteId, setDetailClienteId] = useState<string | null>(null);
  const [assignClienteId, setAssignClienteId] = useState<string | null>(null);
  const [atribuidos, setAtribuidos] = useState<Set<string>>(new Set());

  const visibleClientes = useMemo(
    () => clientes.filter((c) => !atribuidos.has(c.id)),
    [clientes, atribuidos],
  );
  const total = visibleClientes.length;

  const assignCliente =
    assignClienteId !== null ? clientes.find((c) => c.id === assignClienteId) ?? null : null;
  const detailCliente = useMemo(() => {
    if (!detailClienteId) return null;
    const found = clientes.find((c) => c.id === detailClienteId);
    return found ? buildClienteListItemSkeleton(found) : null;
  }, [detailClienteId, clientes]);

  const handleOpenDetail = (id: string) => setDetailClienteId(id);
  const handleCloseDetail = () => setDetailClienteId(null);
  const handleOpenAssign = (id: string) => setAssignClienteId(id);
  const handleCloseAssign = () => setAssignClienteId(null);
  const handleAssignSuccess = (clienteId: string) => {
    setAtribuidos((prev) => {
      const next = new Set(prev);
      next.add(clienteId);
      return next;
    });
  };

  return (
    <>
      <Card className="sem-proprietario-card">
        <CardHeader className="sem-proprietario-card-header">
          <div className="sem-proprietario-card-heading">
            <span className="sem-proprietario-card-icon" aria-hidden>
              <Sparkles size={16} />
            </span>
            <div className="sem-proprietario-card-titlewrap">
              <CardTitle className="sem-proprietario-card-title">
                Mais novo sem proprietário
                {total > 0 ? <span className="sem-proprietario-card-count">{total}</span> : null}
              </CardTitle>
              <p className="sem-proprietario-card-subtitle">
                Atribua responsáveis antes que o SLA estoure.
              </p>
            </div>
          </div>
          {total > 0 ? (
            <Link
              href="/clientes?stage=mais-novo&responsavel=sem"
              className="sem-proprietario-card-action"
            >
              Ver todos
              <ArrowUpRight size={14} />
            </Link>
          ) : null}
        </CardHeader>
        <CardContent className="sem-proprietario-card-content">
          {total === 0 ? (
            <div className="sem-proprietario-empty">
              <div className="sem-proprietario-empty-icon" aria-hidden>
                <Sparkles size={20} />
              </div>
              <p className="sem-proprietario-empty-title">Tudo em dia por aqui.</p>
              <p className="sem-proprietario-empty-text">
                Nenhum cliente em &quot;Mais novo&quot; aguardando atribuição.
              </p>
            </div>
          ) : (
            <ul className="sem-proprietario-list" role="list">
              {visibleClientes.map((cliente) => {
                const slaClass =
                  cliente.slaStatus === "overdue"
                    ? "sem-proprietario-sla--overdue"
                    : cliente.slaStatus === "warning"
                      ? "sem-proprietario-sla--warning"
                      : cliente.slaStatus === "ok"
                        ? "sem-proprietario-sla--ok"
                        : "sem-proprietario-sla--none";
                return (
                  <li key={cliente.id}>
                    <div
                      className="sem-proprietario-item"
                      onClick={() => handleOpenDetail(cliente.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleOpenDetail(cliente.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Abrir detalhes de ${cliente.nome}`}
                    >
                      <span className="sem-proprietario-avatar" aria-hidden>
                        {getInitials(cliente.nome)}
                      </span>
                      <span className="sem-proprietario-main">
                        <span className="sem-proprietario-name">{cliente.nome}</span>
                        <span className="sem-proprietario-meta">
                          <Clock3 size={12} aria-hidden />
                          <span>{formatDias(cliente.diasNaEtapa)} na etapa</span>
                          {cliente.segmentoNome ? (
                            <>
                              <span aria-hidden className="sem-proprietario-meta-dot">
                                ·
                              </span>
                              <span className="sem-proprietario-meta-segment">
                                {cliente.segmentoNome}
                              </span>
                            </>
                          ) : null}
                        </span>
                      </span>
                      <span className={`sem-proprietario-sla ${slaClass}`}>
                        {SLA_LABEL[cliente.slaStatus]}
                      </span>
                      <button
                        type="button"
                        className="sem-proprietario-assign"
                        aria-label={`Atribuir responsável para ${cliente.nome}`}
                        title="Atribuir responsável"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAssign(cliente.id);
                        }}
                      >
                        <UserPlus size={14} aria-hidden />
                      </button>
                      <ChevronRight
                        size={14}
                        className="sem-proprietario-chevron"
                        aria-hidden
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AtribuirResponsavelDrawer
        cliente={assignCliente}
        responsaveis={responsaveis}
        onClose={handleCloseAssign}
        onSuccess={handleAssignSuccess}
      />

      <ClienteQuickDrawer cliente={detailCliente} onClose={handleCloseDetail} />
    </>
  );
}
