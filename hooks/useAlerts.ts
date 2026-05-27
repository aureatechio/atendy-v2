"use client";

import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PersistentAlertToast } from "@/components/alerts/persistent-alert-toast";
import type { Alert, AlertType } from "@/lib/types";
import type { ReminderOption } from "@/lib/alerts/notifications";

const POLL_INTERVAL_MS = 60_000;
const AUDIO_SRC = "/sounds/sla-alert.wav";

const TOAST_VISIBLE_LIMIT = 5;

const TYPE_LABELS: Record<AlertType, string> = {
  stage_sla: "SLA da etapa",
  task_overdue: "Tarefa atrasada",
  followup: "Follow-up",
  contract_expiry: "Fim de vigência",
};

function playAlertSound() {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(AUDIO_SRC);
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {
    /* no-op */
  }
}

async function postAlertToastEvent(
  event: "toast_shown" | "opened",
  alertIds: string[],
) {
  if (alertIds.length === 0) return;
  await fetch("/api/alerts/toast-events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, alertIds }),
  });
}

export interface UseAlertsOptions {
  type?: AlertType;
  /**
   * Se true, dispara toasts persistentes. Defina como `true` em UM ÚNICO
   * consumidor (o sino global) para evitar cascata de toasts duplicados.
   * Default: false.
   */
  enableToasts?: boolean;
}

export function useAlerts(options: UseAlertsOptions = {}) {
  const { type, enableToasts = false } = options;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const activeToastIdsRef = useRef<Set<string>>(new Set());

  const dismissAlertToast = useCallback((alertId: string) => {
    const toastId = `alert-${alertId}`;
    toast.dismiss(toastId);
    activeToastIdsRef.current.delete(alertId);
  }, []);

  const remindAlert = useCallback(
    async (alert: Alert, reminder: ReminderOption) => {
      const res = await fetch(`/api/alerts/${alert.id}/remind`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reminder }),
      });
      if (!res.ok) {
        toast.error("Falha ao criar lembrete");
        return;
      }
      dismissAlertToast(alert.id);
      setAlerts((prev) => prev.filter((item) => item.id !== alert.id));
      toast.success("Lembrete criado");
    },
    [dismissAlertToast],
  );

  const openAlert = useCallback(
    async (alert: Alert) => {
      try {
        await postAlertToastEvent("opened", [alert.id]);
      } catch {
        /* log best-effort */
      }
      dismissAlertToast(alert.id);
      if (typeof window !== "undefined") {
        window.location.assign(`/clientes/${alert.cliente.id}`);
      }
    },
    [dismissAlertToast],
  );

  const showPersistentToasts = useCallback(
    (incoming: Alert[]) => {
      const openSlots = Math.max(0, TOAST_VISIBLE_LIMIT - activeToastIdsRef.current.size);
      if (openSlots === 0) return;

      const toShow = incoming
        .filter((alert) => alert.notification?.shouldToast)
        .filter((alert) => !activeToastIdsRef.current.has(alert.id))
        .slice(0, openSlots);

      if (toShow.length === 0) return;

      for (const alert of toShow) {
        const toastId = `alert-${alert.id}`;
        activeToastIdsRef.current.add(alert.id);
        toast.custom(
          () =>
            createElement(PersistentAlertToast, {
              alert,
              typeLabel: TYPE_LABELS[alert.type],
              onOpen: () => openAlert(alert),
              onRemind: (reminder: ReminderOption) =>
                remindAlert(alert, reminder),
            }),
          {
            id: toastId,
            duration: Infinity,
            className: "alerts-toast-shell",
            onDismiss: () => activeToastIdsRef.current.delete(alert.id),
            onAutoClose: () => activeToastIdsRef.current.delete(alert.id),
          },
        );
      }

      void postAlertToastEvent(
        "toast_shown",
        toShow.map((alert) => alert.id),
      ).catch(() => {});
      playAlertSound();
    },
    [openAlert, remindAlert],
  );

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { alerts: Alert[] };
      const incoming = body.alerts ?? [];

      if (enableToasts) {
        showPersistentToasts(incoming);
      }

      setAlerts(incoming);
    } catch {
      /* network errors: stay silent and retry on next tick */
    } finally {
      setLoading(false);
    }
  }, [enableToasts, showPersistentToasts]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      void fetchAlerts();
    };
    tick();
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAlerts]);

  const filtered = useMemo(
    () => (type ? alerts.filter((a) => a.type === type) : alerts),
    [alerts, type],
  );

  return { alerts: filtered, allAlerts: alerts, loading, refetch: fetchAlerts };
}

export const ALERT_TYPE_LABELS = TYPE_LABELS;
