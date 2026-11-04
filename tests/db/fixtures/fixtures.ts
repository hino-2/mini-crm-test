import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDbTestEnv } from '../env/env';
import {
  CLIENT_OPTIONS,
  FIXTURE_REWORK_COMMENT,
  TEST_EMAIL_DOMAIN,
  TEST_PASSWORD,
} from './fixtures.constants';
import type {
  CreateObjectInput,
  CreateTaskInput,
  CreateTestUserOptions,
  ObjectRow,
  TaskActors,
  TaskRow,
  TaskStatus,
  TestUser,
} from './fixtures.type';

export function uniqueSuffix(): string {
  return randomUUID().replace(/-/g, '').toLowerCase();
}

export async function createAdminClient(): Promise<SupabaseClient> {
  const env = await getDbTestEnv();

  return createClient(env.url, env.serviceRoleKey, CLIENT_OPTIONS);
}

export async function createAnonClient(): Promise<SupabaseClient> {
  const env = await getDbTestEnv();

  return createClient(env.url, env.anonKey, CLIENT_OPTIONS);
}

export async function createTestUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
  const admin = await createAdminClient();
  const email = `user-${uniqueSuffix()}@${TEST_EMAIL_DOMAIN}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    ...(options.appMetadata ? { app_metadata: options.appMetadata } : {}),
    ...(options.userMetadata ? { user_metadata: options.userMetadata } : {}),
  });

  if (error) {
    throw new Error(`createTestUser failed: ${error.message}`);
  }

  const client = await createAnonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });

  if (signIn.error) {
    throw new Error(`createTestUser failed: ${signIn.error.message}`);
  }

  return { id: data.user.id, email, client };
}

export function createManager(): Promise<TestUser> {
  return createTestUser({
    appMetadata: { role: 'manager' },
    userMetadata: { full_name: `Manager ${uniqueSuffix()}` },
  });
}

export function createExecutor(): Promise<TestUser> {
  return createTestUser({
    appMetadata: { role: 'executor' },
    userMetadata: { full_name: `Executor ${uniqueSuffix()}` },
  });
}

export async function createObject(
  client: SupabaseClient,
  input: CreateObjectInput = {},
): Promise<ObjectRow> {
  const { data, error } = await client
    .from('objects')
    .insert({
      name: input.name ?? `Object ${uniqueSuffix()}`,
      address: input.address ?? `Address ${uniqueSuffix()}`,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`createObject failed: ${error.message}`);
  }

  return data as ObjectRow;
}

export async function createTask(client: SupabaseClient, input: CreateTaskInput): Promise<TaskRow> {
  const { data, error } = await client
    .from('tasks')
    .insert({
      object_id: input.objectId,
      title: input.title ?? `Task ${uniqueSuffix()}`,
      assignee_id: input.assigneeId,
      ...(input.description !== undefined ? { description: input.description } : {}),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`createTask failed: ${error.message}`);
  }

  return data as TaskRow;
}

async function rpcChangeStatus(
  user: TestUser,
  taskId: string,
  toStatus: TaskStatus,
  comment?: string,
): Promise<TaskRow> {
  const { data, error } = await user.client.rpc('change_task_status', {
    p_task_id: taskId,
    p_to_status: toStatus,
    ...(comment !== undefined ? { p_comment: comment } : {}),
  });

  if (error) {
    throw new Error(`advanceTask failed: ${error.message}`);
  }

  return data as TaskRow;
}

export async function advanceTask(
  actors: TaskActors,
  taskId: string,
  target: TaskStatus,
): Promise<TaskRow> {
  const { manager, executor } = actors;

  if (target === 'new') {
    const { data, error } = await manager.client.from('tasks').select().eq('id', taskId).single();

    if (error) {
      throw new Error(`advanceTask failed: ${error.message}`);
    }

    return data as TaskRow;
  }

  let row = await rpcChangeStatus(executor, taskId, 'in_progress');

  if (target === 'in_progress') {
    return row;
  }

  row = await rpcChangeStatus(executor, taskId, 'on_review');

  if (target === 'on_review') {
    return row;
  }

  if (target === 'accepted') {
    return rpcChangeStatus(manager, taskId, 'accepted');
  }

  if (target === 'rework') {
    return rpcChangeStatus(manager, taskId, 'rework', FIXTURE_REWORK_COMMENT);
  }

  throw new Error(`advanceTask failed: unsupported target ${String(target)}`);
}
