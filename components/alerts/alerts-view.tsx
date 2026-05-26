"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import {
  AlertTriangle,
  BellOff,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Filter,
  Loader2,
  MessageCircleOff,
  RefreshCw,
  Search,
  TimerReset,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAlerts, ALERT_TYPE_LABELS } from "@/hooks/useAlerts";
import {
  REMINDER_OPTIONS,
  type ReminderOption,
} from "@/lib/alerts/notifications";
import type { Alert, AlertType } from "@/lib/types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(deadline: string, now: number) {
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) return "—";
  const diffH = (target - now) / 3_600_000;
  const abs = Math.abs(diffH);
  const fmt = (h: number) => {
    if (h >= 24) return `${Math.round(h / 24)}d`;
    if (h >= 1) return `${Math.round(h)}h`;
    return `${Math.max(1, Math.round(h * 60))}min`;
  };
  return diffH < 0 ? `atrasado ${fmt(abs)}` : `vence em ${fmt(abs)}`;
}

function typeIcon(type: AlertType) {
  if (type === "task_overdue") return <ClipboardList className="h-3.5 w-3.5" aria-hidden />;
  if (type === "followup") return <MessageCircleOff className="h-3.5 w-3.5" aria-hidden />;
  if (type === "contract_expiry") return <CalendarClock className="h-3.5 w-3.5" aria-hidden />;
  return <TimerReset className="h-3.5 w-3.5" aria-hidden />;
}

const TYPE_OPTIONS: { value: "all" | AlertType; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "stage_sla", label: "SLA da etapa" },
  { value: "task_overdue", label: "Tarefa atrasada" },
  { value: "followup", label: "Follow-up" },
  { value: "contract_expiry", label: "Fim de vigência" },
];

const STATUS_OPTIONS: {
  value: "all" | "overdue" | "warning";
  label: string;
}[] = [
  { value: "all", label: "Todos status" },
  { value: "overdue", label: "Atrasados" },
  { value: "warning", label: "Em alerta" },
];

type RowAction = "remind" | "resolve";
type RowState = { action: RowAction; phase: "pending" | "done" } | null;

interface IconActionButtonProps {
  label: string;
  icon: React.ReactNode;
  intent: "snooze" | "resolve" | "open";
  href?: string;
  onClick?: () => void;
  state?: RowState;
}

