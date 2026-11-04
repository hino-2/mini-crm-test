import { beforeAll, describe, expect, it } from 'vitest';
import {
  createExecutor,
  createManager,
  createObject,
  createTask,
} from '../fixtures/fixtures';
import type {
  HistoryRow,
  ObjectRow,
  TaskRow,
  TestUser,
} from '../fixtures/fixtures.type';

describe('§6.2 / §10.1 Visibility', () => {
  let m1: TestUser;
  let m2: TestUser;
  let a: TestUser;
  let b: TestUser;
  let o1: ObjectRow;
  let o2: ObjectRow;
  let o3: ObjectRow;
  let taskA: TaskRow;
  let taskB: TaskRow;
  let taskB2: TaskRow;

  beforeAll(async () => {
    m1 = await createManager();
    m2 = await createManager();
    a = await createExecutor();
    b = await createExecutor();
    o1 = await createObject(m1.client);
    o2 = await createObject(m1.client);
    o3 = await createObject(m1.client);
    taskA = await createTask(m1.client, { objectId: o1.id, assigneeId: a.id });
    taskB = await createTask(m1.client, { objectId: o1.id, assigneeId: b.id });
    taskB2 = await createTask(m1.client, { objectId: o2.id, assigneeId: b.id });
  });

  describe('executor A', () => {
    it('§10.1: sees only own tasks (unfiltered select)', async () => {
      const { data, error } = await a.client.from('tasks').select('*');

      expect(error).toBeNull();

      const rows = (data ?? []) as TaskRow[];

      expect(rows.map((r) => r.id)).toContain(taskA.id);

      for (const row of rows) {
        expect(row.assignee_id).toBe(a.id);
      }
    });

    it('§10.1: task of B in the same object is not visible (select by id → empty, no error)', async () => {
      const { data, error } = await a.client.from('tasks').select('*').eq('id', taskB.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('§10.1: sees exactly the objects where he has a task', async () => {
      const { data, error } = await a.client.from('objects').select('*');

      expect(error).toBeNull();
      expect(((data ?? []) as ObjectRow[]).map((r) => r.id)).toEqual([o1.id]);
    });

    it.each([
      ['O2 (only B tasks)', () => o2.id],
      ['O3 (no tasks)', () => o3.id],
    ])('§10.1: object %s is not visible (select by id → empty)', async (_label, getId) => {
      const { data, error } = await a.client.from('objects').select('*').eq('id', getId());

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('§10.1: history of a foreign task is not visible', async () => {
      const { data, error } = await a.client
        .from('task_status_history')
        .select('*')
        .eq('task_id', taskB.id);

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('§6.2: history of own task is visible (creation row null → new)', async () => {
      const { data, error } = await a.client
        .from('task_status_history')
        .select('*')
        .eq('task_id', taskA.id)
        .order('id', { ascending: true });

      expect(error).toBeNull();

      const rows = (data ?? []) as HistoryRow[];

      expect(rows).toHaveLength(1);
      expect(rows[0].from_status).toBeNull();
      expect(rows[0].to_status).toBe('new');
    });
  });

  describe('executor B', () => {
    it('§6.2: sees exactly own tasks taskB and taskB2', async () => {
      const { data, error } = await b.client.from('tasks').select('*');

      expect(error).toBeNull();
      expect(((data ?? []) as TaskRow[]).map((r) => r.id).sort()).toEqual(
        [taskB.id, taskB2.id].sort(),
      );
    });

    it('§6.2: sees exactly objects O1 and O2', async () => {
      const { data, error } = await b.client.from('objects').select('*');

      expect(error).toBeNull();
      expect(((data ?? []) as ObjectRow[]).map((r) => r.id).sort()).toEqual(
        [o1.id, o2.id].sort(),
      );
    });
  });

  describe.each([
    ['M1 (author)', () => m1],
    ['M2 (other manager)', () => m2],
  ])('manager %s sees everything', (_label, getManager) => {
    it('§10.1: sees all 3 tasks', async () => {
      const ids = [taskA.id, taskB.id, taskB2.id];
      const { data, error } = await getManager().client.from('tasks').select('*').in('id', ids);

      expect(error).toBeNull();
      expect(((data ?? []) as TaskRow[]).map((r) => r.id).sort()).toEqual([...ids].sort());
    });

    it('§10.1 / §12.7: sees all 3 objects including the one without tasks', async () => {
      const ids = [o1.id, o2.id, o3.id];
      const { data, error } = await getManager().client.from('objects').select('*').in('id', ids);

      expect(error).toBeNull();
      expect(((data ?? []) as ObjectRow[]).map((r) => r.id).sort()).toEqual([...ids].sort());
    });

    it('§6.2: sees history of every task', async () => {
      const ids = [taskA.id, taskB.id, taskB2.id];
      const { data, error } = await getManager()
        .client.from('task_status_history')
        .select('*')
        .in('task_id', ids);

      expect(error).toBeNull();

      const seen = new Set(((data ?? []) as HistoryRow[]).map((r) => r.task_id));

      expect([...seen].sort()).toEqual([...ids].sort());
    });
  });
});
