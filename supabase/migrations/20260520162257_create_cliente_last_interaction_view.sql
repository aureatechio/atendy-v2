-- View agregada para detectar a última interação registrada de cada cliente.
-- Usada pelo cron de alertas (`/api/cron/sla-alerts`) para decidir se um
-- cliente está parado em uma etapa por mais que o `followup_days` configurado.

CREATE OR REPLACE VIEW public.cliente_last_interaction AS
WITH events AS (
  SELECT cliente_id, created_at AS at
    FROM public.client_comments
    WHERE created_at IS NOT NULL
  UNION ALL
  SELECT cliente_id, created_at
    FROM public.client_stage_history
    WHERE created_at IS NOT NULL
  UNION ALL
  SELECT cliente_id, COALESCE(scheduled_at, created_at)
    FROM public.client_meetings
    WHERE COALESCE(scheduled_at, created_at) IS NOT NULL
  UNION ALL
  SELECT cliente_id, COALESCE(completed_at, created_at)
    FROM public.client_adjustments
    WHERE COALESCE(completed_at, created_at) IS NOT NULL
  UNION ALL
  SELECT cliente_id, COALESCE(completed_at, task_work_started_at, started_at, created_at)
    FROM public.production_tasks
    WHERE COALESCE(completed_at, task_work_started_at, started_at, created_at) IS NOT NULL
)
SELECT cliente_id, MAX(at) AS last_interaction_at
FROM events
GROUP BY cliente_id;

GRANT SELECT ON public.cliente_last_interaction
  TO anon, authenticated, service_role;