function IconActionButton({
  label,
  icon,
  intent,
  href,
  onClick,
  state,
}: IconActionButtonProps) {
  const isPending = state?.phase === "pending";
  const isDone = state?.phase === "done";
  const content = isPending ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : isDone ? (
    <Check className="h-3.5 w-3.5" />
  ) : (
    icon
  );
  const className = `alerts-action-btn alerts-action-btn--${intent}`;
  if (href) {
    return (
      <Link
        href={href as Route}
        className={className}
        title={label}
        aria-label={label}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={isPending || isDone}
      data-state={state?.phase}
    >
      {content}
    </button>
  );
}

export function AlertsView() {
  const { allAlerts, loading, refetch } = useAlerts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | AlertType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue" | "warning">(
    "all",
  );
  const [responsavelFilter, setResponsavelFilter] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  const responsaveis = useMemo(() => {
    const options = new Map<string, string>();
    for (const a of allAlerts) {
      if (a.cliente.responsavelId) {
        options.set(
          a.cliente.responsavelId,
          a.cliente.responsavelNome ?? "Sem nome",
        );
      }
    }
    return [...options.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], "pt-BR"),
    );
  }, [allAlerts]);

  const filtered = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return allAlerts.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (
        responsavelFilter !== "all" &&
        a.cliente.responsavelId !== responsavelFilter
      )
        return false;
      if (normalizedSearch) {
        const hay = [
          a.cliente.nome,
          a.stage?.name ?? "",
          a.task?.title ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(normalizedSearch)) return false;
      }
      return true;
    });
  }, [allAlerts, typeFilter, statusFilter, responsavelFilter, search]);

  const counts = useMemo(() => {
    const c = {
      stage_sla: 0,
      task_overdue: 0,
      followup: 0,
      contract_expiry: 0,
      overdue: 0,
      warning: 0,
    };
    for (const a of allAlerts) {
      c[a.type]++;
      if (a.status === "overdue") c.overdue++;
      else c.warning++;
    }
    return c;
  }, [allAlerts]);

  function setRowState(id: string, next: RowState) {
    setRowStates((prev) => ({ ...prev, [id]: next }));
  }

  function logOpened(alert: Alert) {
    void fetch("/api/alerts/toast-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "opened", alertIds: [alert.id] }),
    }).catch(() => {});
  }

  async function handleReminder(alert: Alert, reminder: ReminderOption) {
    setRowState(alert.id, { action: "remind", phase: "pending" });
    const res = await fetch(`/api/alerts/${alert.id}/remind`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reminder }),
    });
    if (!res.ok) {
      setRowState(alert.id, null);
      toast.error("Falha ao criar lembrete");
      return;
    }
    setRowState(alert.id, { action: "remind", phase: "done" });
    toast.success("Lembrete criado");
    setTimeout(() => {
      void refetch();
    }, 350);
  }

  async function handleResolve(alert: Alert) {
    setRowState(alert.id, { action: "resolve", phase: "pending" });
    const res = await fetch(`/api/alerts/${alert.id}/resolve`, {
      method: "POST",
    });
    if (!res.ok) {
      setRowState(alert.id, null);
      toast.error("Falha ao resolver alerta");
      return;
    }
    setRowState(alert.id, { action: "resolve", phase: "done" });
    toast.success("Alerta resolvido");
    setTimeout(() => {
      void refetch();
    }, 350);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 250);
  }

  const now = Date.now();
  const hasActiveFilters =
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    responsavelFilter !== "all" ||
    search.trim() !== "";
  const emptyMessage =
    hasActiveFilters && typeFilter === "contract_expiry" && counts.contract_expiry === 0
      ? "Nenhum alerta de vigência aberto. Se há contratos vencidos, aguarde o cron de alertas processar a nova regra."
      : hasActiveFilters
        ? "Nenhum alerta com os filtros atuais."
        : "Tudo dentro do prazo.";
  const tableBodyKey = `${typeFilter}:${statusFilter}:${responsavelFilter}:${search}`;

  function clearFilters() {
    setTypeFilter("all");
    setStatusFilter("all");
    setResponsavelFilter("all");
    setSearch("");
  }

  return (
    <div className="alerts-view">
      <section className="alerts-cards" aria-label="Resumo de alertas">
        <Card>
          <CardContent>
            <div className="alerts-card-row">
              <div>
                <div className="alerts-card-label">SLA da etapa</div>
                <div className="alerts-card-value">{counts.stage_sla}</div>
              </div>
              <div className="alerts-card-icon alerts-card-icon--sla">
                <TimerReset className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="alerts-card-row">
              <div>
                <div className="alerts-card-label">Tarefas atrasadas</div>
                <div className="alerts-card-value">{counts.task_overdue}</div>
              </div>
              <div className="alerts-card-icon alerts-card-icon--task">
                <ClipboardList className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="alerts-card-row">
              <div>
                <div className="alerts-card-label">Follow-up</div>
                <div className="alerts-card-value">{counts.followup}</div>
              </div>
              <div className="alerts-card-icon alerts-card-icon--followup">
                <MessageCircleOff className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="alerts-card-row">
              <div>
                <div className="alerts-card-label">Fim de vigência</div>
                <div className="alerts-card-value">{counts.contract_expiry}</div>
              </div>
              <div className="alerts-card-icon alerts-card-icon--contract">
                <CalendarClock className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="alerts-toolbar-card">
        <CardContent>
          <div className="alerts-toolbar">
            <div className="alerts-toolbar-search">
              <Search className="h-4 w-4" aria-hidden />
              <Input
                placeholder="Buscar por cliente, etapa ou tarefa…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Buscar alertas"
              />
            </div>

            <Select
              className="alerts-toolbar-select"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as "all" | AlertType)
              }
              aria-label="Filtrar por tipo"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>

            <Select
              className="alerts-toolbar-select"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "overdue" | "warning",
                )
              }
              aria-label="Filtrar por status"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>

            <Select
              className="alerts-toolbar-select"
              value={responsavelFilter}
              onChange={(e) => setResponsavelFilter(e.target.value)}
              aria-label="Filtrar por responsável"
            >
              <option value="all">Todos responsáveis</option>
              {responsaveis.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>

            <div className="alerts-toolbar-actions">
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="alerts-toolbar-clear"
                  onClick={clearFilters}
                >
                  Limpar
                </button>
              ) : null}
              <button
                type="button"
                className="alerts-toolbar-refresh"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                aria-label="Atualizar"
                title="Atualizar"
              >
                <RefreshCw
                  className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  aria-hidden
                />
              </button>
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="alerts-toolbar-meta">
              <Filter className="h-3 w-3" aria-hidden />
              <span>
                {filtered.length} de {allAlerts.length} alertas
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="alerts-table-wrap">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="alerts-col-status">Status</TableHead>
              <TableHead className="alerts-col-cliente">Cliente</TableHead>
              <TableHead className="alerts-col-type">Tipo</TableHead>
              <TableHead className="alerts-col-context">Etapa / Tarefa</TableHead>
              <TableHead className="alerts-col-time">Vence em</TableHead>
              <TableHead className="alerts-col-fired">Disparado</TableHead>
              <TableHead className="alerts-col-actions">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody key={tableBodyKey}>
            {loading && filtered.length === 0 ? (
              <TableRow>
                <TableCell className="alerts-table-state">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span>Carregando alertas…</span>
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell className="alerts-table-state">
                  <CheckCircle2
                    className="h-5 w-5"
                    style={{ color: "var(--success, #22c55e)" }}
                    aria-hidden
                  />
                  <span>{emptyMessage}</span>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((a) => {
                const state = rowStates[a.id] ?? null;
                return (
                  <TableRow
                    key={a.id}
                    className="alerts-row"
                    data-status={a.status}
                    data-state={state?.phase}
                  >
                    <TableCell className="alerts-col-status">
                      {a.status === "overdue" ? (
                        <Badge variant="danger">
                          <AlertTriangle className="h-3 w-3" aria-hidden />
                          Atrasado
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <TimerReset className="h-3 w-3" aria-hidden />
                          Em alerta
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="alerts-col-cliente">
                      <Link
                        href={`/clientes/${a.cliente.id}`}
                        className="alerts-cliente-link"
                      >
                        {a.cliente.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="alerts-col-type">
                      <span className="alerts-type-chip" data-type={a.type}>
                        {typeIcon(a.type)}
                        <span>{ALERT_TYPE_LABELS[a.type]}</span>
                      </span>
                    </TableCell>
                    <TableCell className="alerts-col-context">
                      <span className="alerts-context-text">
                        {a.type === "task_overdue"
                          ? (a.task?.title ?? "Tarefa sem título")
                          : a.type === "contract_expiry"
                            ? "Vigência do contrato"
                          : (a.stage?.name ?? "—")}
                      </span>
                    </TableCell>
                    <TableCell className="alerts-col-time">
                      <span
                        className="alerts-time-text"
                        data-status={a.status}
                      >
                        {formatRelative(a.deadline, now)}
                      </span>
                    </TableCell>
                    <TableCell className="alerts-col-fired">
                      <span className="alerts-fired-text">
                        {formatDateTime(a.firedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="alerts-col-actions">
                      <div className="alerts-actions">
                        <IconActionButton
                          label="Abrir cliente"
                          icon={<ExternalLink className="h-3.5 w-3.5" />}
                          intent="open"
                          href={`/clientes/${a.cliente.id}`}
                          onClick={() => logOpened(a)}
                        />
                        <details className="alerts-reminder-menu">
                          <summary
                            className="alerts-action-btn alerts-action-btn--snooze"
                            title="Criar lembrete"
                            aria-label="Criar lembrete"
                            data-state={
                              state?.action === "remind" ? state.phase : undefined
                            }
                          >
                            {state?.action === "remind" &&
                            state.phase === "pending" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : state?.action === "remind" &&
                              state.phase === "done" ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <BellOff className="h-3.5 w-3.5" />
                            )}
                          </summary>
                          <div className="alerts-reminder-menu-content">
                            {REMINDER_OPTIONS.map((option) => (
                              <button
                                key={String(option.value)}
                                type="button"
                                className="alerts-reminder-menu-item"
                                onClick={() => void handleReminder(a, option.value)}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </details>
                        <IconActionButton
                          label="Marcar como resolvido"
                          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                          intent="resolve"
                          onClick={() => void handleResolve(a)}
                          state={
                            state?.action === "resolve" ? state : null
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
