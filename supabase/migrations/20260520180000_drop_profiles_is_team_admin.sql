-- Drop the dormant `is_team_admin` column from profiles.
--
-- Verified safe before removal:
--   * 0 rows with `is_team_admin = TRUE` in production at the time of writing.
--   * No public/auth function references it (pg_proc scan).
--   * No view, RLS policy, or trigger references it.
--   * No reference in the atendy-v2 codebase after the role refactor.
--
-- The other three composite fields (`specialty`, `permissions`,
-- `autorizado_tirar_analise_ia`) were intentionally kept: they still hold
-- meaningful production data and are read by Postgres RPCs
-- (`get_celebrity_board_data`, `get_production_dashboard_metrics`,
-- `get_team_members_with_email`). They will be revisited in a follow-up.

ALTER TABLE profiles DROP COLUMN IF EXISTS is_team_admin;
