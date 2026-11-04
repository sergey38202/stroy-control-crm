begin;

alter table public.tasks drop constraint tasks_object_id_fkey;
alter table public.tasks add constraint tasks_object_id_fkey
  foreign key (object_id) references public.objects(id) on delete cascade;
alter table public.task_status_history drop constraint task_status_history_task_id_fkey;
alter table public.task_status_history add constraint task_status_history_task_id_fkey
  foreign key (task_id) references public.tasks(id) on delete cascade;

create or replace function private.protect_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if pg_trigger_depth() > 1 then return new; end if;
  elsif tg_op = 'DELETE' then
    if pg_trigger_depth() > 1 and not exists (
      select 1 from public.tasks t where t.id = old.task_id
    ) then return old; end if;
  end if;
  raise exception 'HISTORY_IMMUTABLE' using errcode = '42501';
end;
$$;

create trigger history_protection before insert or update or delete on public.task_status_history
  for each row execute function private.protect_history();
revoke all on function private.protect_history() from public, anon, authenticated;

create or replace function public.delete_task(p_task_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_task public.tasks%rowtype;
begin
  perform private.require_manager();
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_task.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_DATA' using errcode = '40001';
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
    raise exception 'STALE_DATA' using errcode = '40001';
  end if;
  delete from public.objects where id = p_object_id;
end;
$$;

revoke all on function public.delete_task(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_object(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.delete_task(uuid, timestamptz) to authenticated;
grant execute on function public.delete_object(uuid, timestamptz) to authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.objects, public.tasks, public.task_status_history from public, anon, authenticated;

commit;
