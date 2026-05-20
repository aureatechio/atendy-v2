"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Alert, AlertType } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;
const AUDIO_SRC = "/sounds/sla-alert.wav";

// Limite de toasts individuais por tick. Acima disso, agrupa em 1 toast resumido.
const TOAST_BURST_LIMIT = 3;

// Chave do sessionStorage para persistir IDs já notificados durante a sessão
// (evita cascata após navegar entre páginas / remontar o hook).
const SEEN_STORAGE_KEY = "atendy:alerts:seenOverdueIds";

const TYPE_LABELS: Record<AlertType, string> = {
  stage_sla: "SLA da etapa",
  task_overdue: "Tarefa atrasada",
  followup: "Follow-up",
};

function loadSeenIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(SEEN_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

function persistSeenIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    // Mantém só até ~500 IDs para não inflar o storage
    const arr = [...ids].slice(-500);
    window.sessionStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* quota / privacy mode: ignorar */
  }
}

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

export interface UseAlertsOptions {
  type?: AlertType;
  /**
   * Se true, dispara toasts para novos overdues. Defina como `true` em UM ÚNICO
   * consumidor (o sino global) para evitar cascata de toasts duplicados.
   * Default: false.
   */
  enableToasts?: boolean;
}

export function useAlerts(options: UseAlertsOptions = {}) {
  const { type, enableToasts = false } = options;
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIdsRef = useRef<Set<string>>(loadSeenIds());
  const initializedRef = useRef(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { alerts: Alert[] };
      const incoming = body.alerts ?? [];

      if (enableToasts) {
        const newOverdue = incoming.filter(
          (a) => a.status === "overdue" && !seenIdsRef.current.has(a.id),
        );
        const isFirstTick = !initializedRef.current;

        if (newOverdue.length > 0) {
          // Na primeira sincronização, NÃO mostramos toasts individuais para
          // tudo que já estava aberto. Só marcamos como visto.
          if (!isFirstTick) {
            if (newOverdue.length <= TOAST_BURST_LIMIT) {
              for (const a of newOverdue) {
                toast.error(`${TYPE_LABELS[a.type]} · ${a.cliente.nome}`, {
                  description:
                    a.type === "task_overdue"
                      ? (a.task?.title ?? "Tarefa sem título")
                      : (a.stage?.name ?? ""),
                  duration: 6000,
                });
              }
            } else {
              // Agregado: 1 único toast resumido + ação para abrir /alertas
              toast.error(`${newOverdue.length} novos alertas atrasados`, {
                description: "Toque para ver detalhes.",
                duration: 8000,
                action: {
                  label: "Abrir",
                  onClick: () => {
                    if (typeof window !== "undefined") {
                      window.location.assign("/alertas");
                    }
                  },
                },
              });
            }
            playAlertSound();
          }

          // Marca como visto independentemente
          for (const a of newOverdue) seenIdsRef.current.add(a.id);
          persistSeenIds(seenIdsRef.current);
        }
      }

      // Sempre mantém o snapshot de IDs (até para o consumidor sem toasts) para
      // futuras comparações funcionarem mesmo se o usuário ligar toasts depois.
      for (const a of incoming) {
        if (a.status === "overdue") seenIdsRef.current.add(a.id);
      }
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
