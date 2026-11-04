import type { SupabaseClient } from '@supabase/supabase-js';

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
