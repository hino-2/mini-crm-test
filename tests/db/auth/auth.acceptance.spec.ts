import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createAdminClient,
  createAnonClient,
  createExecutor,
  createManager,
  createObject,
  createTask,
  uniqueSuffix,
} from '../fixtures/fixtures';
import { TEST_EMAIL_DOMAIN, TEST_PASSWORD } from '../fixtures/fixtures.constants';
import type { TaskRow } from '../fixtures/fixtures.type';

describe('§4 / §10.1 Auth: signup is disabled', () => {
  let anon: SupabaseClient;

  beforeAll(async () => {
    anon = await createAnonClient();
  });

  it('§10.1: signUp via anon client is rejected', async () => {
    const { data, error } = await anon.auth.signUp({
      email: `signup-${uniqueSuffix()}@${TEST_EMAIL_DOMAIN}`,
      password: TEST_PASSWORD,
    });

    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });
});

describe('§6 / §10.1 Auth: anon has no rights on tables and functions', () => {
  let anon: SupabaseClient;
  let admin: SupabaseClient;
  let task: TaskRow;

  beforeAll(async () => {
    anon = await createAnonClient();
    admin = await createAdminClient();

    const manager = await createManager();
    const executor = await createExecutor();
    const object = await createObject(manager.client);

    task = await createTask(manager.client, { objectId: object.id, assigneeId: executor.id });
  });

  it.each(['profiles', 'objects', 'tasks', 'task_status_history'])(
    '§6: anon cannot read table %s (42501)',
    async (table) => {
      const { error } = await anon.from(table).select('*');

      expect(error?.code).toBe('42501');
    },
  );

  it('§6: anon cannot insert into objects (42501)', async () => {
    const { error } = await anon
      .from('objects')
      .insert({ name: `Anon ${uniqueSuffix()}`, address: 'Anon address' });

    expect(error?.code).toBe('42501');
  });

  it('§5.6: EXECUTE on change_task_status is not granted to anon (blocked before NOT_AUTHENTICATED)', async () => {
    const { error } = await anon.rpc('change_task_status', {
      p_task_id: task.id,
      p_to_status: 'in_progress',
    });

    expect(error).not.toBeNull();
    expect(error?.message).not.toBe('NOT_AUTHENTICATED');

    const { data, error: readError } = await admin
      .from('tasks')
      .select('status')
      .eq('id', task.id)
      .single();

    expect(readError).toBeNull();
    expect((data as Pick<TaskRow, 'status'>).status).toBe('new');
  });
});
