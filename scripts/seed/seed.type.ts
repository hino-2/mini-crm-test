import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/shared/api/database.types';

export type TaskStatus = Database['public']['Enums']['task_status'];
export type UserRole = Database['public']['Enums']['user_role'];

export type DemoUserKey = 'manager1' | 'manager2' | 'executor1' | 'executor2';
export type ExecutorKey = 'executor1' | 'executor2';
export type DemoObjectKey = 'northPark' | 'galaxy' | 'pineForest';

export type DemoUser = { key: DemoUserKey; email: string; fullName: string; role: UserRole };
export type DemoObject = { key: DemoObjectKey; name: string; address: string };
export type DemoStep = { actor: DemoUserKey; to: TaskStatus; comment?: string };
export type DemoTask = {
  objectKey: DemoObjectKey;
  assigneeKey: ExecutorKey;
  title: string;
  description: string;
  steps: readonly DemoStep[];
};

export type SeedLogger = (message: string) => void;
export type SeedEnv = Record<string, string | undefined>;
export type SeedArgs = { reset: boolean; yes: boolean; envFile: string | null };
export type SeedOptions = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  password: string;
  reset: boolean;
  log?: SeedLogger;
};

export type SeedUserSummary = {
  key: DemoUserKey;
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  created: boolean;
};
export type SeedObjectSummary = { id: string; name: string };
export type SeedTaskSummary = {
  id: string;
  objectId: string;
  title: string;
  assigneeId: string;
  status: TaskStatus;
};
export type SeedSummary = {
  users: SeedUserSummary[];
  demoData: 'created' | 'skipped';
  deletedObjectCount: number;
  objects: SeedObjectSummary[];
  tasks: SeedTaskSummary[];
};

export type SeedClient = SupabaseClient<Database>;
export type SeedClients = Record<DemoUserKey, SeedClient>;
