import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceTask,
  createAdminClient,
  createExecutor,
  createManager,
  createObject,
  createTask,
  uniqueSuffix,
} from '../fixtures/fixtures';
import type {
  HistoryRow,
  ObjectRow,
  TaskRow,
  TestUser,
} from '../fixtures/fixtures.type';

async function readTask(admin: SupabaseClient, id: string): Promise<TaskRow | null> {
  const { data, error } = await admin.from('tasks').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`readTask failed: ${error.message}`);
  }

  return data as TaskRow | null;
}

async function readObject(admin: SupabaseClient, id: string): Promise<ObjectRow | null> {
  const { data, error } = await admin.from('objects').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`readObject failed: ${error.message}`);
  }

  return data as ObjectRow | null;
}

async function readHistory(admin: SupabaseClient, taskId: string): Promise<HistoryRow[]> {
  const { data, error } = await admin
    .from('task_status_history')
    .select('*')
    .eq('task_id', taskId)
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`readHistory failed: ${error.message}`);
  }

  return (data ?? []) as HistoryRow[];
}

function utcYear(timestamp: string): number {
  return new Date(timestamp).getUTCFullYear();
}

describe('§6.2 / §10.1 Writes: executor cannot write objects and tasks', () => {
  let admin: SupabaseClient;
  let manager: TestUser;
  let executor: TestUser;
  let object: ObjectRow;
  let task: TaskRow;

  beforeAll(async () => {
    admin = await createAdminClient();
    manager = await createManager();
    executor = await createExecutor();
    object = await createObject(manager.client);
    task = await createTask(manager.client, { objectId: object.id, assigneeId: executor.id });
  });

  it('§6.2: executor INSERT into objects → 42501', async () => {
    const { error } = await executor.client
      .from('objects')
      .insert({ name: `Exec ${uniqueSuffix()}`, address: 'Exec address' });

    expect(error?.code).toBe('42501');
  });

  it('§6.2: executor UPDATE of a visible object affects 0 rows, object unchanged', async () => {
    const { data, error } = await executor.client
      .from('objects')
      .update({ name: 'Hacked' })
      .eq('id', object.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readObject(admin, object.id))?.name).toBe(object.name);
  });

  it('§6.2: executor DELETE of a visible object affects 0 rows, object still exists', async () => {
    const { data, error } = await executor.client
      .from('objects')
      .delete()
      .eq('id', object.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readObject(admin, object.id)).not.toBeNull();
  });

  it('§6.2: executor INSERT into tasks (even assigned to self) → 42501', async () => {
    const { error } = await executor.client
      .from('tasks')
      .insert({ object_id: object.id, title: `Exec ${uniqueSuffix()}`, assignee_id: executor.id });

    expect(error?.code).toBe('42501');
  });

  it('§6.2: executor UPDATE of own task affects 0 rows, task unchanged', async () => {
    const { data, error } = await executor.client
      .from('tasks')
      .update({ title: 'Hacked' })
      .eq('id', task.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readTask(admin, task.id))?.title).toBe(task.title);
  });

  it('§6.2: executor DELETE of own task affects 0 rows, task still exists', async () => {
    const { data, error } = await executor.client
      .from('tasks')
      .delete()
      .eq('id', task.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readTask(admin, task.id)).not.toBeNull();
  });
});

