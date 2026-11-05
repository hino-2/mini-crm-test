import { INVALID_TEXT_REPRESENTATION_CODE } from '../../shared/api/api.constants';
import { supabase } from '../../shared/api/supabase/supabase';
import { OBJECT_SELECT } from '../objects.constants';
import type { ObjectInput, ObjectRow, ObjectSummary } from '../objects.type';

function toObjectSummary(row: ObjectRow): ObjectSummary {
  return { id: row.id, name: row.name, address: row.address, task_count: row.tasks[0]?.count ?? 0 };
}

export async function fetchObjects(): Promise<ObjectSummary[]> {
  const { data, error } = await supabase
    .from('objects')
    .select(OBJECT_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data.map(toObjectSummary);
}

export async function fetchObject(objectId: string): Promise<ObjectSummary | null> {
  const { data, error } = await supabase
    .from('objects')
    .select(OBJECT_SELECT)
    .eq('id', objectId)
    .maybeSingle();

  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION_CODE) {
      return null;
    }

    throw error;
  }

  return data === null ? null : toObjectSummary(data);
}

export async function createObject(input: ObjectInput): Promise<void> {
  const { error } = await supabase
    .from('objects')
    .insert({ name: input.name, address: input.address });

  if (error) {
    throw error;
  }
}

export async function updateObject(objectId: string, input: ObjectInput): Promise<void> {
  const { error } = await supabase
    .from('objects')
    .update({ name: input.name, address: input.address })
    .eq('id', objectId);

  if (error) {
    throw error;
  }
}

export async function deleteObject(objectId: string): Promise<void> {
  const { error } = await supabase.rpc('soft_delete_object', { p_object_id: objectId });

  if (error) {
    throw error;
  }
}
