"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Clock3, Search, UserRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SlaEstouradoClienteItem } from "@/lib/dashboard/sla-estourado";
import { normalizeText } from "@/lib/utils";

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

function formatAtraso(hoursRemaining: number | null): string {
  if (hoursRemaining === null) return "SLA estourado";
  const hours = Math.abs(hoursRemaining);
  if (hours < 24) {
    const value = Math.max(1, Math.ceil(hours));
    return `${value}h em atraso`;
  }
  const days = hours / 24;
  const label = days >= 10 ? String(Math.round(days)) : days.toFixed(1).replace(".", ",");
  return `${label} dia${days >= 1.5 ? "s" : ""} em atraso`;
}

function totalLabel(total: number) {
  return `${total} cliente${total === 1 ? "" : "s"}`;
}

export function SlaEstouradoListCard({
  clientes,
}: {
  clientes: SlaEstouradoClienteItem[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    if (!q) return clientes;
    return clientes.filter((cliente) => {
      const haystack = [
        cliente.nome,
        cliente.stageName,
        cliente.segmentoNome,
        cliente.responsavelNome,
      ]
        .map(normalizeText)
        .join(" ");
      return haystack.includes(q);
    });
  }, [clientes, query]);

  const total = clientes.length;

  return (
    <Card className="sla-estourado-list-card">
      <CardHeader className="sla-estourado-list-header">
        <div className="sla-estourado-list-heading">
          <span className="sla-estourado-list-icon" aria-hidden>
            <AlertTriangle size={16} />
          </span>
          <div className="sla-estourado-list-titlewrap">
            <CardTitle className="sla-estourado-list-title">
              Clientes com SLA estourado
              <span className="sla-estourado-list-count">{totalLabel(total)}</span>
            </CardTitle>
            <p className="sla-estourado-list-subtitle">
              Lista filtrada por clientes fora do prazo em qualquer etapa ativa.
            </p>
          </div>
        </div>
        {total > 0 ? (
          <div className="sla-estourado-list-search">
            <Search size={14} aria-hidden />
            <input
              type="search"
              aria-label="Filtrar clientes com SLA estourado"
              placeholder="Filtrar por cliente, etapa, responsável ou segmento..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="sla-estourado-list-content">
        {total === 0 ? (
          <div className="sla-estourado-list-empty">
            <div className="sla-estourado-list-empty-icon" aria-hidden>
              <AlertTriangle size={20} />
            </div>
            <p className="sla-estourado-list-empty-title">Nenhum SLA estourado.</p>
            <p className="sla-estourado-list-empty-text">
              Todos os clientes ativos estão dentro do prazo configurado.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="sla-estourado-list-empty">
            <p className="sla-estourado-list-empty-title">Nenhum resultado.</p>
            <p className="sla-estourado-list-empty-text">Tente outro filtro.</p>
          </div>
        ) : (
          <ul className="sla-estourado-list" role="list">
            {filtered.map((cliente) => (
              <li key={cliente.id}>
                <Link
                  href={`/clientes/${cliente.id}`}
                  className="sla-estourado-list-item"
                  aria-label={`Abrir detalhes de ${cliente.nome}`}
                >
                  <span className="sem-proprietario-avatar" aria-hidden>
                    {getInitials(cliente.nome)}
                  </span>
                  <span className="sla-estourado-list-main">
                    <span className="sla-estourado-list-name">{cliente.nome}</span>
                    <span className="sla-estourado-list-meta">
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
                      {cliente.responsavelNome ? (
                        <>
                          <span aria-hidden className="sem-proprietario-meta-dot">
                            ·
                          </span>
                          <span className="sla-estourado-responsavel">
                            <UserRound size={11} aria-hidden />
                            {cliente.responsavelNome}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="sla-estourado-overdue-pill">
                    {formatAtraso(cliente.slaHoursRemaining)}
                  </span>
                  <ArrowUpRight size={14} className="sla-estourado-list-arrow" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
