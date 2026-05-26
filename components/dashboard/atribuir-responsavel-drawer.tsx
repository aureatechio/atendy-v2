"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { assignResponsavel } from "@/app/(protected)/actions/assign-responsavel";
import type { SlaStatus } from "@/lib/types";

export interface ResponsavelOption {
  id: string;
  fullName: string;
  role: string | null;
}

export interface AtribuirResponsavelCliente {
  id: string;
  nome: string;
  segmentoNome: string | null;
  diasNaEtapa: number;
  slaStatus: SlaStatus;
}

interface Props {
  cliente: AtribuirResponsavelCliente | null;
  responsaveis: ResponsavelOption[];
  onClose: () => void;
  onSuccess?: (clienteId: string, responsavelId: string) => void;
}

const SLA_LABEL: Record<SlaStatus, string> = {
  ok: "No prazo",
  warning: "Em alerta",
  overdue: "SLA estourado",
  none: "Sem SLA",
};

const ROLE_LABEL: Record<string, string> = {
  attendant: "Atendimento",
  producao: "Produção",
  cs_head: "CS Head",
  admin: "Admin",
  dev: "Dev",
};

function formatDias(d: number): string {
  if (d < 1) return "hoje";
  const dias = Math.floor(d);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

function getInitials(nome: string): string {
  const cleaned = nome.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

export function AtribuirResponsavelDrawer({ cliente, responsaveis, onClose, onSuccess }: Props) {
  const open = cliente !== null;
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedId(null);
    setError(null);
    setSuccess(false);
  }, [cliente?.id, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return responsaveis;
    return responsaveis.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [responsaveis, query]);

  if (!open || !cliente) return null;

  const slaClass =
    cliente.slaStatus === "overdue"
      ? "atribuir-modal-sla--overdue"
      : cliente.slaStatus === "warning"
        ? "atribuir-modal-sla--warning"
        : cliente.slaStatus === "ok"
          ? "atribuir-modal-sla--ok"
          : "atribuir-modal-sla--none";

  const handleSubmit = () => {
    if (!selectedId || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await assignResponsavel({ clienteId: cliente.id, responsavelId: selectedId });
      if (!result.ok) {
        setError(result.error ?? "Erro ao atribuir responsável.");
        return;
      }
      setSuccess(true);
      onSuccess?.(cliente.id, selectedId);
      setTimeout(() => {
        onClose();
      }, 600);
    });
  };

  return (
    <div className="atribuir-modal-overlay" role="dialog" aria-modal="true" aria-label="Atribuir responsável">
      <button
        type="button"
        className="atribuir-modal-backdrop"
        onClick={onClose}
        aria-label="Fechar painel"
      />
      <div className="atribuir-modal">
        <header className="atribuir-modal-head">
          <div className="atribuir-modal-eyebrow">
            <UserRound size={12} aria-hidden />
            Atribuir responsável
          </div>
          <button
            type="button"
            className="atribuir-modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </header>

        <section className="atribuir-modal-client">
          <span className="atribuir-modal-avatar" aria-hidden>
            {getInitials(cliente.nome)}
          </span>
          <div className="atribuir-modal-clientinfo">
            <h2 className="atribuir-modal-title">{cliente.nome}</h2>
            <div className="atribuir-modal-meta">
              <span className="atribuir-modal-meta-item">
                <Clock3 size={11} aria-hidden />
                {formatDias(cliente.diasNaEtapa)} na etapa
              </span>
              {cliente.segmentoNome ? (
                <>
                  <span aria-hidden className="atribuir-modal-meta-dot">
                    ·
                  </span>
                  <span className="atribuir-modal-meta-item">{cliente.segmentoNome}</span>
                </>
              ) : null}
            </div>
            <div className="atribuir-modal-pills">
              <span className={`atribuir-modal-sla ${slaClass}`}>{SLA_LABEL[cliente.slaStatus]}</span>
              <span className="atribuir-modal-stage">Mais novo</span>
            </div>
          </div>
          <a
            href={`/clientes/${cliente.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="atribuir-modal-detaillink"
            title="Abrir página do cliente em nova aba"
          >
            Detalhes <ArrowUpRight size={12} />
          </a>
        </section>

        <section className="atribuir-modal-body">
          <label className="atribuir-modal-label" htmlFor="atribuir-search">
            Quem vai assumir?
          </label>
          <div className="atribuir-modal-searchwrap">
            <Search size={14} aria-hidden className="atribuir-modal-searchicon" />
            <input
              id="atribuir-search"
              type="text"
              className="atribuir-modal-searchinput"
              placeholder="Buscar por nome..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <ul className="atribuir-modal-options" role="listbox">
            {filtered.length === 0 ? (
              <li className="atribuir-modal-empty">Nenhum responsável encontrado.</li>
            ) : (
              filtered.map((option) => {
                const isSelected = option.id === selectedId;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`atribuir-modal-option ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedId(option.id)}
                    >
                      <span className="atribuir-modal-option-avatar" aria-hidden>
                        {getInitials(option.fullName)}
                      </span>
                      <span className="atribuir-modal-option-info">
                        <span className="atribuir-modal-option-name">{option.fullName}</span>
                        {option.role ? (
                          <span className="atribuir-modal-option-role">
                            {ROLE_LABEL[option.role] ?? option.role}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check size={16} className="atribuir-modal-option-check" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        {error ? (
          <div className="atribuir-modal-error">
            <AlertTriangle size={14} aria-hidden />
            <span>{error}</span>
          </div>
        ) : null}

        <footer className="atribuir-modal-foot">
          <button
            type="button"
            className="atribuir-modal-cancel"
            onClick={onClose}
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="atribuir-modal-submit"
            onClick={handleSubmit}
            disabled={!selectedId || isPending || success}
          >
            {success ? (
              <>
                <CheckCircle2 size={14} aria-hidden /> Atribuído
              </>
            ) : isPending ? (
              <>
                <Loader2 size={14} aria-hidden className="animate-spin" /> Atribuindo...
              </>
            ) : (
              "Confirmar atribuição"
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