describe('§6.3 / §7.1 / §7.2 / §10.1 Writes: manager', () => {
  let admin: SupabaseClient;
  let manager: TestUser;
  let manager2: TestUser;
  let executor: TestUser;
  let object: ObjectRow;
  let task: TaskRow;

  beforeAll(async () => {
    admin = await createAdminClient();
    manager = await createManager();
    manager2 = await createManager();
    executor = await createExecutor();
    object = await createObject(manager.client);
    task = await createTask(manager.client, { objectId: object.id, assigneeId: executor.id });
  });

  it('§7.1 / §10.1: created task has status new, author = manager, history null → new by manager', async () => {
    expect(task.status).toBe('new');
    expect(task.author_id).toBe(manager.id);

    const history = await readHistory(admin, task.id);

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      from_status: null,
      to_status: 'new',
      changed_by: manager.id,
      comment: null,
    });
  });

  it('§5.3: created object has created_by = manager', () => {
    expect(object.created_by).toBe(manager.id);
  });

  it('§6.3 / §10.1: INSERT with status = accepted → 42501, no task created', async () => {
    const title = `Status ${uniqueSuffix()}`;
    const { error } = await manager.client
      .from('tasks')
      .insert({ object_id: object.id, title, assignee_id: executor.id, status: 'accepted' });

    expect(error?.code).toBe('42501');

    const { data, error: readError } = await admin.from('tasks').select('id').eq('title', title);

    expect(readError).toBeNull();
    expect(data).toEqual([]);
  });

  it('§6.3: INSERT with author_id → 42501', async () => {
    const { error } = await manager.client.from('tasks').insert({
      object_id: object.id,
      title: `Author ${uniqueSuffix()}`,
      assignee_id: executor.id,
      author_id: manager2.id,
    });

    expect(error?.code).toBe('42501');
  });

  it('§6.3 / §10.1: UPDATE status → 42501, status unchanged', async () => {
    const { error } = await manager.client
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', task.id);

    expect(error?.code).toBe('42501');
    expect((await readTask(admin, task.id))?.status).toBe('new');
  });

  it('§6.3: UPDATE author_id → 42501, author unchanged', async () => {
    const { error } = await manager.client
      .from('tasks')
      .update({ author_id: manager2.id })
      .eq('id', task.id);

    expect(error?.code).toBe('42501');
    expect((await readTask(admin, task.id))?.author_id).toBe(manager.id);
  });

  it('§6.3: object INSERT with created_by → 42501', async () => {
    const { error } = await manager.client.from('objects').insert({
      name: `Created by ${uniqueSuffix()}`,
      address: 'Address',
      created_by: manager2.id,
    });

    expect(error?.code).toBe('42501');
  });

  it('§7.1 / §10.1: INSERT with a manager as assignee → ASSIGNEE_NOT_EXECUTOR', async () => {
    const { error } = await manager.client.from('tasks').insert({
      object_id: object.id,
      title: `Assignee ${uniqueSuffix()}`,
      assignee_id: manager2.id,
    });

    expect(error?.message).toBe('ASSIGNEE_NOT_EXECUTOR');
  });

  it('§7.2 / §10.1: UPDATE assignee to a manager → ASSIGNEE_NOT_EXECUTOR, assignee unchanged', async () => {
    const { error } = await manager.client
      .from('tasks')
      .update({ assignee_id: manager2.id })
      .eq('id', task.id);

    expect(error?.message).toBe('ASSIGNEE_NOT_EXECUTOR');
    expect((await readTask(admin, task.id))?.assignee_id).toBe(executor.id);
  });

  it('§7.1: INSERT with a non-existent assignee → ASSIGNEE_NOT_EXECUTOR', async () => {
    const { error } = await manager.client.from('tasks').insert({
      object_id: object.id,
      title: `Ghost ${uniqueSuffix()}`,
      assignee_id: randomUUID(),
    });

    expect(error?.message).toBe('ASSIGNEE_NOT_EXECUTOR');
  });

  it("§4 / §12.7: another manager can edit a manager's task", async () => {
    const title = `Edited by M2 ${uniqueSuffix()}`;
    const { data, error } = await manager2.client
      .from('tasks')
      .update({ title })
      .eq('id', task.id)
      .select();

    expect(error).toBeNull();
    expect(((data ?? []) as TaskRow[]).map((r) => r.title)).toEqual([title]);
  });
});

