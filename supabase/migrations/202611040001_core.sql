-- Apply manually in Supabase as the database administrator. Never from the browser.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.app_role as enum ('manager', 'worker');
create type public.task_status as enum ('new', 'in_progress', 'in_review', 'accepted', 'revision');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (display_name ~ '[^[:space:]]' and char_length(display_name) <= 120),
  role public.app_role not null,
  unique (id, role)
);

create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name ~ '[^[:space:]]' and char_length(name) <= 200),
  address text not null default '' check (char_length(address) <= 500),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (title ~ '[^[:space:]]' and char_length(title) <= 200),
  description text not null default '' check (char_length(description) <= 10000),
  object_id uuid not null,
  assignee_id uuid not null,
  -- Composite FK keeps assignees workers even if an administrator changes a role.
  assignee_role public.app_role not null default 'worker' check (assignee_role = 'worker'),
  status public.task_status not null default 'new',
  author_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint tasks_object_id_fkey foreign key (object_id) references public.objects(id) on delete cascade,
  constraint tasks_assignee_worker_fkey foreign key (assignee_id, assignee_role)
    references public.profiles(id, role) on update restrict on delete restrict
);

create table public.task_status_history (
  id bigint generated always as identity primary key,
  task_id uuid not null,
  from_status public.task_status,
  to_status public.task_status not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  comment text check (char_length(comment) <= 2000),
  constraint task_status_history_task_id_fkey foreign key (task_id) references public.tasks(id) on delete cascade,
  constraint valid_history_transition check (
    (from_status is null and to_status = 'new') or
    (from_status is not null and (
      (from_status = 'new' and to_status = 'in_progress') or
      (from_status = 'in_progress' and to_status = 'in_review') or
      (from_status = 'in_review' and to_status in ('accepted', 'revision')) or
      (from_status = 'revision' and to_status = 'in_progress')
    ))
  ),
  constraint revision_comment_required check (
    to_status <> 'revision' or (comment is not null and comment ~ '[^[:space:]]')
  )
);

create index tasks_object_id_idx on public.tasks(object_id);
create index tasks_assignee_status_idx on public.tasks(assignee_id, status);
create index tasks_author_id_idx on public.tasks(author_id);
create index history_task_created_idx on public.task_status_history(task_id, created_at, id);
create index history_actor_id_idx on public.task_status_history(actor_id);
create index profiles_role_idx on public.profiles(role);

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

revoke all on public.profiles, public.objects, public.tasks, public.task_status_history from public, anon, authenticated;
revoke all on sequence public.task_status_history_id_seq from public, anon, authenticated;
grant select on public.profiles, public.objects, public.tasks, public.task_status_history to authenticated;

-- SECURITY DEFINER reads protected role data without recursing through profiles RLS.
create function private.caller_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid());
$$;

create function private.require_manager() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if private.caller_role() is distinct from 'manager'::public.app_role then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create policy profiles_read on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.caller_role()) = 'manager');
create policy tasks_read on public.tasks for select to authenticated
  using ((select private.caller_role()) = 'manager' or
    ((select private.caller_role()) = 'worker' and assignee_id = (select auth.uid())));
-- tasks policy does not read objects: no recursive RLS chain.
create policy objects_read on public.objects for select to authenticated
  using ((select private.caller_role()) = 'manager' or exists (
    select 1 from public.tasks t where t.object_id = objects.id and t.assignee_id = (select auth.uid())
  ));
create policy history_read on public.task_status_history for select to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_status_history.task_id));

create function private.protect_metadata() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_METADATA' using errcode = '42501';
  end if;
  if tg_table_name = 'tasks' then
    if new.author_id is distinct from old.author_id then
      raise exception 'IMMUTABLE_METADATA' using errcode = '42501';
    end if;
  end if;
  -- A version must change even if the system clock has not advanced (or moved back).
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
create trigger objects_metadata before update on public.objects
  for each row execute function private.protect_metadata();
create trigger tasks_metadata before update on public.tasks
  for each row execute function private.protect_metadata();

-- Only change_task_status can supply a comment. This setting is not an authorization
-- flag: direct writes are revoked and the transition trigger checks identity and role.
create function private.record_task_status() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role public.app_role := private.caller_role();
  v_comment text;
