create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_email_snapshot text null,
  actor_role_snapshot text null,
  actor_source text not null default 'user',
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  cliente_id uuid null references public.clientes_cadastro(id) on delete set null,
  status text not null default 'success',
  before jsonb null,
  after jsonb null,
  diff jsonb null,
  metadata jsonb not null default '{}'::jsonb,
  operation_id uuid null,
  request_path text null,
  user_agent text null,
  error_message text null,
  created_at timestamp with time zone not null default now(),
  constraint audit_events_actor_source_check check (actor_source in ('user', 'system', 'service')),
  constraint audit_events_status_check check (status in ('success', 'failure'))
);

alter table public.audit_events enable row level security;

revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;

drop policy if exists audit_events_select_admin_dev on public.audit_events;
create policy audit_events_select_admin_dev
on public.audit_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'::user_status
      and p.role in ('admin'::user_role, 'dev'::user_role)
  )
);

create index if not exists idx_audit_events_created_at_desc
  on public.audit_events (created_at desc);

create index if not exists idx_audit_events_cliente_id
  on public.audit_events (cliente_id);

create index if not exists idx_audit_events_entity
  on public.audit_events (entity_type, entity_id);

create index if not exists idx_audit_events_actor_user_id
  on public.audit_events (actor_user_id);

create index if not exists idx_audit_events_action
  on public.audit_events (action);

create index if not exists idx_audit_events_operation_id
  on public.audit_events (operation_id);

alter table public.clientes_cadastro
  add column if not exists archived_by uuid null references auth.users(id) on delete set null;

create index if not exists idx_clientes_cadastro_archived_by
  on public.clientes_cadastro (archived_by);
