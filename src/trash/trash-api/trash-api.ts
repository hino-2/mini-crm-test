import { supabase } from '../../shared/api/supabase/supabase';
import type { DeletedObject, DeletedTask } from '../trash.type';

export async function fetchDeletedObjects(): Promise<DeletedObject[]> {
  const { data, error } = await supabase.rpc('list_deleted_objects');

  if (error) {
    throw error;
  }

  return data;
}

export async function fetchDeletedTasks(): Promise<DeletedTask[]> {
  const { data, error } = await supabase.rpc('list_deleted_tasks');

  if (error) {
    throw error;
  }

  return data;
}

export async function restoreObject(objectId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_object', { p_object_id: objectId });

  if (error) {
    throw error;
  }
}

export async function restoreTask(taskId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_task', { p_task_id: taskId });

  if (error) {
    throw error;
  }
}
