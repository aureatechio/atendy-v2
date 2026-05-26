"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  Check,
  ClipboardList,
  MessageCircleOff,
  TimerReset,
} from "lucide-react";
import { useAlerts, ALERT_TYPE_LABELS } from "@/hooks/useAlerts";
import type { Alert, AlertType } from "@/lib/types";

const SECTION_ORDER: AlertType[] = [
  "stage_sla",
  "task_overdue",
  "followup",
  "contract_expiry",
];
const ITEMS_PER_SECTION = 4;

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

function rowLabel(a: Alert) {
  if (a.type === "task_overdue") return a.task?.title ?? "Tarefa sem título";
  if (a.type === "contract_expiry") return "Vigência do contrato";
  return a.stage?.name ?? "";
}

function logOpened(alert: Alert) {
  void fetch("/api/alerts/toast-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event: "opened", alertIds: [alert.id] }),
  }).catch(() => {});
}

export function SlaBell() {
  // Singleton de toasts: APENAS este hook deve disparar notificações para
  // evitar cascata duplicada (a página /alertas usa enableToasts=false).
  const { alerts } = useAlerts({ enableToasts: true });
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
    <div className="alerts-bell" data-open={open} ref={rootRef}>
      <button
        type="button"
        className="alerts-bell-trigger"
        aria-label={`Notificações: ${total} ${total === 1 ? "alerta" : "alertas"}`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {total > 0 ? (
          <span
            className={`alerts-bell-badge ${overdue > 0 ? "is-danger" : "is-warning"}`}
            aria-hidden
          >
            {total > 99 ? "99+" : total}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="alerts-bell-panel" role="menu">
          <header className="alerts-bell-panel-head">
            <div className="alerts-bell-panel-title">
              <h4>Alertas</h4>
              <Link
                href="/alertas"
                className="alerts-bell-link-action"
                onClick={() => setOpen(false)}
              >
                Ver todos
              </Link>
            </div>
            <div className="alerts-bell-summary">
              <span className="alerts-bell-summary-chip is-danger">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {overdue} atrasados
              </span>
              <span className="alerts-bell-summary-chip is-warning">
                <TimerReset className="h-3 w-3" aria-hidden />
                {warning} em alerta
              </span>
            </div>
          </header>

          {alerts.length === 0 ? (
            <div className="alerts-bell-empty">
              <Check className="h-5 w-5" aria-hidden />
              <p>Tudo dentro do prazo.</p>
            </div>
          ) : (
            <div className="alerts-bell-body">
              {SECTION_ORDER.map((sectionType) => {
                const list = byType.get(sectionType);
                if (!list || list.length === 0) return null;
                const items = list.slice(0, ITEMS_PER_SECTION);
                const remaining = list.length - items.length;
                return (
                  <section
                    key={sectionType}
                    className="alerts-bell-section"
                    data-type={sectionType}
                  >
                    <header className="alerts-bell-section-head">
                      <span className="alerts-bell-section-icon" aria-hidden>
                        {typeIcon(sectionType)}
                      </span>
                      <span className="alerts-bell-section-name">
                        {ALERT_TYPE_LABELS[sectionType]}
                      </span>
                      <span className="alerts-bell-section-count">{list.length}</span>
                    </header>
                    <ul className="alerts-bell-list">
                      {items.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/clientes/${a.cliente.id}`}
                            className="alerts-bell-row"
                            data-status={a.status}
                            onClick={() => {
                              logOpened(a);
                              setOpen(false);
                            }}
                          >
                            <span
                              className="alerts-bell-row-dot"
                              data-status={a.status}
                              aria-hidden
                            />
                            <span className="alerts-bell-row-body">
                              <span className="alerts-bell-row-title">
                                {a.cliente.nome}
                              </span>
                              <span className="alerts-bell-row-meta">
                                {rowLabel(a)}
                              </span>
                            </span>
                            <span
                              className="alerts-bell-row-time"
                              data-status={a.status}
                            >
                              {formatRelative(a.deadline, now)}
                            </span>
                          </Link>
                        </li>
                      ))}
                      {remaining > 0 ? (
                        <li>
                          <Link
                            href={`/alertas?type=${sectionType}`}
                            className="alerts-bell-row-more"
                            onClick={() => setOpen(false)}
                          >
                            + {remaining} {remaining === 1 ? "outro" : "outros"}
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
