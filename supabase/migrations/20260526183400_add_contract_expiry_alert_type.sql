ALTER TABLE public.sla_alerts
  DROP CONSTRAINT IF EXISTS sla_alerts_type_check;

ALTER TABLE public.sla_alerts
  ADD CONSTRAINT sla_alerts_type_check
  CHECK (type IN ('stage_sla','task_overdue','followup','contract_expiry'));
