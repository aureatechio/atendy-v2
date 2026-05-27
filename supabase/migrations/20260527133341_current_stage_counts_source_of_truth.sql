create or replace view public.cliente_current_stage_snapshot
with (security_invoker = true)
as
select
  c.id as cliente_id,
  c.code,
  coalesce(c.nomecliente, c.nome, c.nome_fantasia, 'Cliente sem nome') as cliente_nome,
  c.current_stage_id as stage_id,
  s.name as stage_name,
  s.slug as stage_slug,
  s.color as stage_color,
  s.order_index as stage_order_index,
  s.is_final as stage_is_final,
  s.is_active as stage_is_active,
  s.parent_stage_id,
  p.name as parent_stage_name,
  p.slug as parent_stage_slug,
  coalesce(p.id, s.id) as root_stage_id,
  coalesce(p.name, s.name) as root_stage_name,
  coalesce(p.slug, s.slug) as root_stage_slug,
  coalesce(p.order_index, s.order_index) as root_stage_order_index,
  c.stage_entered_at,
  c.created_at,
  c.updated_at,
  c.responsavel_atendimento,
  c.assigned_to,
  coalesce(c.valor, c.deal_value, 0::numeric) as valor,
  c.deal_value,
  false as is_archived
from public.clientes_cadastro c
left join public.client_pipeline_stages s on s.id = c.current_stage_id
left join public.client_pipeline_stages p on p.id = s.parent_stage_id
where c.current_stage_id is not null
  and coalesce(c.is_archived, false) = false;

comment on view public.cliente_current_stage_snapshot is
  'Fonte operacional de etapa atual do cliente. Usa somente clientes_cadastro.current_stage_id; nao usa production_tasks.';

create or replace view public.cliente_current_stage_counts
with (security_invoker = true)
as
select
  s.id as stage_id,
  s.name as stage_name,
  s.slug as stage_slug,
  s.color as stage_color,
  s.order_index as stage_order_index,
  s.is_final as stage_is_final,
  s.is_active as stage_is_active,
  s.parent_stage_id,
  p.name as parent_stage_name,
  p.slug as parent_stage_slug,
  coalesce(p.id, s.id) as root_stage_id,
  coalesce(p.name, s.name) as root_stage_name,
  coalesce(p.slug, s.slug) as root_stage_slug,
  coalesce(p.order_index, s.order_index) as root_stage_order_index,
  s.parent_stage_id is not null as is_substage,
  count(css.cliente_id) as active_client_count,
  coalesce(sum(css.valor), 0::numeric) as total_value,
  min(css.stage_entered_at) as oldest_stage_entered_at,
  max(css.stage_entered_at) as newest_stage_entered_at
from public.client_pipeline_stages s
left join public.client_pipeline_stages p on p.id = s.parent_stage_id
left join public.cliente_current_stage_snapshot css on css.stage_id = s.id
where coalesce(s.is_active, true) = true
group by
  s.id,
  s.name,
  s.slug,
  s.color,
  s.order_index,
  s.is_final,
  s.is_active,
  s.parent_stage_id,
  p.id,
  p.name,
  p.slug,
  p.order_index
order by coalesce(p.order_index, s.order_index), s.parent_stage_id nulls first, s.order_index, s.name;

comment on view public.cliente_current_stage_counts is
  'Contagem exata por etapa/subetapa atual. Cada linha conta somente clientes cujo current_stage_id e igual ao stage_id.';

create or replace view public.cliente_current_stage_root_counts
with (security_invoker = true)
as
select
  root.id as root_stage_id,
  root.name as root_stage_name,
  root.slug as root_stage_slug,
  root.color as root_stage_color,
  root.order_index as root_stage_order_index,
  root.is_final as root_stage_is_final,
  root.is_active as root_stage_is_active,
  count(css.cliente_id) as active_client_count,
  coalesce(sum(css.valor), 0::numeric) as total_value,
  min(css.stage_entered_at) as oldest_stage_entered_at,
  max(css.stage_entered_at) as newest_stage_entered_at
from public.client_pipeline_stages root
left join public.cliente_current_stage_snapshot css on css.root_stage_id = root.id
where root.parent_stage_id is null
  and coalesce(root.is_active, true) = true
group by
  root.id,
  root.name,
  root.slug,
  root.color,
  root.order_index,
  root.is_final,
  root.is_active
order by root.order_index, root.name;

comment on view public.cliente_current_stage_root_counts is
  'Contagem agregada por etapa-mae atual. Inclui clientes na etapa-mae e em suas subetapas, sempre via current_stage_id.';

revoke all on public.cliente_current_stage_snapshot from anon;
revoke all on public.cliente_current_stage_counts from anon;
revoke all on public.cliente_current_stage_root_counts from anon;

grant select on public.cliente_current_stage_snapshot to authenticated;
grant select on public.cliente_current_stage_counts to authenticated;
grant select on public.cliente_current_stage_root_counts to authenticated;
