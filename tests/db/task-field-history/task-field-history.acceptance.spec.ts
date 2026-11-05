import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceTask,
  createAdminClient,
  createAnonClient,
  createExecutor,
  createManager,
  createObject,
  createTask,
  readFieldHistory,
  readStatusHistory,
  readTaskAsAdmin,
  uniqueSuffix,
} from '../fixtures/fixtures';
import type { ObjectRow, TaskRow, TestUser } from '../fixtures/fixtures.type';

let admin: SupabaseClient;
let m: TestUser;
let a: TestUser;
let b: TestUser;
let object: ObjectRow;

async function newTask(description?: string): Promise<TaskRow> {
  return createTask(m.client, {
    objectId: object.id,
    assigneeId: a.id,
    ...(description !== undefined ? { description } : {}),
  });
}

async function patchTask(
  client: SupabaseClient,
  taskId: string,
  patch: Partial<Pick<TaskRow, 'title' | 'description' | 'assignee_id'>>,
): Promise<TaskRow[]> {
  const { data, error } = await client.from('tasks').update(patch).eq('id', taskId).select();

  if (error) {
    throw new Error(`patchTask failed: ${error.message}`);
  }

  return (data ?? []) as TaskRow[];
}

beforeAll(async () => {
  admin = await createAdminClient();
  m = await createManager();
  a = await createExecutor();
  b = await createExecutor();
  object = await createObject(m.client);
});

describe('AC7 task_field_history: nobody writes via API', () => {
  let task: TaskRow;
  let countBefore: number;

  beforeAll(async () => {
    task = await newTask();
    await patchTask(m.client, task.id, { title: `Edited ${uniqueSuffix()}` });
    countBefore = (await readFieldHistory(admin, [task.id])).length;
  });

  it('fixture: one field-history row exists', () => {
    expect(countBefore).toBe(1);
  });

  describe.each([
    ['manager', () => m],
    ['executor (assignee)', () => a],
  ])('%s', (_label, getActor) => {
    it('AC7: INSERT → 42501', async () => {
      const actor = getActor();
      const { error } = await actor.client.from('task_field_history').insert({
        task_id: task.id,
        field: 'title',
        old_value: 'forged old',
        new_value: 'forged new',
        changed_by: actor.id,
      });

      expect(error?.code).toBe('42501');
      expect(await readFieldHistory(admin, [task.id])).toHaveLength(countBefore);
    });

    it('AC7: UPDATE → 42501', async () => {
      const { error } = await getActor()
        .client.from('task_field_history')
        .update({ new_value: 'tamper' })
        .eq('task_id', task.id);

      expect(error?.code).toBe('42501');
      expect(
        (await readFieldHistory(admin, [task.id])).every((r) => r.new_value !== 'tamper'),
      ).toBe(true);
    });

    it('AC7: DELETE → 42501', async () => {
      const { error } = await getActor()
        .client.from('task_field_history')
        .delete()
        .eq('task_id', task.id);

      expect(error?.code).toBe('42501');
      expect(await readFieldHistory(admin, [task.id])).toHaveLength(countBefore);
    });
  });

  it('§3.2: anon SELECT → 42501', async () => {
    const anon = await createAnonClient();
    const { error } = await anon.from('task_field_history').select('*');

    expect(error?.code).toBe('42501');
  });

  it('AC7: service_role UPDATE of a row → IMMUTABLE_FIELD, row unchanged', async () => {
    const [first] = await readFieldHistory(admin, [task.id]);

    expect(first).toBeDefined();

    const { error } = await admin
      .from('task_field_history')
      .update({ new_value: 'tamper' })
      .eq('id', first.id);

    expect(error?.message).toBe('IMMUTABLE_FIELD');

    const [after] = await readFieldHistory(admin, [task.id]);

    expect(after.new_value).toBe(first.new_value);
  });
});

describe('AC7 task_field_history: trigger writes one row per real change', () => {
  it("title edit → exactly one row {field 'title', old, new, changed_by manager}", async () => {
    const task = await newTask();
    const title = `New title ${uniqueSuffix()}`;

    await patchTask(m.client, task.id, { title });

    const rows = await readFieldHistory(admin, [task.id]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      task_id: task.id,
      field: 'title',
      old_value: task.title,
      new_value: title,
      changed_by: m.id,
    });
    expect(typeof rows[0].changed_at).toBe('string');
  });

  it("description '' → 'x' → row with old '' and new 'x'", async () => {
    const task = await newTask();

    expect(task.description).toBe('');

    await patchTask(m.client, task.id, { description: 'x' });

    const rows = await readFieldHistory(admin, [task.id]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      field: 'description',
      old_value: '',
      new_value: 'x',
      changed_by: m.id,
    });
  });

  it("reassign A → B → {field 'assignee_id', old A.id, new B.id}; status history unchanged", async () => {
    const task = await newTask();
    const statusCountBefore = (await readStatusHistory(admin, [task.id])).length;

    await patchTask(m.client, task.id, { assignee_id: b.id });

    const rows = await readFieldHistory(admin, [task.id]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      field: 'assignee_id',
      old_value: a.id,
      new_value: b.id,
      changed_by: m.id,
    });
    expect(await readStatusHistory(admin, [task.id])).toHaveLength(statusCountBefore);
  });

  it('one PATCH of title + description + assignee → 3 rows in order title, description, assignee_id with the same changed_at', async () => {
    const task = await newTask('old description');
    const title = `Multi ${uniqueSuffix()}`;

    await patchTask(m.client, task.id, { title, description: 'new description', assignee_id: b.id });

    const rows = await readFieldHistory(admin, [task.id]);

    expect(rows.map((r) => [r.field, r.old_value, r.new_value])).toEqual([
      ['title', task.title, title],
      ['description', 'old description', 'new description'],
      ['assignee_id', a.id, b.id],
    ]);
    expect(rows[0].id).toBeLessThan(rows[1].id);
    expect(rows[1].id).toBeLessThan(rows[2].id);
    expect(new Set(rows.map((r) => r.changed_at)).size).toBe(1);
  });

  it('PATCH with the same values → 0 rows', async () => {
    const task = await newTask('same');
    const updated = await patchTask(m.client, task.id, {
      title: task.title,
      description: task.description,
      assignee_id: task.assignee_id,
    });

    expect(updated).toHaveLength(1);
    expect(await readFieldHistory(admin, [task.id])).toEqual([]);
  });

  it('task creation → 0 rows', async () => {
    const task = await newTask('created');

    expect(await readFieldHistory(admin, [task.id])).toEqual([]);
  });

  it('change_task_status → 0 rows', async () => {
    const task = await newTask();
    const { error } = await a.client.rpc('change_task_status', {
      p_task_id: task.id,
      p_to_status: 'in_progress',
    });

    expect(error).toBeNull();
    expect(await readFieldHistory(admin, [task.id])).toEqual([]);
  });
});

