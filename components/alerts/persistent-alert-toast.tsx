"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  ExternalLink,
  MessageCircleOff,
  TimerReset,
} from "lucide-react";
import type { Alert, AlertType } from "@/lib/types";
import {
  REMINDER_OPTIONS,
  type ReminderOption,
} from "@/lib/alerts/notifications";

function typeIcon(type: AlertType) {
  if (type === "task_overdue") return <ClipboardList className="h-4 w-4" aria-hidden />;
  if (type === "followup") return <MessageCircleOff className="h-4 w-4" aria-hidden />;
  if (type === "contract_expiry") return <CalendarClock className="h-4 w-4" aria-hidden />;
  return <TimerReset className="h-4 w-4" aria-hidden />;
}

function contextLabel(alert: Alert) {
  if (alert.type === "task_overdue") return alert.task?.title ?? "Tarefa sem título";
  if (alert.type === "contract_expiry") return "Vigência do contrato";
  return alert.stage?.name ?? "";
}

export interface PersistentAlertToastProps {
  alert: Alert;
  typeLabel: string;
  onOpen: () => Promise<void> | void;
  onRemind: (reminder: ReminderOption) => Promise<void> | void;
}

export function PersistentAlertToast({
  alert,
  typeLabel,
  onOpen,
  onRemind,
}: PersistentAlertToastProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const context = contextLabel(alert);

  async function runAction(actionKey: string, action: () => Promise<void> | void) {
    setPendingAction(actionKey);
    try {
      await action();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="alerts-toast" data-status={alert.status}>
      <div className="alerts-toast-head">
        <span className="alerts-toast-status-icon" aria-hidden>
          {alert.status === "overdue" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <TimerReset className="h-4 w-4" />
          )}
        </span>
        <span className="alerts-toast-type-icon" aria-hidden>
          {typeIcon(alert.type)}
        </span>
        <div className="alerts-toast-title-group">
          <strong>{typeLabel}</strong>
          <span>{alert.cliente.nome}</span>
        </div>
        <button
          type="button"
          className="alerts-toast-open"
          onClick={() => void runAction("open", onOpen)}
          disabled={pendingAction !== null}
          aria-label="Abrir alerta"
          title="Abrir"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {context ? <p className="alerts-toast-context">{context}</p> : null}

      <div className="alerts-toast-reminders" aria-label="Lembretes">
        {REMINDER_OPTIONS.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            className="alerts-toast-reminder"
            onClick={() =>
              void runAction(String(option.value), () => onRemind(option.value))
            }
            disabled={pendingAction !== null}
            data-pending={pendingAction === String(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
