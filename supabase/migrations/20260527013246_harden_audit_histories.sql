alter table public.client_stage_history
  add column if not exists operation_id uuid null;

alter table public.task_history
  add column if not exists operation_id uuid null;

update public.client_stage_history
set operation_id = (metadata->>'operation_id')::uuid
where operation_id is null
  and metadata ? 'operation_id'
  and metadata->>'operation_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

update public.task_history
set operation_id = (metadata->>'operation_id')::uuid
where operation_id is null
  and metadata ? 'operation_id'
  and metadata->>'operation_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

create index if not exists idx_client_stage_history_operation_id
  on public.client_stage_history (operation_id);

create index if not exists idx_task_history_operation_id
  on public.task_history (operation_id);

create or replace function public.log_client_stage_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_changed_by uuid := auth.uid();
  v_operation_id uuid := gen_random_uuid();
  v_actor_source text := case when auth.uid() is null then 'service' else 'user' end;
begin
  if old.current_stage_id is distinct from new.current_stage_id then
    insert into public.client_stage_history (
      cliente_id,
      from_stage_id,
      to_stage_id,
      changed_by,
      action_type,
      operation_id,
      metadata
    ) values (
      new.id,
      old.current_stage_id,
      new.current_stage_id,
      v_changed_by,
      'stage_change',
      v_operation_id,
      jsonb_build_object(
        'old_stage_entered_at', old.stage_entered_at,
        'time_in_stage_seconds', extract(epoch from (now() - coalesce(old.stage_entered_at, old.created_at))),
        'operation_id', v_operation_id,
        'actor_source', v_actor_source
      )
    );

    new.stage_entered_at = now();
  end if;

  if old.assigned_to is distinct from new.assigned_to then
    insert into public.client_stage_history (
      cliente_id,
      from_assigned_to,
      to_assigned_to,
      changed_by,
      action_type,
      operation_id,
      metadata
    ) values (
      new.id,
      old.assigned_to,
      new.assigned_to,
      v_changed_by,
      'assignment_change',
      v_operation_id,
      jsonb_build_object(
        'operation_id', v_operation_id,
        'actor_source', v_actor_source
      )
    );
  end if;

  return new;
end;
$function$;

create or replace function public.record_task_history()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_changed_by uuid := auth.uid();
  v_operation_id uuid := gen_random_uuid();
  v_actor_source text := case when auth.uid() is null then 'service' else 'user' end;
  v_metadata jsonb;
begin
  if tg_op = 'INSERT' then
    v_metadata := jsonb_build_object(
      'title', new.title,
      'priority', new.priority,
      'is_main_task', new.is_main_task,
      'operation_id', v_operation_id,
      'actor_source', v_actor_source
    );

    insert into public.task_history (
      task_id,
      action_type,
      to_stage_id,
      to_assigned_to,
      changed_by,
      operation_id,
      metadata
    )
    values (
      new.id,
      'created',
      new.pipeline_stage_id,
      new.assigned_to,
      v_changed_by,
      v_operation_id,
      v_metadata
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_metadata := jsonb_build_object(
      'operation_id', v_operation_id,
      'actor_source', v_actor_source
    );

    if old.pipeline_stage_id is distinct from new.pipeline_stage_id then
      insert into public.task_history (
        task_id, action_type, from_stage_id, to_stage_id, changed_by, operation_id, metadata
      )
      values (
        new.id, 'stage_change', old.pipeline_stage_id, new.pipeline_stage_id, v_changed_by, v_operation_id, v_metadata
      );
    end if;

    if old.status is distinct from new.status then
      insert into public.task_history (
        task_id, action_type, field_name, old_value, new_value, to_stage_id, changed_by, operation_id, metadata
      )
      values (
        new.id, 'status_change', 'status', old.status::text, new.status::text, new.pipeline_stage_id, v_changed_by, v_operation_id, v_metadata
      );
    end if;

    if old.assigned_to is distinct from new.assigned_to then
      insert into public.task_history (
        task_id, action_type, from_assigned_to, to_assigned_to, to_stage_id, changed_by, operation_id, metadata
      )
      values (
        new.id, 'assignment_change', old.assigned_to, new.assigned_to, new.pipeline_stage_id, v_changed_by, v_operation_id, v_metadata
      );
    end if;

    if old.priority is distinct from new.priority then
      insert into public.task_history (
        task_id, action_type, field_name, old_value, new_value, to_stage_id, changed_by, operation_id, metadata
      )
      values (
        new.id, 'priority_change', 'priority', old.priority::text, new.priority::text, new.pipeline_stage_id, v_changed_by, v_operation_id, v_metadata
      );
    end if;

    if old.deadline is distinct from new.deadline then
      insert into public.task_history (
        task_id, action_type, field_name, old_value, new_value, to_stage_id, changed_by, operation_id, metadata
      )
      values (
        new.id, 'deadline_change', 'deadline', old.deadline::text, new.deadline::text, new.pipeline_stage_id, v_changed_by, v_operation_id, v_metadata
      );
    end if;

    if old.title is distinct from new.title then
      insert into public.task_history (
        task_id, action_type, field_name, old_value, new_value, to_stage_id, changed_by, operation_id, metadata
      )
      values (
        new.id, 'title_change', 'title', old.title, new.title, new.pipeline_stage_id, v_changed_by, v_operation_id, v_metadata
      );
    end if;

    if old.description is distinct from new.description then
      insert into public.task_history (
        task_id, action_type, field_name, old_value, new_value, to_stage_id, changed_by, operation_id, metadata
      )
      values (
        new.id, 'description_change', 'description', left(old.description, 100), left(new.description, 100), new.pipeline_stage_id, v_changed_by, v_operation_id, v_metadata
      );
    end if;

    return new;
  end if;

  return new;
end;
$function$;

create or replace function public.update_client_stage_from_task()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_changed_by uuid := auth.uid();
  v_operation_id uuid := gen_random_uuid();
  v_actor_source text := case when auth.uid() is null then 'service' else 'user' end;
begin
  if new.parent_task_id is not null or coalesce(new.is_main_task, false) = false then
    return new;
  end if;

  if new.pipeline_stage_id is not null
     and (old.pipeline_stage_id is null or old.pipeline_stage_id != new.pipeline_stage_id) then

    update public.clientes_cadastro
    set current_stage_id = new.pipeline_stage_id,
        stage_entered_at = now(),
        updated_at = now()
    where id = new.cliente_id;

    if old.pipeline_stage_id is distinct from new.pipeline_stage_id then
      insert into public.client_stage_history (
        cliente_id,
        from_stage_id,
        to_stage_id,
        changed_by,
        action_type,
        reason,
        operation_id,
        metadata
      ) values (
        new.cliente_id,
        old.pipeline_stage_id,
        new.pipeline_stage_id,
        coalesce(v_changed_by, new.assigned_to),
        'stage_change',
        'Movimentação no Kanban de Produção',
        v_operation_id,
        jsonb_build_object(
          'task_id', new.id,
          'task_title', new.title,
          'automatic', true,
          'operation_id', v_operation_id,
          'actor_source', v_actor_source
        )
      );
    end if;
  end if;

  return new;
end;
$function$;
