-- История правок полей задачи (SPEC §5.9, §7.5): неизменяемый аудит, пишется триггером БД.

create type public.task_field as enum ('title', 'description', 'assignee_id', 'deleted_at');

create table public.task_field_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  field public.task_field not null,
  old_value text null,
  new_value text null,
  -- null = системная правка (service_role / Dashboard).
  changed_by uuid null references public.profiles (id),
  changed_at timestamptz not null default now()
);

create index task_field_history_task_id_changed_at_idx on public.task_field_history (task_id, changed_at);

alter table public.task_field_history enable row level security;

revoke all on table public.task_field_history from anon, authenticated;
revoke all on sequence public.task_field_history_id_seq from anon, authenticated;

grant all on table public.task_field_history to service_role;
grant usage, select on sequence public.task_field_history_id_seq to service_role;
grant select on table public.task_field_history to authenticated;

create policy task_field_history_select_visible on public.task_field_history
  for select to authenticated using (private.can_view_task(task_id));

-- Неизменяемость: тот же триггер, что и у task_status_history. Триггер на DELETE не ставим (каскад).
create trigger task_field_history_before_update
  before update on public.task_field_history
  for each row execute function private.task_status_history_before_update();

-- Запись реальных изменений полей (is distinct from) в фиксированном порядке.
create function private.tasks_after_update_field_history()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.title is distinct from old.title then
    insert into public.task_field_history (task_id, field, old_value, new_value, changed_by)
    values (new.id, 'title', old.title, new.title, auth.uid());
  end if;

  if new.description is distinct from old.description then
    insert into public.task_field_history (task_id, field, old_value, new_value, changed_by)
    values (new.id, 'description', old.description, new.description, auth.uid());
  end if;

  if new.assignee_id is distinct from old.assignee_id then
    insert into public.task_field_history (task_id, field, old_value, new_value, changed_by)
    values (new.id, 'assignee_id', old.assignee_id::text, new.assignee_id::text, auth.uid());
  end if;

  if new.deleted_at is distinct from old.deleted_at then
    insert into public.task_field_history (task_id, field, old_value, new_value, changed_by)
    values (new.id, 'deleted_at', old.deleted_at::text, new.deleted_at::text, auth.uid());
  end if;

  return null;
end;
$$;

create trigger tasks_after_update_field_history
  after update of title, description, assignee_id, deleted_at on public.tasks
  for each row execute function private.tasks_after_update_field_history();

revoke execute on function private.tasks_after_update_field_history() from public, anon, authenticated, service_role;
