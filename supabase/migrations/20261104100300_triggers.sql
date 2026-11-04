-- Триггеры защиты в глубину (SPEC §7) и синхронизация профиля.

-- 1. auth.users -> profiles.
create function private.sync_profile_from_auth_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
  v_role public.user_role;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.email), ''),
    new.id::text
  );
  v_name := left(v_name, 200);

  v_role := case
    when new.raw_app_meta_data ->> 'role' in ('manager', 'executor')
      then (new.raw_app_meta_data ->> 'role')::public.user_role
    else 'executor'::public.user_role
  end;

  insert into public.profiles (id, full_name, role)
  values (new.id, v_name, v_role)
  on conflict (id) do update set role = excluded.role;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.sync_profile_from_auth_user();

-- GoTrue пишет app_metadata отдельным UPDATE после INSERT, поэтому роль синхронизируем и здесь.
create trigger on_auth_user_role_changed
  after update of raw_app_meta_data on auth.users
  for each row
  when (old.raw_app_meta_data ->> 'role' is distinct from new.raw_app_meta_data ->> 'role')
  execute function private.sync_profile_from_auth_user();

-- 2. tasks BEFORE INSERT.
create function private.tasks_before_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.status := 'new';

  if auth.uid() is not null then
    new.author_id := auth.uid();
  elsif new.author_id is null
    or not exists (
      select 1 from public.profiles p where p.id = new.author_id and p.role = 'manager'
    ) then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  new.created_at := now();
  new.updated_at := now();

  if not exists (
    select 1 from public.profiles p where p.id = new.assignee_id and p.role = 'executor'
  ) then
    raise exception 'ASSIGNEE_NOT_EXECUTOR' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger tasks_before_insert
  before insert on public.tasks
  for each row execute function private.tasks_before_insert();

-- 3. tasks AFTER INSERT: запись создания в историю.
create function private.tasks_after_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.task_status_history (task_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.author_id);

  return null;
end;
$$;

create trigger tasks_after_insert_history
  after insert on public.tasks
  for each row execute function private.tasks_after_insert();

-- 4. tasks BEFORE UPDATE.
create function private.tasks_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status = 'accepted' then
    raise exception 'TASK_ACCEPTED_READONLY' using errcode = 'P0001';
  end if;

  if new.id is distinct from old.id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_FIELD' using errcode = 'P0001';
  end if;

  if new.assignee_id is distinct from old.assignee_id
    and not exists (
      select 1 from public.profiles p where p.id = new.assignee_id and p.role = 'executor'
    ) then
    raise exception 'ASSIGNEE_NOT_EXECUTOR' using errcode = 'P0001';
  end if;

  if new.status is distinct from old.status then
    if coalesce(current_setting('app.status_change', true), '') <> 'rpc' then
      raise exception 'STATUS_CHANGE_FORBIDDEN' using errcode = 'P0001';
    end if;

    if not private.is_valid_transition(old.status, new.status) then
      raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
    end if;
  end if;

  new.updated_at := now();

  return new;
end;
$$;

create trigger tasks_before_update
  before update on public.tasks
  for each row execute function private.tasks_before_update();

-- 5. objects BEFORE UPDATE.
create function private.objects_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
    raise exception 'IMMUTABLE_FIELD' using errcode = 'P0001';
  end if;

  new.updated_at := now();

  return new;
end;
$$;

create trigger objects_before_update
  before update on public.objects
  for each row execute function private.objects_before_update();

-- 6. task_status_history: история неизменяема.
-- Триггер на DELETE не ставим: он сломает каскадное удаление вместе с задачей.
create function private.task_status_history_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  raise exception 'IMMUTABLE_FIELD' using errcode = 'P0001';
end;
$$;

create trigger task_status_history_before_update
  before update on public.task_status_history
  for each row execute function private.task_status_history_before_update();

revoke execute on function private.sync_profile_from_auth_user() from public, anon, authenticated, service_role;
revoke execute on function private.tasks_before_insert() from public, anon, authenticated, service_role;
revoke execute on function private.tasks_after_insert() from public, anon, authenticated, service_role;
revoke execute on function private.tasks_before_update() from public, anon, authenticated, service_role;
revoke execute on function private.objects_before_update() from public, anon, authenticated, service_role;
revoke execute on function private.task_status_history_before_update() from public, anon, authenticated, service_role;
