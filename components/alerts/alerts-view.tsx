"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  BellOff,
  Check,
  ClipboardList,
  MessageCircleOff,
  TimerReset,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { Alert, AlertType } from "@/lib/types";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(deadline: string, now: number) {
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) return "—";
  const diffH = (target - now) / 3_600_000;
  const abs = Math.abs(diffH);
  const fmt = (h: number) =>
    h >= 24 ? `${Math.round(h / 24)}d` : `${Math.max(1, Math.round(h))}h`;
  return diffH < 0 ? `atrasado ${fmt(abs)}` : `vence em ${fmt(abs)}`;
}

function typeIcon(type: AlertType) {
  if (type === "task_overdue") return <ClipboardList className="h-3 w-3" />;
  if (type === "followup") return <MessageCircleOff className="h-3 w-3" />;
  return <TimerReset className="h-3 w-3" />;
}

const TYPE_OPTIONS: { value: "all" | AlertType; label: string }[] = [
  { value: "all", label: "Todos os tipos" },
  { value: "stage_sla", label: "SLA da etapa" },
  { value: "task_overdue", label: "Tarefa atrasada" },
  { value: "followup", label: "Follow-up" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "overdue", label: "Atrasados" },
  { value: "warning", label: "Em alerta" },
];

export function AlertsView() {
  const { allAlerts, loading, refetch } = useAlerts();
  const [typeFilter, setTypeFilter] = useState<"all" | AlertType>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "overdue" | "warning">(
    "all",
  );
  const [responsavelFilter, setResponsavelFilter] = useState<string>("all");
  const [pending, startTransition] = useTransition();

  const responsaveis = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAlerts) {
      if (a.cliente.responsavelId) set.add(a.cliente.responsavelId);
    }
    return [...set];
  }, [allAlerts]);

  const filtered = useMemo(() => {
    return allAlerts.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (
        responsavelFilter !== "all" &&
        a.cliente.responsavelId !== responsavelFilter
      )
        return false;
      return true;
    });
  }, [allAlerts, typeFilter, statusFilter, responsavelFilter]);

  const counts = useMemo(() => {
    const c = { stage_sla: 0, task_overdue: 0, followup: 0 };
    for (const a of allAlerts) c[a.type]++;
    return c;
  }, [allAlerts]);

  async function handleSnooze(alert: Alert) {
    const res = await fetch(`/api/alerts/${alert.id}/snooze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hours: 24 }),
    });
    if (!res.ok) {
      toast.error("Falha ao adiar alerta");
      return;
    }
    toast.success("Alerta adiado por 24h");
    startTransition(() => {
      void refetch();
    });
  }

  async function handleResolve(alert: Alert) {
    const res = await fetch(`/api/alerts/${alert.id}/resolve`, {
      method: "POST",
    });
    if (!res.ok) {
      toast.error("Falha ao resolver alerta");
      return;
    }
    toast.success("Alerta marcado como resolvido");
    startTransition(() => {
      void refetch();
    });
  }

  const now = Date.now();

  return (
    <div className="alerts-view">
      <div className="alerts-cards">
        <Card>
          <CardContent>
            <div className="alerts-card-label">SLA da etapa</div>
            <div className="alerts-card-value">{counts.stage_sla}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="alerts-card-label">Tarefas atrasadas</div>
            <div className="alerts-card-value">{counts.task_overdue}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="alerts-card-label">Follow-up</div>
            <div className="alerts-card-value">{counts.followup}</div>
          </CardContent>
        </Card>
      </div>

      <div className="alerts-filters">
        <Select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as "all" | AlertType)
          }
          aria-label="Tipo"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "all" | "overdue" | "warning",
            )
          }
          aria-label="Status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select
          value={responsavelFilter}
          onChange={(e) => setResponsavelFilter(e.target.value)}
          aria-label="Responsável"
        >
          <option value="all">Todos responsáveis</option>
          {responsaveis.map((r) => (
            <option key={r} value={r}>
              {r.slice(0, 8)}…
            </option>
          ))}
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Etapa / Tarefa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Disparado</TableHead>
            <TableHead>Vence em</TableHead>
            <TableHead style={{ textAlign: "right" }}>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && filtered.length === 0 ? (
            <TableRow>
              <TableCell className="alerts-table-empty">Carregando…</TableCell>
            </TableRow>
          ) : filtered.length === 0 ? (
            <TableRow>
              <TableCell className="alerts-table-empty">
                Nenhum alerta com os filtros atuais.
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <span className="alerts-type-chip">
                    {typeIcon(a.type)}
                    <span>{ALERT_TYPE_LABELS[a.type]}</span>
                  </span>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/clientes/${a.cliente.id}`}
                    className="alerts-link"
                  >
                    {a.cliente.nome}
                  </Link>
                </TableCell>
                <TableCell>
                  {a.type === "task_overdue"
                    ? (a.task?.title ?? "Tarefa sem título")
                    : (a.stage?.name ?? "—")}
                </TableCell>
                <TableCell>
                  {a.status === "overdue" ? (
                    <Badge variant="danger">
                      <AlertTriangle className="h-3 w-3" /> Atrasado
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      <TimerReset className="h-3 w-3" /> Em alerta
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{formatDateTime(a.firedAt)}</TableCell>
                <TableCell>{formatRelative(a.deadline, now)}</TableCell>
                <TableCell style={{ textAlign: "right" }}>
                  <div className="alerts-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => void handleSnooze(a)}
                      title="Adiar 24h"
                    >
                      <BellOff className="h-3 w-3" /> Adiar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => void handleResolve(a)}
                      title="Marcar como resolvido"
                    >
                      <Check className="h-3 w-3" /> Resolver
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
