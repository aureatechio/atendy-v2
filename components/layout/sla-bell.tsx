"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  ClipboardList,
  MessageCircleOff,
  TimerReset,
} from "lucide-react";
import { useAlerts, ALERT_TYPE_LABELS } from "@/hooks/useAlerts";
import type { Alert, AlertType } from "@/lib/types";

function formatRelative(deadline: string, now: number) {
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) return "—";
  const diffH = (target - now) / 3_600_000;
  const abs = Math.abs(diffH);
  const fmt = (h: number) =>
    h >= 24 ? `${Math.round(h / 24)}d` : `${Math.max(1, Math.round(h))}h`;
  return diffH < 0 ? `atrasado ${fmt(abs)}` : `vence em ${fmt(abs)}`;
}

function iconForType(type: AlertType, status: "warning" | "overdue") {
  if (type === "task_overdue") {
    return <ClipboardList className="h-3 w-3" aria-hidden />;
  }
  if (type === "followup") {
    return <MessageCircleOff className="h-3 w-3" aria-hidden />;
  }
  return status === "overdue" ? (
    <AlertTriangle className="h-3 w-3" aria-hidden />
  ) : (
    <TimerReset className="h-3 w-3" aria-hidden />
  );
}

function labelForRow(a: Alert) {
  if (a.type === "task_overdue") return a.task?.title ?? "Tarefa sem título";
  return a.stage?.name ?? "";
}

const SECTION_ORDER: AlertType[] = ["stage_sla", "task_overdue", "followup"];

export function SlaBell() {
  const { alerts } = useAlerts();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { overdue, warning, byType } = useMemo(() => {
    const grouped = new Map<AlertType, Alert[]>();
    let o = 0;
    let w = 0;
    for (const a of alerts) {
      if (a.status === "overdue") o++;
      else w++;
      const arr = grouped.get(a.type) ?? [];
      arr.push(a);
      grouped.set(a.type, arr);
    }
    return { overdue: o, warning: w, byType: grouped };
  }, [alerts]);
  const total = alerts.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const now = Date.now();

  return (
    <div className="sla-bell" data-open={open} ref={rootRef}>
      <button
        type="button"
        className="sla-bell-trigger"
        aria-label={`Notificações de alertas: ${total} ${total === 1 ? "alerta" : "alertas"}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {total > 0 ? (
          <span
            className={`sla-bell-badge ${overdue > 0 ? "is-danger" : "is-warning"}`}
            aria-hidden
          >
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="sla-bell-dropdown" role="menu">
          <header className="sla-bell-head">
            <h4>Alertas</h4>
            <p>
              {overdue} {overdue === 1 ? "atrasado" : "atrasados"} · {warning} em
              alerta
            </p>
          </header>
          {alerts.length === 0 ? (
            <p className="sla-bell-empty">Tudo dentro do prazo.</p>
          ) : (
            <>
              {SECTION_ORDER.map((type) => {
                const list = byType.get(type);
                if (!list || list.length === 0) return null;
                return (
                  <div key={type}>
                    <div className="sla-bell-section-label">
                      {ALERT_TYPE_LABELS[type]} · {list.length}
                    </div>
                    <ul className="sla-bell-list">
                      {list.slice(0, 6).map((a) => (
                        <li key={a.id} className="sla-bell-item">
                          <Link
                            href={`/clientes/${a.cliente.id}`}
                            className="sla-bell-item-link"
                            onClick={() => setOpen(false)}
                          >
                            <span
                              className={`sla-bell-pill sla-bell-pill--${a.status}`}
                              aria-label={
                                a.status === "overdue" ? "Atrasado" : "Em alerta"
                              }
                            >
                              {iconForType(a.type, a.status)}
                            </span>
                            <span className="sla-bell-item-body">
                              <strong>{a.cliente.nome}</strong>
                              <span className="sla-bell-item-meta">
                                {labelForRow(a)} · {formatRelative(a.deadline, now)}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </>
          )}
          <Link
            href="/alertas"
            className="sla-bell-footer-link"
            onClick={() => setOpen(false)}
          >
            Ver todos os alertas
          </Link>
        </div>
      ) : null}
    </div>
  );
}
