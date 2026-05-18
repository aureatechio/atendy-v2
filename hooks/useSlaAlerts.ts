"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { SlaAlert } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;
const AUDIO_SRC = "/sounds/sla-alert.wav";

function playAlertSound() {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(AUDIO_SRC);
    audio.volume = 0.6;
    audio.play().catch(() => {
      /* browser blocked autoplay; ignore */
    });
  } catch {
    /* no-op */
  }
}

export function useSlaAlerts() {
  const [alerts, setAlerts] = useState<SlaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/sla-alerts", { cache: "no-store" });
      if (!res.ok) return;
      const body = (await res.json()) as { alerts: SlaAlert[] };
      const incoming = body.alerts ?? [];

      if (initializedRef.current) {
        const newOverdue = incoming.filter(
          (a) => a.status === "overdue" && !seenIdsRef.current.has(a.id),
        );
        for (const a of newOverdue) {
          toast.error(`SLA atrasado · ${a.stage.name}`, {
            description: a.cliente.nome,
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
  }, []);

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

  return { alerts, loading, refetch: fetchAlerts };
}
