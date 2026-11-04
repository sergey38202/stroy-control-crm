begin;

create or replace function public.update_object(p_object_id uuid, p_name text, p_address text, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_object public.objects%rowtype;
begin
  perform private.require_manager();
  select * into v_object from public.objects where id = p_object_id for update;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_object.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_DATA' using errcode = 'PT409';
  end if;
  update public.objects set name = btrim(p_name), address = coalesce(p_address, '') where id = p_object_id;
end;
$$;

create or replace function public.update_task(p_task_id uuid, p_title text, p_description text,
  p_object_id uuid, p_assignee_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype;
begin
  perform private.require_manager();
  -- Parent before child matches delete_object's lock order.
  perform 1 from public.objects where id = p_object_id for key share;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_task.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_DATA' using errcode = 'PT409';
  end if;
  perform 1 from public.profiles where id = p_assignee_id and role = 'worker' for key share;
  if not found then raise exception 'WORKER_REQUIRED' using errcode = '22023'; end if;
  update public.tasks set title = btrim(p_title), description = coalesce(p_description, ''),
    object_id = p_object_id, assignee_id = p_assignee_id where id = p_task_id;
end;
$$;

create or replace function public.change_task_status(p_task_id uuid, p_to_status public.task_status,
  p_expected_updated_at timestamptz, p_comment text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype; v_actor uuid := auth.uid(); v_role public.app_role;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  v_role := private.caller_role();
  if v_role is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_role = 'worker' and v_task.assignee_id <> v_actor then
    raise exception 'NOT_AVAILABLE' using errcode = 'P0002';
  end if;
  if v_task.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_DATA' using errcode = 'PT409';
  end if;
  if p_to_status is null or not (
    (v_role = 'worker' and v_task.assignee_id = v_actor and
      ((v_task.status in ('new', 'revision') and p_to_status = 'in_progress') or
       (v_task.status = 'in_progress' and p_to_status = 'in_review'))) or
    (v_role = 'manager' and v_task.status = 'in_review' and p_to_status in ('accepted', 'revision'))
  ) then raise exception 'INVALID_TRANSITION' using errcode = '42501'; end if;
  if char_length(p_comment) > 2000 then raise exception 'COMMENT_TOO_LONG' using errcode = '22023'; end if;
  if p_to_status = 'revision' and (p_comment is null or p_comment !~ '[^[:space:]]') then
    raise exception 'REVISION_COMMENT_REQUIRED' using errcode = '22023';
  end if;
  perform set_config('app.status_comment', coalesce(p_comment, ''), true);
  update public.tasks set status = p_to_status where id = p_task_id;
  perform set_config('app.status_comment', '', true);
end;
$$;

create or replace function public.delete_task(p_task_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype;
begin
  perform private.require_manager();
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_task.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_DATA' using errcode = 'PT409';
  end if;
  delete from public.tasks where id = p_task_id;
end;
$$;

create or replace function public.delete_object(p_object_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_object public.objects%rowtype;
begin
  perform private.require_manager();
  select * into v_object from public.objects where id = p_object_id for update;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_object.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_DATA' using errcode = 'PT409';
  end if;
  delete from public.objects where id = p_object_id;
end;
$$;

commit;
