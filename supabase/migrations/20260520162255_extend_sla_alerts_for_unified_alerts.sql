-- Estende sla_alerts para servir como tabela unificada de alertas
-- (stage_sla | task_overdue | followup).

ALTER TABLE public.sla_alerts
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'stage_sla'
    CHECK (type IN ('stage_sla','task_overdue','followup'));

ALTER TABLE public.sla_alerts
  ADD COLUMN IF NOT EXISTS task_id uuid NULL
    REFERENCES public.production_tasks(id) ON DELETE CASCADE;

ALTER TABLE public.sla_alerts
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz NULL;

ALTER TABLE public.sla_alerts
  ADD COLUMN IF NOT EXISTS resolved_by uuid NULL REFERENCES auth.users(id);

-- task_overdue pode não ter pipeline stage associada
ALTER TABLE public.sla_alerts ALTER COLUMN stage_id DROP NOT NULL;

-- Drop do índice antigo (não deduplicava de fato porque resolved_at era NULL-distinct)
ALTER TABLE public.sla_alerts
  DROP CONSTRAINT IF EXISTS sla_alerts_cliente_id_stage_id_resolved_at_key;

-- Unicidade real por (type, cliente, stage, task) entre alertas abertos
CREATE UNIQUE INDEX IF NOT EXISTS sla_alerts_open_unique
  ON public.sla_alerts (
    type,
    cliente_id,
    COALESCE(stage_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(task_id,  '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sla_alerts_type_unresolved
  ON public.sla_alerts (type, fired_at DESC)
  WHERE resolved_at IS NULL;
