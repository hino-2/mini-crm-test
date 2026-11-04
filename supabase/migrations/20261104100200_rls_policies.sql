-- RLS-политики (SPEC §6.2). Только для authenticated; anon политик не имеет.

create policy profiles_select_authenticated on public.profiles
  for select to authenticated using (true);

create policy objects_select_visible on public.objects
  for select to authenticated using (private.can_view_object(id));
create policy objects_insert_manager on public.objects
  for insert to authenticated with check ((select private.is_manager()));
create policy objects_update_manager on public.objects
  for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create policy objects_delete_manager on public.objects
  for delete to authenticated using ((select private.is_manager()));

create policy tasks_select_visible on public.tasks
  for select to authenticated using (private.can_view_task(id));
create policy tasks_insert_manager on public.tasks
  for insert to authenticated with check ((select private.is_manager()));
create policy tasks_update_manager on public.tasks
  for update to authenticated using ((select private.is_manager())) with check ((select private.is_manager()));
create policy tasks_delete_manager on public.tasks
  for delete to authenticated using ((select private.is_manager()));

create policy task_status_history_select_visible on public.task_status_history
  for select to authenticated using (private.can_view_task(task_id));
