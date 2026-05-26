CREATE TABLE IF NOT EXISTS public.alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.sla_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'snoozed', 'resolved')),
  first_shown_at timestamptz NULL,
  last_shown_at timestamptz NULL,
  next_toast_at timestamptz NULL,
  snoozed_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alert_notifications_alert_user_key UNIQUE (alert_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.alert_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.sla_alerts(id) ON DELETE CASCADE,
  notification_id uuid NULL REFERENCES public.alert_notifications(id) ON DELETE SET NULL,
  actor_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (
    action IN (
      'notification_created',
      'toast_shown',
      'reminded',
      'opened',
      'resolved',
      'auto_reopened'
    )
  ),
  previous_state text NULL CHECK (
    previous_state IS NULL OR previous_state IN ('pending', 'snoozed', 'resolved')
  ),
  next_state text NULL CHECK (
    next_state IS NULL OR next_state IN ('pending', 'snoozed', 'resolved')
  ),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_user_state_next_toast
  ON public.alert_notifications (user_id, state, next_toast_at);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert_id
  ON public.alert_notifications (alert_id);

CREATE INDEX IF NOT EXISTS idx_alert_action_logs_alert_id
  ON public.alert_action_logs (alert_id);

CREATE INDEX IF NOT EXISTS idx_alert_action_logs_actor_created_at
  ON public.alert_action_logs (actor_user_id, created_at DESC);

ALTER TABLE public.alert_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alert notifications"
  ON public.alert_notifications;
CREATE POLICY "Users can view own alert notifications"
  ON public.alert_notifications
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own alert notifications"
  ON public.alert_notifications;
CREATE POLICY "Users can update own alert notifications"
  ON public.alert_notifications
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own alert notifications"
  ON public.alert_notifications;
CREATE POLICY "Users can insert own alert notifications"
  ON public.alert_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own alert action logs"
  ON public.alert_action_logs;
CREATE POLICY "Users can view own alert action logs"
  ON public.alert_action_logs
  FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own alert action logs"
  ON public.alert_action_logs;
CREATE POLICY "Users can insert own alert action logs"
  ON public.alert_action_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_user_id = auth.uid());