describe('§7.2 / §12.2 / §12.3 Writes: accepted task', () => {
  let admin: SupabaseClient;
  let manager: TestUser;
  let executor: TestUser;
  let accepted: TaskRow;

  beforeAll(async () => {
    admin = await createAdminClient();
    manager = await createManager();
    executor = await createExecutor();

    const object = await createObject(manager.client);
    const task = await createTask(manager.client, { objectId: object.id, assigneeId: executor.id });

    accepted = await advanceTask({ manager, executor }, task.id, 'accepted');
  });

  it('§10.1: manager UPDATE of accepted task → TASK_ACCEPTED_READONLY', async () => {
    const { error } = await manager.client
      .from('tasks')
      .update({ title: `Changed ${uniqueSuffix()}` })
      .eq('id', accepted.id);

    expect(error?.message).toBe('TASK_ACCEPTED_READONLY');
    expect((await readTask(admin, accepted.id))?.title).toBe(accepted.title);
  });

  it('§10.1 / §12.3: manager DELETE of accepted task succeeds, history goes with it', async () => {
    const { data, error } = await manager.client
      .from('tasks')
      .delete()
      .eq('id', accepted.id)
      .select();

    expect(error).toBeNull();
    expect(((data ?? []) as TaskRow[]).map((r) => r.id)).toEqual([accepted.id]);
    expect(await readTask(admin, accepted.id)).toBeNull();
    expect(await readHistory(admin, accepted.id)).toEqual([]);
  });
});

describe('§7.2 / §12.6 / §10.1 Writes: reassignment', () => {
  let admin: SupabaseClient;
  let manager: TestUser;
  let a: TestUser;
  let b: TestUser;
  let object: ObjectRow;
  let task: TaskRow;
  let historyCountBefore: number;

  beforeAll(async () => {
    admin = await createAdminClient();
    manager = await createManager();
    a = await createExecutor();
    b = await createExecutor();
    object = await createObject(manager.client);

    const created = await createTask(manager.client, { objectId: object.id, assigneeId: a.id });

    task = await advanceTask({ manager, executor: a }, created.id, 'in_progress');
    historyCountBefore = (await readHistory(admin, task.id)).length;

    const { error } = await manager.client
      .from('tasks')
      .update({ assignee_id: b.id })
      .eq('id', task.id);

    if (error) {
      throw new Error(`reassign failed: ${error.message}`);
    }
  });

  it('§12.6: status unchanged and no history row written', async () => {
    const stored = await readTask(admin, task.id);

    expect(stored?.assignee_id).toBe(b.id);
    expect(stored?.status).toBe('in_progress');
    expect(await readHistory(admin, task.id)).toHaveLength(historyCountBefore);
  });

  it('§10.1: old assignee no longer sees the task nor the object', async () => {
    const tasks = await a.client.from('tasks').select('*').eq('id', task.id);
    const objects = await a.client.from('objects').select('*').eq('id', object.id);

    expect(tasks.error).toBeNull();
    expect(tasks.data).toEqual([]);
    expect(objects.error).toBeNull();
    expect(objects.data).toEqual([]);
  });

  it('§10.1: new assignee sees the task and the object', async () => {
    const tasks = await b.client.from('tasks').select('*').eq('id', task.id);
    const objects = await b.client.from('objects').select('*').eq('id', object.id);

    expect(tasks.error).toBeNull();
    expect(((tasks.data ?? []) as TaskRow[]).map((r) => r.id)).toEqual([task.id]);
    expect(objects.error).toBeNull();
    expect(((objects.data ?? []) as ObjectRow[]).map((r) => r.id)).toEqual([object.id]);
  });

  it('§12.13: old assignee RPC on the task → TASK_NOT_FOUND', async () => {
    const { error } = await a.client.rpc('change_task_status', {
      p_task_id: task.id,
      p_to_status: 'on_review',
    });

    expect(error?.message).toBe('TASK_NOT_FOUND');
    expect((await readTask(admin, task.id))?.status).toBe('in_progress');
  });

  it('§12.6: new assignee continues from current status (in_progress → on_review)', async () => {
    const { data, error } = await b.client.rpc('change_task_status', {
      p_task_id: task.id,
      p_to_status: 'on_review',
    });

    expect(error).toBeNull();
    expect((data as TaskRow).status).toBe('on_review');
  });
});

