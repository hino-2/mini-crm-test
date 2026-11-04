-- Схема данных, привилегии и RLS (SPEC §5, §6).

-- 1. Привилегии по умолчанию: новые объекты в public недоступны anon/authenticated.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- 2. Служебная схема (не экспонируется через API).
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- 3. Enum-ы.
create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'on_review', 'accepted', 'rework');

-- 4. profiles.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 200),
  role public.user_role not null default 'executor',
  created_at timestamptz not null default now()
);

-- 5. objects.
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  address text not null check (char_length(trim(address)) between 1 and 500),
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. tasks.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  assignee_id uuid not null references public.profiles (id) on delete restrict,
  status public.task_status not null default 'new',
  author_id uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. task_status_history.
create table public.task_status_history (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  from_status public.task_status null,
  to_status public.task_status not null,
  changed_by uuid not null references public.profiles (id),
  changed_at timestamptz not null default now(),
  comment text null check (char_length(comment) <= 2000)
);

-- 8. Индексы.
create index tasks_object_id_idx on public.tasks (object_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index task_status_history_task_id_changed_at_idx on public.task_status_history (task_id, changed_at);

-- 9. RLS (без FORCE).
alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

-- 10. Grants. Каскады FK идут от имени владельца и обходят grants/RLS.
revoke all on table public.profiles, public.objects, public.tasks, public.task_status_history from anon, authenticated;
revoke all on sequence public.task_status_history_id_seq from anon, authenticated;

grant all on table public.profiles, public.objects, public.tasks, public.task_status_history to service_role;
grant usage, select on sequence public.task_status_history_id_seq to service_role;

grant select on table public.profiles to authenticated;
grant select, delete on table public.objects to authenticated;
grant insert (name, address), update (name, address) on table public.objects to authenticated;
grant select, delete on table public.tasks to authenticated;
grant insert (object_id, title, description, assignee_id), update (object_id, title, description, assignee_id) on table public.tasks to authenticated;
grant select on table public.task_status_history to authenticated;
