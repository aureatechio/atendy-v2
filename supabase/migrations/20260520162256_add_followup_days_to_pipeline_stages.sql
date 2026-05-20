-- Configuração de follow-up por etapa.
-- NULL = follow-up desligado nessa etapa. > 0 = dias sem interação
-- antes do alerta ser emitido (warning >=80%, overdue >=100%).

ALTER TABLE public.client_pipeline_stages
  ADD COLUMN IF NOT EXISTS followup_days integer NULL
    CHECK (followup_days IS NULL OR followup_days > 0);
