import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

export type TaskStatus = 'new' | 'in_progress' | 'on_review' | 'accepted' | 'rework';
export type UserRole = 'manager' | 'executor';
export type TestUser = { id: string; email: string; client: SupabaseClient };
export type CreateTestUserOptions = {
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
};
export type ProfileRow = { id: string; full_name: string; role: UserRole; created_at: string };
export type ObjectRow = {
  id: string;
  name: string;
  address: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};
export type TaskRow = {
  id: string;
  object_id: string;
  title: string;
  description: string;
  assignee_id: string;
  status: TaskStatus;
  author_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};
export type HistoryRow = {
  id: number;
  task_id: string;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  changed_by: string;
  changed_at: string;
  comment: string | null;
};
export type CreateObjectInput = { name?: string; address?: string };
export type CreateTaskInput = {
  objectId: string;
  assigneeId: string;
  title?: string;
  description?: string;
};
export type TaskActors = { manager: TestUser; executor: TestUser };
export type TaskField = 'title' | 'description' | 'assignee_id' | 'deleted_at';
export type FieldHistoryRow = {
  id: number;
  task_id: string;
  field: TaskField;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
};
export type DeletedObjectRow = {
  id: string;
  name: string;
  address: string;
  deleted_at: string;
  deleted_by_name: string | null;
};
export type DeletedTaskRow = {
  id: string;
  title: string;
  object_id: string;
  object_name: string;
  object_deleted: boolean;
  deleted_at: string;
  deleted_by_name: string | null;
};
export type RpcRawResult = { data: unknown; error: PostgrestError | null };
export type TrashRpc ='soft_delete_object' | 'restore_object' | 'soft_delete_task' | 'restore_task';