describe('AC6 accepted task is editable', () => {
  let accepted: TaskRow;
  let updated: TaskRow[];

  beforeAll(async () => {
    const created = await newTask('before');

    accepted = await advanceTask({ manager: m, executor: a }, created.id, 'accepted');
    updated = await patchTask(m.client, accepted.id, {
      title: `Accepted edit ${uniqueSuffix()}`,
      description: 'after',
      assignee_id: b.id,
    });
  });

  it('AC6: manager edit of title/description/assignee succeeds, status stays accepted', async () => {
    expect(updated).toHaveLength(1);
    expect(updated[0].status).toBe('accepted');
    expect(updated[0].description).toBe('after');
    expect(updated[0].assignee_id).toBe(b.id);

    const stored = await readTaskAsAdmin(admin, accepted.id);

    expect(stored?.status).toBe('accepted');
    expect(stored?.title).toBe(updated[0].title);
  });

  it('AC7: the edit is recorded in field history', async () => {
    const rows = await readFieldHistory(admin, [accepted.id]);

    expect(rows.map((r) => r.field)).toEqual(['title', 'description', 'assignee_id']);
    expect(rows.every((r) => r.changed_by === m.id)).toBe(true);
  });

  it('§5.7: transitions from accepted are still INVALID_TRANSITION', async () => {
    const byManager = await m.client.rpc('change_task_status', {
      p_task_id: accepted.id,
      p_to_status: 'rework',
      p_comment: 'again',
    });
    const byAssignee = await b.client.rpc('change_task_status', {
      p_task_id: accepted.id,
      p_to_status: 'in_progress',
    });

    expect(byManager.error?.message).toBe('INVALID_TRANSITION');
    expect(byAssignee.error?.message).toBe('INVALID_TRANSITION');
    expect((await readTaskAsAdmin(admin, accepted.id))?.status).toBe('accepted');
  });
});

describe('AC7 task_field_history: visibility = status history visibility', () => {
  let task: TaskRow;

  beforeAll(async () => {
    task = await newTask();
    await patchTask(m.client, task.id, { title: `Visible ${uniqueSuffix()}` });
  });

  it('assignee sees the rows', async () => {
    expect(await readFieldHistory(a.client, [task.id])).toHaveLength(1);
  });

  it('other executor sees []', async () => {
    expect(await readFieldHistory(b.client, [task.id])).toEqual([]);
  });

  it('manager sees the rows', async () => {
    expect(await readFieldHistory(m.client, [task.id])).toHaveLength(1);
  });

  it('old assignee after reassignment sees []; new assignee sees all rows', async () => {
    const other = await newTask();

    await patchTask(m.client, other.id, { title: `Before move ${uniqueSuffix()}` });
    await patchTask(m.client, other.id, { assignee_id: b.id });

    expect(await readFieldHistory(a.client, [other.id])).toEqual([]);
    expect(await readFieldHistory(b.client, [other.id])).toHaveLength(2);
  });
});

describe('§2.9 service_role edits', () => {
  it('service_role title edit → row with changed_by null', async () => {
    const task = await newTask();
    const title = `Svc ${uniqueSuffix()}`;
    const { error } = await admin.from('tasks').update({ title }).eq('id', task.id);

    expect(error).toBeNull();

    const rows = await readFieldHistory(admin, [task.id]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      field: 'title',
      old_value: task.title,
      new_value: title,
      changed_by: null,
    });
  });
});

describe('AC5 object_id is immutable after creation', () => {
  let task: TaskRow;
  let otherObject: ObjectRow;

  beforeAll(async () => {
    task = await newTask();
    otherObject = await createObject(m.client);
  });

  it('AC5: manager PATCH {object_id} → 42501, object_id unchanged', async () => {
    const { error } = await m.client
      .from('tasks')
      .update({ object_id: otherObject.id })
      .eq('id', task.id);

    expect(error?.code).toBe('42501');
    expect((await readTaskAsAdmin(admin, task.id))?.object_id).toBe(object.id);
  });

  it('AC5: service_role change of object_id → IMMUTABLE_FIELD, object_id unchanged', async () => {
    const { error } = await admin
      .from('tasks')
      .update({ object_id: otherObject.id })
      .eq('id', task.id);

    expect(error?.message).toBe('IMMUTABLE_FIELD');
    expect((await readTaskAsAdmin(admin, task.id))?.object_id).toBe(object.id);
  });
});
