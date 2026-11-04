-- RPC смены статуса (SPEC §5.6): единственный API перехода статусов.

create function public.change_task_status(
  p_task_id uuid,
  p_to_status public.task_status,
  p_comment text default null
)
returns public.tasks
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid;
  v_task public.tasks;
  v_from public.task_status;
  v_comment text;
  v_role public.user_role;
begin
  v_uid := auth.uid();

  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_task from public.tasks where id = p_task_id for update;

  if not found or not private.can_view_task(p_task_id) then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_comment := nullif(trim(p_comment), '');
  v_from := v_task.status;

  if not private.is_valid_transition(v_from, p_to_status) then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0001';
  end if;

  v_role := private.current_user_role();

  if p_to_status in ('accepted', 'rework') then
    if v_role is distinct from 'manager'::public.user_role then
      raise exception 'NOT_ALLOWED' using errcode = 'P0001';
    end if;
  elsif v_role is distinct from 'executor'::public.user_role or v_task.assignee_id <> v_uid then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if p_to_status = 'rework' and v_comment is null then
    raise exception 'COMMENT_REQUIRED' using errcode = 'P0001';
  end if;

  perform set_config('app.status_change', 'rpc', true);

  update public.tasks set status = p_to_status where id = p_task_id returning * into v_task;

  perform set_config('app.status_change', '', true);

  insert into public.task_status_history (task_id, from_status, to_status, changed_by, comment)
  values (p_task_id, v_from, p_to_status, v_uid, v_comment);

  return v_task;
end;
$$;

revoke execute on function public.change_task_status(uuid, public.task_status, text) from public, anon, authenticated, service_role;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;
