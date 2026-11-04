-- Хелперы доступа (SPEC §6.1). security definer, чтобы политики не рекурсировали.

create function private.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid()
$$;

create function private.is_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.current_user_role() = 'manager'::public.user_role, false)
$$;

create function private.can_view_task(p_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_manager()
    or exists (select 1 from public.tasks t where t.id = p_task_id and t.assignee_id = auth.uid())
$$;

create function private.can_view_object(p_object_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.is_manager()
    or exists (select 1 from public.tasks t where t.object_id = p_object_id and t.assignee_id = auth.uid())
$$;

-- Единый источник матрицы переходов (SPEC §5.7) для RPC и триггера.
create function private.is_valid_transition(p_from public.task_status, p_to public.task_status)
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(
    p_from::text || '>' || p_to::text = any (array[
      'new>in_progress',
      'in_progress>on_review',
      'on_review>accepted',
      'on_review>rework',
      'rework>in_progress'
    ]),
    false
  )
$$;

revoke execute on function private.current_user_role() from public, anon, authenticated, service_role;
revoke execute on function private.is_manager() from public, anon, authenticated, service_role;
revoke execute on function private.can_view_task(uuid) from public, anon, authenticated, service_role;
revoke execute on function private.can_view_object(uuid) from public, anon, authenticated, service_role;
revoke execute on function private.is_valid_transition(public.task_status, public.task_status) from public, anon, authenticated, service_role;

grant execute on function private.current_user_role(), private.is_manager(), private.can_view_task(uuid), private.can_view_object(uuid) to authenticated;
