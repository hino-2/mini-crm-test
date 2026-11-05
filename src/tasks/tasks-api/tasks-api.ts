import { INVALID_TEXT_REPRESENTATION_CODE } from '../../shared/api/api.constants';
import { supabase } from '../../shared/api/supabase/supabase';
import { UNKNOWN_USER_LABEL } from '../../profiles/profiles.constants';
import {
  MY_TASKS_SELECT,
  OBJECT_TASKS_SELECT,
  TASK_DETAILS_SELECT,
  TASK_FIELD_HISTORY_SELECT,
  TASK_HISTORY_SELECT,
} from '../tasks.constants';
import type {
  MyTaskItem,
  TaskCreateInput,
  TaskDetails,
  TaskFieldHistoryEntry,
  TaskHistoryEntry,
  TaskListItem,
  TaskStatus,
  TaskStatusHistoryEntry,
  TaskUpdateInput,
} from '../tasks.type';
import { mergeTaskHistory } from './tasks-api.util';

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
  const [statusResult, fieldResult] = await Promise.all([
    supabase
      .from('task_status_history')
      .select(TASK_HISTORY_SELECT)
      .eq('task_id', taskId)
      .order('changed_at', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('task_field_history')
      .select(TASK_FIELD_HISTORY_SELECT)
      .eq('task_id', taskId)
      .order('changed_at', { ascending: true })
      .order('id', { ascending: true }),
  ]);

  if (statusResult.error) {
    throw statusResult.error;
  }

  if (fieldResult.error) {
    throw fieldResult.error;
  }

  const assigneeIds = new Set<string>();

  for (const row of fieldResult.data) {
    if (row.field === 'assignee_id') {
      for (const value of [row.old_value, row.new_value]) {
        if (value !== null) {
          assigneeIds.add(value);
        }
      }
    }
  }

  const names = new Map<string, string>();

  if (assigneeIds.size > 0) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', [...assigneeIds]);

    if (error) {
      throw error;
    }

    for (const profile of data) {
      names.set(profile.id, profile.full_name);
    }
  }

  const toName = (value: string | null): string | null =>
    value === null ? null : (names.get(value) ?? UNKNOWN_USER_LABEL);
  const statusEntries: TaskStatusHistoryEntry[] = statusResult.data.map((row) => ({
    ...row,
    kind: 'status',
  }));
  const fieldEntries: TaskFieldHistoryEntry[] = fieldResult.data.map((row) =>
    row.field === 'assignee_id'
      ? {
          ...row,
          kind: 'field',
          old_value: toName(row.old_value),
          new_value: toName(row.new_value),
        }
      : { ...row, kind: 'field' },
  );

  return mergeTaskHistory(statusEntries, fieldEntries);
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
  const { error } = await supabase.rpc('soft_delete_task', { p_task_id: taskId });

  if (error) {
    throw error;
  }
}
