import { supabase } from '../../shared/api/supabase/supabase';
import { OBJECT_TASKS_SELECT } from '../tasks.constants';
import type { TaskCreateInput, TaskListItem } from '../tasks.type';

export async function fetchObjectTasks(objectId: string): Promise<TaskListItem[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(OBJECT_TASKS_SELECT)
    .eq('object_id', objectId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function createTask(input: TaskCreateInput): Promise<void> {
  const { error } = await supabase.from('tasks').insert({
    object_id: input.object_id,
    title: input.title,
    description: input.description,
    assignee_id: input.assignee_id,
  });

  if (error) {
    throw error;
  }
}
