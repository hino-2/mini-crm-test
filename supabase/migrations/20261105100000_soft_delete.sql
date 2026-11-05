-- Мягкое удаление (корзина), неизменяемый object_id задачи и редактирование принятых задач (SPEC §5, §6, §7).

-- 1. Колонки удаления. Пишутся только RPC (security definer); грантов authenticated на них нет.
alter table public.objects
  add column deleted_at timestamptz null,
  add column deleted_by uuid null references public.profiles (id);

alter table public.tasks
  add column deleted_at timestamptz null,
  add column deleted_by uuid null references public.profiles (id);

-- 2. Хелперы видимости: удалённые задачи/объекты и задачи удалённого объекта скрыты от всех.
create or replace function private.can_view_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    join public.objects o on o.id = t.object_id
    where t.id = p_task_id
      and t.deleted_at is null
      and o.deleted_at is null
      and (private.is_manager() or t.assignee_id = auth.uid())
  )
$$;

create or replace function private.can_view_object(p_object_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.objects o
    where o.id = p_object_id
      and o.deleted_at is null
      and (
        private.is_manager()
        or exists (
          select 1 from public.tasks t
          where t.object_id = o.id and t.assignee_id = auth.uid() and t.deleted_at is null
        )
      )
  )
$$;

-- 3. Физическое удаление только у service_role; object_id неизменяем для authenticated.
revoke delete on table public.objects, public.tasks from authenticated;
revoke update (object_id) on table public.tasks from authenticated;

drop policy objects_delete_manager on public.objects;
drop policy tasks_delete_manager on public.tasks;

-- SELECT-политики не вызывают хелперы по самой строке: INSERT/UPDATE ... RETURNING проверяет новую строку,
-- а функция (snapshot начала оператора) её ещё не видит. Колонки проверяются напрямую,
-- а видимость связанного объекта — хелпером по уже существующей строке objects.
alter policy objects_select_visible on public.objects
  using (deleted_at is null and ((select private.is_manager()) or private.can_view_object(id)));

alter policy tasks_select_visible on public.tasks
  using (
    deleted_at is null
    and ((select private.is_manager()) or assignee_id = (select auth.uid()))
    and private.can_view_object(object_id)
  );

alter policy objects_update_manager on public.objects
  using ((select private.is_manager()) and private.can_view_object(id))
  with check ((select private.is_manager()));

alter policy tasks_update_manager on public.tasks
  using ((select private.is_manager()) and private.can_view_task(id))
  with check ((select private.is_manager()));

-- 4. tasks BEFORE INSERT: удаляемые поля не задаются клиентом, в удалённый объект вставка запрещена.
create or replace function private.tasks_before_insert()
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

  new.deleted_at := null;
  new.deleted_by := null;

  if exists (
    select 1 from public.objects o where o.id = new.object_id and o.deleted_at is not null
  ) then
    raise exception 'OBJECT_DELETED' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = new.assignee_id and p.role = 'executor'
  ) then
    raise exception 'ASSIGNEE_NOT_EXECUTOR' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- 5. tasks BEFORE UPDATE: принятые задачи редактируются, object_id неизменяем,
-- правки удалённой задачи (и задачи удалённого объекта) запрещены.
create or replace function private.tasks_before_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_edit boolean;
begin
  if new.id is distinct from old.id
    or new.author_id is distinct from old.author_id
    or new.created_at is distinct from old.created_at
    or new.object_id is distinct from old.object_id then
    raise exception 'IMMUTABLE_FIELD' using errcode = 'P0001';
  end if;

  v_edit := new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.assignee_id is distinct from old.assignee_id
    or new.status is distinct from old.status;

  if v_edit and (
    old.deleted_at is not null
    or new.deleted_at is not null
    or exists (
      select 1 from public.objects o where o.id = new.object_id and o.deleted_at is not null
    )
  ) then
    raise exception 'TASK_DELETED' using errcode = 'P0001';
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

-- 6. RPC удаления и восстановления (только менеджер).
create function public.soft_delete_object(p_object_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_manager() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  update public.objects
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_object_id and deleted_at is null;

  if not found then
    raise exception 'OBJECT_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

create function public.restore_object(p_object_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_manager() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  update public.objects
  set deleted_at = null, deleted_by = null
  where id = p_object_id and deleted_at is not null;

  if not found then
    raise exception 'OBJECT_NOT_FOUND' using errcode = 'P0001';
  end if;
end;
$$;

create function public.soft_delete_task(p_task_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_manager() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;

  if not found
    or v_task.deleted_at is not null
    or exists (
      select 1 from public.objects o where o.id = v_task.object_id and o.deleted_at is not null
    ) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  update public.tasks
  set deleted_at = now(), deleted_by = auth.uid()
  where id = p_task_id;
end;
$$;

create function public.restore_task(p_task_id uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not private.is_manager() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;

  if not found or v_task.deleted_at is null then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.objects o where o.id = v_task.object_id and o.deleted_at is not null
  ) then
    raise exception 'OBJECT_DELETED' using errcode = 'P0001';
  end if;

  update public.tasks
  set deleted_at = null, deleted_by = null
  where id = p_task_id;
end;
$$;

-- 7. Списки корзины (только менеджер; исполнителю — пустой результат).
create function public.list_deleted_objects()
returns table (id uuid, name text, address text, deleted_at timestamptz, deleted_by_name text)
language sql stable security definer set search_path = ''
as $$
  select o.id, o.name, o.address, o.deleted_at, p.full_name
  from public.objects o
  left join public.profiles p on p.id = o.deleted_by
  where o.deleted_at is not null and (select private.is_manager())
  order by o.deleted_at desc, o.id
$$;

create function public.list_deleted_tasks()
returns table (
  id uuid,
  title text,
  object_id uuid,
  object_name text,
  object_deleted boolean,
  deleted_at timestamptz,
  deleted_by_name text
)
language sql stable security definer set search_path = ''
as $$
  select t.id, t.title, t.object_id, o.name, (o.deleted_at is not null), t.deleted_at, p.full_name
  from public.tasks t
  join public.objects o on o.id = t.object_id
  left join public.profiles p on p.id = t.deleted_by
  where t.deleted_at is not null and (select private.is_manager())
  order by t.deleted_at desc, t.id
$$;

revoke execute on function public.soft_delete_object(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.restore_object(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.soft_delete_task(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.restore_task(uuid) from public, anon, authenticated, service_role;
revoke execute on function public.list_deleted_objects() from public, anon, authenticated, service_role;
revoke execute on function public.list_deleted_tasks() from public, anon, authenticated, service_role;

grant execute on function public.soft_delete_object(uuid) to authenticated;
grant execute on function public.restore_object(uuid) to authenticated;
grant execute on function public.soft_delete_task(uuid) to authenticated;
grant execute on function public.restore_task(uuid) to authenticated;
grant execute on function public.list_deleted_objects() to authenticated;
grant execute on function public.list_deleted_tasks() to authenticated;
