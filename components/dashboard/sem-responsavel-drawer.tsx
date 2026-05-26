"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Clock3, Search, UserPlus, UserX, X } from "lucide-react";
import {
  AtribuirResponsavelDrawer,
  type ResponsavelOption,
} from "@/components/dashboard/atribuir-responsavel-drawer";
import type { SlaStatus } from "@/lib/types";

export interface SemResponsavelClienteItem {
  id: string;
  nome: string;
  segmentoNome: string | null;
  diasNaEtapa: number;
  slaStatus: SlaStatus;
  stageSlug: string;
  stageName: string;
  stageColor: string;
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

interface Props {
  open: boolean;
  clientes: SemResponsavelClienteItem[];
  responsaveis: ResponsavelOption[];
  onClose: () => void;
}

export function SemResponsavelDrawer({
  open,
  clientes,
  responsaveis,
  onClose,
}: Props) {
  const [openClienteId, setOpenClienteId] = useState<string | null>(null);
  const [atribuidos, setAtribuidos] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
    }
  }, [open]);

  const visibleClientes = useMemo(
    () => clientes.filter((c) => !atribuidos.has(c.id)),
    [clientes, atribuidos],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleClientes;
    return visibleClientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.stageName.toLowerCase().includes(q) ||
        (c.segmentoNome ?? "").toLowerCase().includes(q),
    );
  }, [visibleClientes, query]);

  const selectedCliente =
    openClienteId !== null
      ? clientes.find((c) => c.id === openClienteId) ?? null
      : null;

  const handleSuccess = (clienteId: string) => {
    setAtribuidos((prev) => {
      const next = new Set(prev);
      next.add(clienteId);
      return next;
    });
  };

  if (!open) return null;

  const total = visibleClientes.length;

  return (
    <>
      <div
        className="sem-responsavel-drawer-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Clientes sem responsável"
      >
        <button
          type="button"
          className="sem-responsavel-drawer-backdrop"
          onClick={onClose}
          aria-label="Fechar painel"
        />
        <aside className="sem-responsavel-drawer">
          <header className="sem-responsavel-drawer-head">
            <div className="sem-responsavel-drawer-heading">
              <span className="sem-responsavel-drawer-icon" aria-hidden>
                <UserX size={16} />
              </span>
              <div className="sem-responsavel-drawer-titlewrap">
                <h2 className="sem-responsavel-drawer-title">
                  Sem responsável
                  <span className="sem-responsavel-drawer-count">{total}</span>
                </h2>
                <p className="sem-responsavel-drawer-subtitle">
                  Clientes ativos no funil pendentes de atribuição.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="sem-responsavel-drawer-close"
              onClick={onClose}
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          </header>

          {total > 0 ? (
            <div className="sem-responsavel-drawer-searchwrap">
              <Search size={14} aria-hidden className="sem-responsavel-drawer-searchicon" />
              <input
                type="text"
                className="sem-responsavel-drawer-searchinput"
                placeholder="Buscar por nome, etapa ou segmento..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : null}

          <div className="sem-responsavel-drawer-body">
            {total === 0 ? (
              <div className="sem-responsavel-drawer-empty">
                <div className="sem-responsavel-drawer-empty-icon" aria-hidden>
                  <UserPlus size={20} />
                </div>
                <p className="sem-responsavel-drawer-empty-title">
                  Todos atribuídos.
                </p>
                <p className="sem-responsavel-drawer-empty-text">
                  Nenhum cliente ativo aguardando atribuição no momento.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="sem-responsavel-drawer-empty">
                <p className="sem-responsavel-drawer-empty-title">
                  Nenhum resultado.
                </p>
                <p className="sem-responsavel-drawer-empty-text">
                  Tente outra busca.
                </p>
              </div>
            ) : (
              <ul className="sem-responsavel-drawer-list" role="list">
                {filtered.map((cliente) => {
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
                      <button
                        type="button"
                        className="sem-responsavel-drawer-item"
                        onClick={() => setOpenClienteId(cliente.id)}
                        aria-label={`Atribuir responsável para ${cliente.nome}`}
                      >
                        <span className="sem-proprietario-avatar" aria-hidden>
                          {getInitials(cliente.nome)}
                        </span>
                        <span className="sem-responsavel-drawer-item-main">
                          <span className="sem-responsavel-drawer-item-name">
                            {cliente.nome}
                          </span>
                          <span className="sem-responsavel-drawer-item-meta">
                            <span
                              className="sem-responsavel-drawer-stage"
                              style={{
                                background: `color-mix(in srgb, ${cliente.stageColor} 14%, transparent)`,
                                color: cliente.stageColor,
                                borderColor: `color-mix(in srgb, ${cliente.stageColor} 28%, transparent)`,
                              }}
                            >
                              {cliente.stageName}
                            </span>
                            <Clock3 size={11} aria-hidden />
                            <span>{formatDias(cliente.diasNaEtapa)} na etapa</span>
                            {cliente.segmentoNome ? (
                              <>
                                <span
                                  aria-hidden
                                  className="sem-proprietario-meta-dot"
                                >
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
                        <span
                          className="sem-proprietario-assign"
                          aria-label="Atribuir responsável"
                          role="presentation"
                        >
                          <UserPlus size={14} aria-hidden />
                        </span>
                        <ChevronRight
                          size={14}
                          className="sem-proprietario-chevron"
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <AtribuirResponsavelDrawer
        cliente={selectedCliente}
        responsaveis={responsaveis}
        onClose={() => setOpenClienteId(null)}
        onSuccess={handleSuccess}
      />
    </>
  );
}