describe('§7.1 / §7.2 / §7.4 Writes: triggers hold against service_role', () => {
  const OLD_TIMESTAMP = '2000-01-01T00:00:00Z';

  let admin: SupabaseClient;
  let manager: TestUser;
  let manager2: TestUser;
  let executor: TestUser;
  let object: ObjectRow;
  let task: TaskRow;

  beforeAll(async () => {
    admin = await createAdminClient();
    manager = await createManager();
    manager2 = await createManager();
    executor = await createExecutor();
    object = await createObject(manager.client);
    task = await createTask(manager.client, { objectId: object.id, assigneeId: executor.id });
  });

  it('§7.1: service_role INSERT with non-manager author_id → NOT_ALLOWED', async () => {
    const { error } = await admin.from('tasks').insert({
      object_id: object.id,
      title: `Svc ${uniqueSuffix()}`,
      assignee_id: executor.id,
      author_id: executor.id,
    });

    expect(error?.message).toBe('NOT_ALLOWED');
  });

  it('§7.1: service_role INSERT without author_id → NOT_ALLOWED', async () => {
    const { error } = await admin.from('tasks').insert({
      object_id: object.id,
      title: `Svc ${uniqueSuffix()}`,
      assignee_id: executor.id,
    });

    expect(error?.message).toBe('NOT_ALLOWED');
  });

  it('§7.1: service_role INSERT forces status new and created_at now(); history changed_by = author', async () => {
    const { data, error } = await admin
      .from('tasks')
      .insert({
        object_id: object.id,
        title: `Svc ${uniqueSuffix()}`,
        assignee_id: executor.id,
        author_id: manager.id,
        status: 'accepted',
        created_at: OLD_TIMESTAMP,
      })
      .select()
      .single();

    expect(error).toBeNull();

    const row = data as TaskRow;

    expect(row.status).toBe('new');
    expect(row.author_id).toBe(manager.id);
    expect(utcYear(row.created_at)).not.toBe(2000);

    const history = await readHistory(admin, row.id);

    expect(history).toHaveLength(1);
    expect(history[0].changed_by).toBe(manager.id);
  });

  it('§7.2: service_role UPDATE of task author_id → IMMUTABLE_FIELD', async () => {
    const { error } = await admin
      .from('tasks')
      .update({ author_id: manager2.id })
      .eq('id', task.id);

    expect(error?.message).toBe('IMMUTABLE_FIELD');
  });

  it('§7.2: service_role UPDATE of task created_at → IMMUTABLE_FIELD', async () => {
    const { error } = await admin
      .from('tasks')
      .update({ created_at: OLD_TIMESTAMP })
      .eq('id', task.id);

    expect(error?.message).toBe('IMMUTABLE_FIELD');
  });

  it('§7.4: service_role UPDATE of object created_by → IMMUTABLE_FIELD', async () => {
    const { error } = await admin
      .from('objects')
      .update({ created_by: manager2.id })
      .eq('id', object.id);

    expect(error?.message).toBe('IMMUTABLE_FIELD');
  });

  it('§7.2: task updated_at is set by trigger (explicit value ignored)', async () => {
    const { data, error } = await admin
      .from('tasks')
      .update({ updated_at: OLD_TIMESTAMP })
      .eq('id', task.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(utcYear((data as TaskRow).updated_at)).not.toBe(2000);
  });

  it('§7.4: object updated_at is set by trigger (explicit value ignored)', async () => {
    const { data, error } = await admin
      .from('objects')
      .update({ updated_at: OLD_TIMESTAMP })
      .eq('id', object.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(utcYear((data as ObjectRow).updated_at)).not.toBe(2000);
  });
});
