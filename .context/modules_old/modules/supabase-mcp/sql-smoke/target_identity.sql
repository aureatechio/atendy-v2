select
  current_database() as database_name,
  current_user as current_user_name,
  session_user as session_user_name,
  current_setting('server_version') as postgres_version,
  now() as checked_at;