begin
  if tg_op = 'UPDATE' then
    if new.status = old.status then return new; end if;
  end if;
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if tg_op = 'INSERT' then
    if v_role is distinct from 'manager'::public.app_role or new.status <> 'new' or new.author_id <> v_actor then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    insert into public.task_status_history(task_id, from_status, to_status, actor_id)
    values (new.id, null, 'new', v_actor);
    return new;
  end if;
  if not (
    (v_role = 'worker' and old.assignee_id = v_actor and new.assignee_id = old.assignee_id and
      ((old.status in ('new', 'revision') and new.status = 'in_progress') or
       (old.status = 'in_progress' and new.status = 'in_review'))) or
    (v_role = 'manager' and old.status = 'in_review' and new.status in ('accepted', 'revision'))
  ) or v_role is null then
    raise exception 'INVALID_TRANSITION' using errcode = '42501';
  end if;
  v_comment := nullif(btrim(current_setting('app.status_comment', true)), '');
  if new.status = 'revision' and (v_comment is null or v_comment !~ '[^[:space:]]') then
    raise exception 'REVISION_COMMENT_REQUIRED' using errcode = '22023';
  end if;
  insert into public.task_status_history(task_id, from_status, to_status, actor_id, comment)
  values (new.id, old.status, new.status, v_actor, v_comment);
  return new;
end;
$$;
create trigger tasks_record_status after insert or update of status on public.tasks
  for each row execute function private.record_task_status();

create function public.create_object(p_name text, p_address text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_manager();
  insert into public.objects(name, address) values (btrim(p_name), coalesce(p_address, '')) returning id into v_id;
  return v_id;
end;
$$;

create function public.update_object(p_object_id uuid, p_name text, p_address text, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare v_object public.objects%rowtype;
begin
  perform private.require_manager();
  select * into v_object from public.objects where id = p_object_id for update;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  if v_object.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_DATA' using errcode = '40001';
  end if;
  update public.objects set name = btrim(p_name), address = coalesce(p_address, '') where id = p_object_id;
end;
$$;

create function public.create_task(p_title text, p_description text, p_object_id uuid, p_assignee_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_id uuid;
begin
  v_actor := private.require_manager();
  -- Parent lock and FK serialize creation against deletion of the object.
  perform 1 from public.objects where id = p_object_id for key share;
  if not found then raise exception 'NOT_AVAILABLE' using errcode = 'P0002'; end if;
  perform 1 from public.profiles where id = p_assignee_id and role = 'worker' for key share;
  if not found then raise exception 'WORKER_REQUIRED' using errcode = '22023'; end if;
  insert into public.tasks(title, description, object_id, assignee_id, author_id)
  values (btrim(p_title), coalesce(p_description, ''), p_object_id, p_assignee_id, v_actor)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.update_task(p_task_id uuid, p_title text, p_description text,
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
    raise exception 'STALE_DATA' using errcode = '40001';
  end if;
  perform 1 from public.profiles where id = p_assignee_id and role = 'worker' for key share;
  if not found then raise exception 'WORKER_REQUIRED' using errcode = '22023'; end if;
  update public.tasks set title = btrim(p_title), description = coalesce(p_description, ''),
    object_id = p_object_id, assignee_id = p_assignee_id where id = p_task_id;
end;
$$;

create function public.change_task_status(p_task_id uuid, p_to_status public.task_status,
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
    raise exception 'STALE_DATA' using errcode = '40001';
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

-- No full directory for workers. Only names attached to one accessible task.
create function public.task_identities(p_task_id uuid)
returns table(id uuid, display_name text)
language plpgsql stable security definer set search_path = '' as $$
declare v_task public.tasks%rowtype; v_actor uuid := auth.uid(); v_role public.app_role;
begin
  if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  v_role := private.caller_role();
  select * into v_task from public.tasks where tasks.id = p_task_id;
  if not found or v_role is null or
    (v_role <> 'manager' and (v_role <> 'worker' or v_task.assignee_id <> v_actor)) then
    raise exception 'NOT_AVAILABLE' using errcode = 'P0002';
  end if;
  return query select p.id, p.display_name from public.profiles p
  where p.id in (v_task.assignee_id, v_task.author_id) or exists (
    select 1 from public.task_status_history h where h.task_id = p_task_id and h.actor_id = p.id
  );
end;
$$;

revoke all on function private.caller_role() from public, anon, authenticated;
revoke all on function private.require_manager() from public, anon, authenticated;
revoke all on function private.protect_metadata() from public, anon, authenticated;
revoke all on function private.record_task_status() from public, anon, authenticated;
grant execute on function private.caller_role() to authenticated;

revoke all on function public.create_object(text, text) from public, anon, authenticated;
revoke all on function public.update_object(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.create_task(text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.update_task(uuid, text, text, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.change_task_status(uuid, public.task_status, timestamptz, text) from public, anon, authenticated;
revoke all on function public.task_identities(uuid) from public, anon, authenticated;
grant execute on function public.create_object(text, text) to authenticated;
grant execute on function public.update_object(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.create_task(text, text, uuid, uuid) to authenticated;
grant execute on function public.update_task(uuid, text, text, uuid, uuid, timestamptz) to authenticated;
grant execute on function public.change_task_status(uuid, public.task_status, timestamptz, text) to authenticated;
grant execute on function public.task_identities(uuid) to authenticated;

commit;
