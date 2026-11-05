import { INVALID_TEXT_REPRESENTATION_CODE } from '../../shared/api/api.constants';
import { supabase } from '../../shared/api/supabase/supabase';
import {
  MY_TASKS_SELECT,
  OBJECT_TASKS_SELECT,
  TASK_DETAILS_SELECT,
  TASK_HISTORY_SELECT,
} from '../tasks.constants';
import type {
  MyTaskItem,
  TaskCreateInput,
  TaskDetails,
  TaskHistoryEntry,
  TaskListItem,
  TaskStatus,
  TaskUpdateInput,
} from '../tasks.type';

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

export async function fetchTask(taskId: string): Promise<TaskDetails | null> {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_DETAILS_SELECT)
    .eq('id', taskId)
    .maybeSingle();

  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION_CODE) {
      return null;
    }

    throw error;
  }

  return data;
}

export async function fetchTaskHistory(taskId: string): Promise<TaskHistoryEntry[]> {
  const { data, error } = await supabase
    .from('task_status_history')
    .select(TASK_HISTORY_SELECT)
    .eq('task_id', taskId)
    .order('changed_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchMyTasks(assigneeId: string): Promise<MyTaskItem[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select(MY_TASKS_SELECT)
    .eq('assignee_id', assigneeId);

  if (error) {
    throw error;
  }

  return data;
}

export async function changeTaskStatus(
  taskId: string,
  toStatus: TaskStatus,
  comment: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('change_task_status', {
    p_task_id: taskId,
    p_to_status: toStatus,
    p_comment: comment ?? undefined,
  });

  if (error) {
    throw error;
  }
}

export async function updateTask(taskId: string, input: TaskUpdateInput): Promise<void> {
  const { error } = await supabase
    .from('tasks')
    .update({
      object_id: input.object_id,
      title: input.title,
      description: input.description,
      assignee_id: input.assignee_id,
    })
    .eq('id', taskId);

  if (error) {
    throw error;
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);

  if (error) {
    throw error;
  }
}
