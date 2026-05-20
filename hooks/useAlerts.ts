"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Alert, AlertType } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;
const AUDIO_SRC = "/sounds/sla-alert.wav";

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

const TYPE_LABELS: Record<AlertType, string> = {
  stage_sla: "SLA da etapa",
  task_overdue: "Tarefa atrasada",
  followup: "Follow-up",
};

export interface UseAlertsOptions {
  type?: AlertType;
  enableToasts?: boolean;
}

export function useAlerts(options: UseAlertsOptions = {}) {
  const { type, enableToasts = true } = options;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { alerts: Alert[] };
      const incoming = body.alerts ?? [];

      if (initializedRef.current && enableToasts) {
        const newOverdue = incoming.filter(
          (a) => a.status === "overdue" && !seenIdsRef.current.has(a.id),
        );
        for (const a of newOverdue) {
          toast.error(`${TYPE_LABELS[a.type]} · ${a.cliente.nome}`, {
            description:
              a.type === "task_overdue"
                ? (a.task?.title ?? "Tarefa sem título")
                : (a.stage?.name ?? ""),
            duration: 8000,
          });
        }
        if (newOverdue.length > 0) {
          playAlertSound();
        }
      }

      seenIdsRef.current = new Set(incoming.map((a) => a.id));
      initializedRef.current = true;
      setAlerts(incoming);
    } catch {
      /* network errors: stay silent and retry on next tick */
    } finally {
      setLoading(false);
    }
  }, [enableToasts]);

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
