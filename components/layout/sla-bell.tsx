"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, TimerReset } from "lucide-react";
import { useSlaAlerts } from "@/hooks/useSlaAlerts";
import type { SlaAlert } from "@/lib/types";

function formatRelative(deadline: string, now: number) {
  const target = new Date(deadline).getTime();
  if (Number.isNaN(target)) return "—";
  const diffH = (target - now) / 3_600_000;
  const abs = Math.abs(diffH);
  const fmt = (h: number) =>
    h >= 24 ? `${Math.round(h / 24)}d` : `${Math.max(1, Math.round(h))}h`;
  return diffH < 0 ? `atrasado ${fmt(abs)}` : `vence em ${fmt(abs)}`;
}

export function SlaBell() {
  const { alerts } = useSlaAlerts();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { overdue, warning } = useMemo(
    () => ({
      overdue: alerts.filter((a) => a.status === "overdue").length,
      warning: alerts.filter((a) => a.status === "warning").length,
    }),
    [alerts],
  );
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
        aria-label={`Notificações de SLA: ${total} ${total === 1 ? "alerta" : "alertas"}`}
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
            <h4>Alertas de SLA</h4>
            <p>
              {overdue} {overdue === 1 ? "atrasado" : "atrasados"} ·{" "}
              {warning} em alerta
            </p>
          </header>
          {alerts.length === 0 ? (
            <p className="sla-bell-empty">Tudo dentro do prazo.</p>
          ) : (
            <ul className="sla-bell-list">
              {alerts.map((a: SlaAlert) => (
                <li key={a.id} className="sla-bell-item">
                  <Link
                    href={`/clientes/${a.cliente.id}`}
                    className="sla-bell-item-link"
                    onClick={() => setOpen(false)}
                  >
                    <span
                      className={`sla-bell-pill sla-bell-pill--${a.status}`}
                      aria-label={a.status === "overdue" ? "Atrasado" : "Em alerta"}
                    >
                      {a.status === "overdue" ? (
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                      ) : (
                        <TimerReset className="h-3 w-3" aria-hidden />
                      )}
                    </span>
                    <span className="sla-bell-item-body">
                      <strong>{a.cliente.nome}</strong>
                      <span className="sla-bell-item-meta">
                        {a.stage.name} · {formatRelative(a.deadline, now)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
