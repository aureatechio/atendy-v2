"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Filter, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ClienteSummary = {
  code: string | null;
  company_cnpj: string | null;
  email: string | null;
  id: string;
  nome: string | null;
  nomecliente: string | null;
  whatsapp: string | null;
};

type AuditEventRow = {
  action: string;
  actor: {
    email: string | null;
    id: string | null;
    role: string | null;
    source: string;
  };
  after: unknown;
  before: unknown;
  cliente: ClienteSummary | null;
  cliente_id: string | null;
  created_at: string;
  diff: unknown;
  entity_id: string | null;
  entity_type: string;
  error_message: string | null;
  id: string;
  metadata: unknown;
  operation_id: string | null;
  request_path: string | null;
  status: string;
  user_agent: string | null;
};

type AuditResponse = {
  events: AuditEventRow[];
  page: number;
  pageSize: number;
  total: number;
};

type Filters = {
  action: string;
  actor: string;
  cliente: string;
  from: string;
  operationId: string;
  pageSize: string;
  to: string;
};

const initialFilters: Filters = {
  action: "",
  actor: "",
  cliente: "",
  from: "",
  operationId: "",
  pageSize: "25",
  to: "",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function clienteName(cliente: ClienteSummary | null, fallbackId: string | null) {
  if (!cliente) return fallbackId ? fallbackId.slice(0, 8) : "—";
  return cliente.nomecliente ?? cliente.nome ?? cliente.email ?? cliente.code ?? cliente.id.slice(0, 8);
}

function pretty(value: unknown) {
  if (value === null || value === undefined) return "null";
  return JSON.stringify(value, null, 2);
}

function shortId(value: string | null) {
  return value ? value.slice(0, 8) : "—";
}

export function AuditEventsView() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [applied, setApplied] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditEventRow | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / Number(applied.pageSize || 25)));

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", applied.pageSize);
    if (applied.from) params.set("from", applied.from);
    if (applied.to) params.set("to", applied.to);
    if (applied.cliente.trim()) params.set("cliente", applied.cliente.trim());
    if (applied.actor.trim()) params.set("actor", applied.actor.trim());
    if (applied.action.trim()) params.set("action", applied.action.trim());
    if (applied.operationId.trim()) params.set("operation_id", applied.operationId.trim());
    return params.toString();
  }, [applied, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch(`/api/admin/audit-events?${queryString}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as AuditResponse & { error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setError(payload.error ?? "Nao foi possivel carregar auditoria.");
          return;
        }
        setEvents(payload.events);
        setTotal(payload.total);
        setSelected((current) => {
          if (!current) return null;
          return payload.events.find((event) => event.id === current.id) ?? null;
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro inesperado.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryString]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplied(filters);
    setPage(1);
  }

  function clearFilters() {
    setFilters(initialFilters);
    setApplied(initialFilters);
    setPage(1);
  }

  function filterByOperation(operationId: string) {
    const next = { ...initialFilters, operationId, pageSize: applied.pageSize };
    setFilters(next);
    setApplied(next);
    setPage(1);
  }

  async function copy(value: string) {
    await navigator.clipboard?.writeText(value);
  }

  const hasFilters = Object.entries(applied).some(([key, value]) => key !== "pageSize" && value.trim() !== "");

  return (
    <div className="audit-view">
      <section className="panel-card audit-toolbar-card">
        <form className="audit-toolbar" onSubmit={submitFilters}>
          <label className="audit-field audit-field--wide">
            <span>Cliente</span>
            <Input
              value={filters.cliente}
              onChange={(event) => updateFilter("cliente", event.target.value)}
              placeholder="Código, nome, e-mail, CNPJ ou telefone"
            />
          </label>
          <label className="audit-field">
            <span>Ator</span>
            <Input
              value={filters.actor}
              onChange={(event) => updateFilter("actor", event.target.value)}
              placeholder="E-mail ou UUID"
            />
          </label>
          <label className="audit-field">
            <span>Ação</span>
            <Input
              value={filters.action}
              onChange={(event) => updateFilter("action", event.target.value)}
              placeholder="cliente.archived"
            />
          </label>
          <label className="audit-field audit-field--wide">
            <span>Operation ID</span>
            <Input
              value={filters.operationId}
              onChange={(event) => updateFilter("operationId", event.target.value)}
              placeholder="UUID da operação"
            />
          </label>
          <label className="audit-field">
            <span>De</span>
            <Input type="date" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
          </label>
          <label className="audit-field">
            <span>Até</span>
            <Input type="date" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />
          </label>
          <label className="audit-field audit-field--small">
            <span>Linhas</span>
            <Select value={filters.pageSize} onChange={(event) => updateFilter("pageSize", event.target.value)}>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </label>
          <div className="audit-toolbar-actions">
            <Button type="submit">
              <Search />
              Buscar
            </Button>
            {hasFilters ? (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                <X />
                Limpar
              </Button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="panel-card">
        <div className="panel-card-header audit-list-header">
          <div>
            <p className="auth-eyebrow">Auditoria</p>
            <h2>Eventos registrados</h2>
            <p>
              {loading ? "Carregando..." : `${total} evento${total === 1 ? "" : "s"} encontrado${total === 1 ? "" : "s"}`}
            </p>
          </div>
          <Filter aria-hidden />
        </div>

        {error ? (
          <div className="panel-card-content">
            <div className="auth-alert admin-message">{error}</div>
          </div>
        ) : null}

        <div className="panel-card-content audit-table-wrap">
          <table className="admin-users-table audit-table">
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Cliente</th>
                <th>Ator</th>
                <th>Status</th>
                <th>Operação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    <Loader2 className="settings-spin" /> Carregando eventos...
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">Nenhum evento encontrado.</td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr key={event.id} className="audit-row" onClick={() => setSelected(event)}>
                    <td>{formatDateTime(event.created_at)}</td>
                    <td><code>{event.action}</code></td>
                    <td>{clienteName(event.cliente, event.cliente_id)}</td>
                    <td>
                      <span>{event.actor.email ?? event.actor.source}</span>
                      {event.actor.role ? <small>{event.actor.role}</small> : null}
                    </td>
                    <td>
                      <span className={`audit-status audit-status--${event.status}`}>{event.status}</span>
                    </td>
                    <td>
                      {event.operation_id ? (
                        <button
                          type="button"
                          className="audit-operation"
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            filterByOperation(event.operation_id!);
                          }}
                          title={event.operation_id}
                        >
                          {shortId(event.operation_id)}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="audit-pagination">
          <Button type="button" variant="ghost" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </footer>
      </section>

      {selected ? (
        <section className="panel-card audit-detail">
          <header className="panel-card-header audit-detail-header">
            <div>
              <p className="auth-eyebrow">{formatDateTime(selected.created_at)}</p>
              <h3>{selected.action}</h3>
              <p>{selected.entity_type}{selected.entity_id ? ` · ${selected.entity_id}` : ""}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <X />
            </Button>
          </header>
          <div className="panel-card-content audit-detail-content">
            <div className="audit-detail-grid">
              <Detail label="Ator" value={selected.actor.email ?? selected.actor.source} />
              <Detail label="Papel" value={selected.actor.role ?? "—"} />
              <Detail label="Cliente" value={clienteName(selected.cliente, selected.cliente_id)} />
              <Detail label="Path" value={selected.request_path ?? "—"} />
              <Detail label="Status" value={selected.status} />
              <Detail label="Erro" value={selected.error_message ?? "—"} />
            </div>
            {selected.operation_id ? (
              <div className="audit-detail-operation">
                <code>{selected.operation_id}</code>
                <Button type="button" variant="ghost" size="sm" onClick={() => copy(selected.operation_id!)}>
                  <Copy />
                  Copiar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => filterByOperation(selected.operation_id!)}>
                  Filtrar operação
                </Button>
              </div>
            ) : null}
            <JsonBlock title="Diff" value={selected.diff} />
            <JsonBlock title="Antes" value={selected.before} />
            <JsonBlock title="Depois" value={selected.after} />
            <JsonBlock title="Metadata" value={selected.metadata} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="audit-detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="audit-json" open={title === "Diff"}>
      <summary>{title}</summary>
      <pre>{pretty(value)}</pre>
    </details>
  );
}
