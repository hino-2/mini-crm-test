import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceTask,
  createAdminClient,
  createExecutor,
  createManager,
  createObject,
  createTask,
} from '../fixtures/fixtures';
import type {
  HistoryRow,
  ObjectRow,
  TaskActors,
  TaskRow,
  TestUser,
} from '../fixtures/fixtures.type';

async function readHistory(
  admin: SupabaseClient,
  taskIds: string[],
): Promise<HistoryRow[]> {
  const { data, error } = await admin
    .from('task_status_history')
    .select('*')
    .in('task_id', taskIds)
    .order('id', { ascending: true });

  if (error) {
    throw new Error(`readHistory failed: ${error.message}`);
  }

  return (data ?? []) as HistoryRow[];
}

let admin: SupabaseClient;
let m: TestUser;
let a: TestUser;
let actors: TaskActors;

async function taskIn(object: ObjectRow, status: 'on_review' | 'accepted'): Promise<TaskRow> {
  const task = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

  return advanceTask(actors, task.id, status);
}

beforeAll(async () => {
  admin = await createAdminClient();
  m = await createManager();
  a = await createExecutor();
  actors = { manager: m, executor: a };
});

describe('§6.2 / §7.3 / §10.1 History: authenticated cannot write', () => {
  let task: TaskRow;
  let countBefore: number;

  beforeAll(async () => {
    const object = await createObject(m.client);

    task = await taskIn(object, 'on_review');
    countBefore = (await readHistory(admin, [task.id])).length;
  });

  describe.each([
    ['manager', () => m],
    ['executor (assignee)', () => a],
  ])('%s', (_label, getActor) => {
    it('INSERT → 42501', async () => {
      const actor = getActor();
      const { error } = await actor.client.from('task_status_history').insert({
        task_id: task.id,
        from_status: 'on_review',
        to_status: 'accepted',
        changed_by: actor.id,
      });

      expect(error?.code).toBe('42501');
      expect(await readHistory(admin, [task.id])).toHaveLength(countBefore);
    });

    it('UPDATE → 42501', async () => {
      const { error } = await getActor()
        .client.from('task_status_history')
        .update({ comment: 'tamper' })
        .eq('task_id', task.id);

      expect(error?.code).toBe('42501');

      const rows = await readHistory(admin, [task.id]);

      expect(rows).toHaveLength(countBefore);
      expect(rows.every((r) => r.comment !== 'tamper')).toBe(true);
    });

    it('DELETE → 42501', async () => {
      const { error } = await getActor()
        .client.from('task_status_history')
        .delete()
        .eq('task_id', task.id);

      expect(error?.code).toBe('42501');
      expect(await readHistory(admin, [task.id])).toHaveLength(countBefore);
    });
  });

  it('§7.3 / §10.1: service_role UPDATE of a history row → IMMUTABLE_FIELD', async () => {
    const [first] = await readHistory(admin, [task.id]);

    expect(first).toBeDefined();

    const { error } = await admin
      .from('task_status_history')
      .update({ comment: 'tamper' })
      .eq('id', first.id);

    expect(error?.message).toBe('IMMUTABLE_FIELD');

    const [after] = await readHistory(admin, [task.id]);

    expect(after.comment).toBe(first.comment);
  });
});

describe('§7.3 / §12.3 / §12.4 / §10.1 History: cascade deletes', () => {
  it('§12.3: deleting a task removes its history', async () => {
    const object = await createObject(m.client);
    const task = await taskIn(object, 'on_review');

    expect((await readHistory(admin, [task.id])).length).toBeGreaterThanOrEqual(3);

    const { error } = await m.client.from('tasks').delete().eq('id', task.id);

    expect(error).toBeNull();
    expect(await readHistory(admin, [task.id])).toEqual([]);
  });

  it('§12.4: deleting an object removes its tasks (incl. accepted) and their history', async () => {
    const object = await createObject(m.client);
    const accepted = await taskIn(object, 'accepted');
    const onReview = await taskIn(object, 'on_review');
    const taskIds = [accepted.id, onReview.id];

    expect((await readHistory(admin, taskIds)).length).toBeGreaterThan(0);

    const { error } = await m.client.from('objects').delete().eq('id', object.id);

    expect(error).toBeNull();

    const tasks = await admin.from('tasks').select('id').eq('object_id', object.id);

    expect(tasks.error).toBeNull();
    expect(tasks.data).toEqual([]);
    expect(await readHistory(admin, taskIds)).toEqual([]);
  });
});
