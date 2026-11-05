import { randomUUID } from 'node:crypto';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  advanceTask,
  callTrashRpc,
  createAdminClient,
  createAnonClient,
  createExecutor,
  createManager,
  createObject,
  createTask,
  readFieldHistory,
  readFullName,
  readObjectAsAdmin,
  readStatusHistory,
  readTaskAsAdmin,
  trashRpc,
  uniqueSuffix,
} from '../fixtures/fixtures';
import type {
  DeletedObjectRow,
  DeletedTaskRow,
  ObjectRow,
  RpcRawResult,
  TaskRow,
  TaskStatus,
  TestUser,
} from '../fixtures/fixtures.type';

type IdRow = { id: string };
type ObjectWithTaskCount = { id: string; tasks: Array<{ count: number }> };

async function visibleIds(
  client: SupabaseClient,
  table: 'objects' | 'tasks',
  column: 'id' | 'object_id',
  value: string,
): Promise<string[]> {
  const { data, error } = await client.from(table).select('id').eq(column, value);

  if (error) {
    throw new Error(`visibleIds failed: ${error.message}`);
  }

  return ((data ?? []) as IdRow[]).map((r) => r.id);
}

async function changeStatus(
  client: SupabaseClient,
  taskId: string,
  to: TaskStatus,
  comment?: string,
): Promise<PostgrestError | null> {
  const { error } = await client.rpc('change_task_status', {
    p_task_id: taskId,
    p_to_status: to,
    ...(comment !== undefined ? { p_comment: comment } : {}),
  });

  return error;
}

async function listDeletedObjects(
  client: SupabaseClient,
): Promise<{ data: DeletedObjectRow[] | null; error: PostgrestError | null }> {
  const { data, error } = await client.rpc('list_deleted_objects');

  return { data: data as DeletedObjectRow[] | null, error };
}

async function listDeletedTasks(
  client: SupabaseClient,
): Promise<{ data: DeletedTaskRow[] | null; error: PostgrestError | null }> {
  const { data, error } = await client.rpc('list_deleted_tasks');

  return { data: data as DeletedTaskRow[] | null, error };
}

let admin: SupabaseClient;
let m: TestUser;
let a: TestUser;
let b: TestUser;

beforeAll(async () => {
  admin = await createAdminClient();
  m = await createManager();
  a = await createExecutor();
  b = await createExecutor();
});

describe('AC1 Soft delete: hard DELETE and deleted_* columns are closed to authenticated', () => {
  let object: ObjectRow;
  let task: TaskRow;

  beforeAll(async () => {
    object = await createObject(m.client);
    task = await createTask(m.client, { objectId: object.id, assigneeId: a.id });
  });

  describe.each([
    ['manager', () => m],
    ['executor (assignee)', () => a],
  ])('%s', (_label, getActor) => {
    it('AC1: DELETE from objects → 42501, object remains', async () => {
      const { error } = await getActor().client.from('objects').delete().eq('id', object.id);

      expect(error?.code).toBe('42501');
      expect(await readObjectAsAdmin(admin, object.id)).not.toBeNull();
    });

    it('AC1: DELETE from tasks → 42501, task remains', async () => {
      const { error } = await getActor().client.from('tasks').delete().eq('id', task.id);

      expect(error?.code).toBe('42501');
      expect(await readTaskAsAdmin(admin, task.id)).not.toBeNull();
    });
  });

  it.each([
    ['tasks', 'deleted_at'],
    ['tasks', 'deleted_by'],
    ['objects', 'deleted_at'],
    ['objects', 'deleted_by'],
  ] as Array<['tasks' | 'objects', 'deleted_at' | 'deleted_by']>)(
    '§3.1: manager PATCH of %s.%s → 42501, row not deleted',
    async (table, column) => {
      const id = table === 'tasks' ? task.id : object.id;
      const value = column === 'deleted_at' ? new Date().toISOString() : m.id;
      const { error } = await m.client
        .from(table)
        .update({ [column]: value })
        .eq('id', id);

      expect(error?.code).toBe('42501');

      const row =
        table === 'tasks' ? await readTaskAsAdmin(admin, id) : await readObjectAsAdmin(admin, id);

      expect(row?.deleted_at).toBeNull();
      expect(row?.deleted_by).toBeNull();
    },
  );

  it('§3.1: manager INSERT of a task with deleted_at → 42501, no task created', async () => {
    const title = `Deleted insert ${uniqueSuffix()}`;
    const { error } = await m.client.from('tasks').insert({
      object_id: object.id,
      title,
      assignee_id: a.id,
      deleted_at: new Date().toISOString(),
    });

    expect(error?.code).toBe('42501');

    const { data, error: readError } = await admin.from('tasks').select('id').eq('title', title);

    expect(readError).toBeNull();
    expect(data).toEqual([]);
  });

  it('§3.1: manager INSERT of an object with deleted_at → 42501', async () => {
    const { error } = await m.client.from('objects').insert({
      name: `Deleted insert ${uniqueSuffix()}`,
      address: 'Address',
      deleted_at: new Date().toISOString(),
    });

    expect(error?.code).toBe('42501');
  });
});

describe('AC2 / AC3 soft_delete_task', () => {
  let object: ObjectRow;
  let task: TaskRow;
  let other: TaskRow;
  let result: RpcRawResult;

  beforeAll(async () => {
    object = await createObject(m.client);

    const created = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

    task = await advanceTask({ manager: m, executor: a }, created.id, 'in_progress');
    other = await createTask(m.client, { objectId: object.id, assigneeId: b.id });
    result = await callTrashRpc(m.client, 'soft_delete_task', task.id);
  });

  it('§3.1: manager call succeeds (error null, data null)', () => {
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it('§3.1: row still exists for admin with deleted_at set, deleted_by = manager, status unchanged', async () => {
    const stored = await readTaskAsAdmin(admin, task.id);

    expect(stored).not.toBeNull();
    expect(stored?.deleted_at).not.toBeNull();
    expect(stored?.deleted_by).toBe(m.id);
    expect(stored?.status).toBe('in_progress');
  });

  it.each([
    ['manager', () => m],
    ['assignee', () => a],
  ])('AC2: %s no longer sees the task by id', async (_label, getActor) => {
    expect(await visibleIds(getActor().client, 'tasks', 'id', task.id)).toEqual([]);
  });

  it.each([
    ['manager', () => m],
    ['assignee', () => a],
  ])('AC2: %s sees no status or field history of the task', async (_label, getActor) => {
    const client = getActor().client;

    expect(await readStatusHistory(client, [task.id])).toEqual([]);
    expect(await readFieldHistory(client, [task.id])).toEqual([]);
  });

  it('AC2: admin still sees status history and field history of the task', async () => {
    expect((await readStatusHistory(admin, [task.id])).length).toBeGreaterThanOrEqual(2);
    expect((await readFieldHistory(admin, [task.id])).length).toBeGreaterThan(0);
  });

  it("§2.7 / AC7: field history has one row {field 'deleted_at', old null, new not null, changed_by manager}", async () => {
    const rows = await readFieldHistory(admin, [task.id]);

    expect(rows).toHaveLength(1);
    expect(rows[0].field).toBe('deleted_at');
    expect(rows[0].old_value).toBeNull();
    expect(rows[0].new_value).not.toBeNull();
    expect(rows[0].changed_by).toBe(m.id);
  });

  it('§2.10: repeated soft_delete_task → TASK_NOT_FOUND', async () => {
    const { error } = await callTrashRpc(m.client, 'soft_delete_task', task.id);

    expect(error?.message).toBe('TASK_NOT_FOUND');
  });

  it('§3.1: random uuid → TASK_NOT_FOUND', async () => {
    const { error } = await callTrashRpc(m.client, 'soft_delete_task', randomUUID());

    expect(error?.message).toBe('TASK_NOT_FOUND');
  });

  it('§2.10: executor (assignee) → NOT_ALLOWED, task stays active', async () => {
    const { error } = await callTrashRpc(b.client, 'soft_delete_task', other.id);

    expect(error?.message).toBe('NOT_ALLOWED');
    expect((await readTaskAsAdmin(admin, other.id))?.deleted_at).toBeNull();
  });

  it('§3.1: anon → error (not NOT_AUTHENTICATED), task stays active', async () => {
    const anon = await createAnonClient();
    const { error } = await callTrashRpc(anon, 'soft_delete_task', other.id);

    expect(error).not.toBeNull();
    expect(error?.message).not.toBe('NOT_AUTHENTICATED');
    expect((await readTaskAsAdmin(admin, other.id))?.deleted_at).toBeNull();
  });

  it('AC3: change_task_status on the deleted task by assignee and manager → TASK_NOT_FOUND, status unchanged', async () => {
    expect((await changeStatus(a.client, task.id, 'on_review'))?.message).toBe('TASK_NOT_FOUND');
    expect((await changeStatus(m.client, task.id, 'accepted'))?.message).toBe('TASK_NOT_FOUND');
    expect((await readTaskAsAdmin(admin, task.id))?.status).toBe('in_progress');
  });

  it('AC3: manager PATCH title of the deleted task → no error, 0 rows, title unchanged', async () => {
    const { data, error } = await m.client
      .from('tasks')
      .update({ title: `Ghost edit ${uniqueSuffix()}` })
      .eq('id', task.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readTaskAsAdmin(admin, task.id))?.title).toBe(task.title);
  });

  it('AC2: executor whose only task in the object was deleted no longer sees the object', async () => {
    expect(await visibleIds(a.client, 'objects', 'id', object.id)).toEqual([]);
    expect(await visibleIds(b.client, 'objects', 'id', object.id)).toEqual([object.id]);
  });

  it('AC2: manager tasks(count) embed excludes the deleted task', async () => {
    const { data, error } = await m.client
      .from('objects')
      .select('id, tasks(count)')
      .eq('id', object.id);

    expect(error).toBeNull();
    expect(data as ObjectWithTaskCount[]).toEqual([{ id: object.id, tasks: [{ count: 1 }] }]);
  });

  it('§2.10: an accepted task can be soft-deleted', async () => {
    const acceptedObject = await createObject(m.client);
    const created = await createTask(m.client, { objectId: acceptedObject.id, assigneeId: a.id });
    const accepted = await advanceTask({ manager: m, executor: a }, created.id, 'accepted');
    const { error } = await callTrashRpc(m.client, 'soft_delete_task', accepted.id);

    expect(error).toBeNull();

    const stored = await readTaskAsAdmin(admin, accepted.id);

    expect(stored?.deleted_at).not.toBeNull();
    expect(stored?.status).toBe('accepted');
  });
});

describe('AC2 / AC3 soft_delete_object', () => {
  let object: ObjectRow;
  let t1: TaskRow;
  let t2: TaskRow;
  let result: RpcRawResult;

  beforeAll(async () => {
    object = await createObject(m.client);

    const created = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

    t1 = await advanceTask({ manager: m, executor: a }, created.id, 'in_progress');
    t2 = await createTask(m.client, { objectId: object.id, assigneeId: b.id });
    result = await callTrashRpc(m.client, 'soft_delete_object', object.id);
  });

  it('§3.1: manager call succeeds (error null, data null)', () => {
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();
  });

  it('§2.3: admin sees deleted_at/deleted_by on the object; its tasks keep deleted_at null', async () => {
    const stored = await readObjectAsAdmin(admin, object.id);

    expect(stored?.deleted_at).not.toBeNull();
    expect(stored?.deleted_by).toBe(m.id);
    expect((await readTaskAsAdmin(admin, t1.id))?.deleted_at).toBeNull();
    expect((await readTaskAsAdmin(admin, t2.id))?.deleted_at).toBeNull();
  });

  it.each([
    ['manager', () => m],
    ['executor A (assignee of t1)', () => a],
    ['executor B (assignee of t2)', () => b],
  ])('AC2: %s sees neither the object, its tasks, nor their history', async (_label, getActor) => {
    const client = getActor().client;

    expect(await visibleIds(client, 'objects', 'id', object.id)).toEqual([]);
    expect(await visibleIds(client, 'tasks', 'object_id', object.id)).toEqual([]);
    expect(await readStatusHistory(client, [t1.id, t2.id])).toEqual([]);
    expect(await readFieldHistory(client, [t1.id, t2.id])).toEqual([]);
  });

  it('AC3: change_task_status on a task of the deleted object → TASK_NOT_FOUND', async () => {
    expect((await changeStatus(a.client, t1.id, 'on_review'))?.message).toBe('TASK_NOT_FOUND');
    expect((await readTaskAsAdmin(admin, t1.id))?.status).toBe('in_progress');
  });

  it('§3.1: soft_delete_task on a task of the deleted object → TASK_NOT_FOUND, task untouched', async () => {
    const { error } = await callTrashRpc(m.client, 'soft_delete_task', t1.id);

    expect(error?.message).toBe('TASK_NOT_FOUND');
    expect((await readTaskAsAdmin(admin, t1.id))?.deleted_at).toBeNull();
  });

  it('AC3: manager PATCH of its task → 0 rows, task unchanged', async () => {
    const { data, error } = await m.client
      .from('tasks')
      .update({ title: `Ghost ${uniqueSuffix()}` })
      .eq('id', t2.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readTaskAsAdmin(admin, t2.id))?.title).toBe(t2.title);
  });

  it('§3.1: manager PATCH of the deleted object → 0 rows, object unchanged', async () => {
    const { data, error } = await m.client
      .from('objects')
      .update({ name: `Ghost ${uniqueSuffix()}` })
      .eq('id', object.id)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect((await readObjectAsAdmin(admin, object.id))?.name).toBe(object.name);
  });

  it('§3.1: manager INSERT of a task into the deleted object → OBJECT_DELETED, nothing created', async () => {
    const title = `Into trash ${uniqueSuffix()}`;
    const { error } = await m.client
      .from('tasks')
      .insert({ object_id: object.id, title, assignee_id: a.id });

    expect(error?.message).toBe('OBJECT_DELETED');

    const { data, error: readError } = await admin.from('tasks').select('id').eq('title', title);

    expect(readError).toBeNull();
    expect(data).toEqual([]);
  });

  it('§2.8: object deletion writes no field-history rows for its tasks', async () => {
    expect(await readFieldHistory(admin, [t1.id, t2.id])).toEqual([]);
  });

  it('§2.10: repeated soft_delete_object → OBJECT_NOT_FOUND', async () => {
    const { error } = await callTrashRpc(m.client, 'soft_delete_object', object.id);

    expect(error?.message).toBe('OBJECT_NOT_FOUND');
  });

  it('§3.1: random uuid → OBJECT_NOT_FOUND', async () => {
    const { error } = await callTrashRpc(m.client, 'soft_delete_object', randomUUID());

    expect(error?.message).toBe('OBJECT_NOT_FOUND');
  });

  it('§2.10: executor → NOT_ALLOWED, object stays active', async () => {
    const active = await createObject(m.client);

    await createTask(m.client, { objectId: active.id, assigneeId: a.id });

    const { error } = await callTrashRpc(a.client, 'soft_delete_object', active.id);

    expect(error?.message).toBe('NOT_ALLOWED');
    expect((await readObjectAsAdmin(admin, active.id))?.deleted_at).toBeNull();
  });
});

describe('AC4 Trash lists', () => {
  let managerName: string;
  let deletedObject: ObjectRow;
  let activeObject: ObjectRow;
  let hiddenByObject: TaskRow;
  let individuallyDeletedInDeletedObject: TaskRow;
  let deletedInActiveObject: TaskRow;
  let activeTask: TaskRow;
  let systemDeletedObject: ObjectRow;

  beforeAll(async () => {
    managerName = await readFullName(admin, m.id);
    deletedObject = await createObject(m.client);
    activeObject = await createObject(m.client);
    hiddenByObject = await createTask(m.client, { objectId: deletedObject.id, assigneeId: a.id });
    individuallyDeletedInDeletedObject = await createTask(m.client, {
      objectId: deletedObject.id,
      assigneeId: a.id,
    });
    deletedInActiveObject = await createTask(m.client, {
      objectId: activeObject.id,
      assigneeId: a.id,
    });
    activeTask = await createTask(m.client, { objectId: activeObject.id, assigneeId: a.id });
    await trashRpc(m, 'soft_delete_task', individuallyDeletedInDeletedObject.id);
    await trashRpc(m, 'soft_delete_task', deletedInActiveObject.id);
    await trashRpc(m, 'soft_delete_object', deletedObject.id);
    systemDeletedObject = await createObject(m.client);

    const { error } = await admin
      .from('objects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', systemDeletedObject.id);

    if (error) {
      throw new Error(`system delete failed: ${error.message}`);
    }
  });

  it('§3.1: list_deleted_objects (manager) returns the deleted object with exact columns', async () => {
    const { data, error } = await listDeletedObjects(m.client);

    expect(error).toBeNull();
    expect((data ?? []).find((r) => r.id === deletedObject.id)).toEqual({
      id: deletedObject.id,
      name: deletedObject.name,
      address: deletedObject.address,
      deleted_at: expect.any(String),
      deleted_by_name: managerName,
    });
  });

  it('§3.1: list_deleted_objects excludes active objects', async () => {
    const { data } = await listDeletedObjects(m.client);
    const ids = (data ?? []).map((r) => r.id);

    expect(ids).not.toContain(activeObject.id);
  });

  it('§3.1: deleted_by_name is null when deleted_by is null', async () => {
    const { data } = await listDeletedObjects(m.client);

    expect((data ?? []).find((r) => r.id === systemDeletedObject.id)?.deleted_by_name).toBeNull();
  });

  it('§3.1: list_deleted_tasks (manager) returns individually deleted tasks with exact columns', async () => {
    const { data, error } = await listDeletedTasks(m.client);
    const rows = data ?? [];

    expect(error).toBeNull();
    expect(rows.find((r) => r.id === deletedInActiveObject.id)).toEqual({
      id: deletedInActiveObject.id,
      title: deletedInActiveObject.title,
      object_id: activeObject.id,
      object_name: activeObject.name,
      object_deleted: false,
      deleted_at: expect.any(String),
      deleted_by_name: managerName,
    });
    expect(rows.find((r) => r.id === individuallyDeletedInDeletedObject.id)).toEqual({
      id: individuallyDeletedInDeletedObject.id,
      title: individuallyDeletedInDeletedObject.title,
      object_id: deletedObject.id,
      object_name: deletedObject.name,
      object_deleted: true,
      deleted_at: expect.any(String),
      deleted_by_name: managerName,
    });
  });

  it('§2.6: list_deleted_tasks excludes active tasks and tasks hidden only through their object', async () => {
    const { data } = await listDeletedTasks(m.client);
    const ids = (data ?? []).map((r) => r.id);

    expect(ids).not.toContain(activeTask.id);
    expect(ids).not.toContain(hiddenByObject.id);
  });

  it('§3.1: list_deleted_tasks is ordered by deleted_at desc (later deletion first)', async () => {
    const { data } = await listDeletedTasks(m.client);
    const ids = (data ?? []).map((r) => r.id);
    const later = ids.indexOf(deletedInActiveObject.id);
    const earlier = ids.indexOf(individuallyDeletedInDeletedObject.id);

    expect(later).toBeGreaterThanOrEqual(0);
    expect(earlier).toBeGreaterThan(later);
  });

  it('AC4: executor gets [] from both lists without error', async () => {
    const objects = await listDeletedObjects(a.client);
    const tasks = await listDeletedTasks(a.client);

    expect(objects.error).toBeNull();
    expect(objects.data).toEqual([]);
    expect(tasks.error).toBeNull();
    expect(tasks.data).toEqual([]);
  });

  it('§3.1: anon gets an error from both lists', async () => {
    const anon = await createAnonClient();

    expect((await listDeletedObjects(anon)).error).not.toBeNull();
    expect((await listDeletedTasks(anon)).error).not.toBeNull();
  });
});

describe('AC4 restore_task', () => {
  let task: TaskRow;
  let result: RpcRawResult;

  beforeAll(async () => {
    const object = await createObject(m.client);
    const created = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

    task = await advanceTask({ manager: m, executor: a }, created.id, 'in_progress');
    await trashRpc(m, 'soft_delete_task', task.id);
    result = await callTrashRpc(m.client, 'restore_task', task.id);
  });

  it('§3.1: manager call succeeds and clears deleted_at/deleted_by', async () => {
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();

    const stored = await readTaskAsAdmin(admin, task.id);

    expect(stored?.deleted_at).toBeNull();
    expect(stored?.deleted_by).toBeNull();
  });

  it.each([
    ['manager', () => m],
    ['assignee', () => a],
  ])('AC4: task and its history are visible again to %s', async (_label, getActor) => {
    const client = getActor().client;

    expect(await visibleIds(client, 'tasks', 'id', task.id)).toEqual([task.id]);
    expect((await readStatusHistory(client, [task.id])).length).toBeGreaterThanOrEqual(2);
    expect(await readFieldHistory(client, [task.id])).toHaveLength(2);
  });

  it("§2.7: history has both 'deleted_at' rows (deleted: null → ts; restored: ts → null)", async () => {
    const rows = await readFieldHistory(admin, [task.id]);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.field)).toEqual(['deleted_at', 'deleted_at']);
    expect(rows[0].old_value).toBeNull();
    expect(rows[0].new_value).not.toBeNull();
    expect(rows[1].old_value).not.toBeNull();
    expect(rows[1].new_value).toBeNull();
    expect(rows.map((r) => r.changed_by)).toEqual([m.id, m.id]);
  });

  it('AC4: edits and transitions work after restore', async () => {
    const title = `Restored ${uniqueSuffix()}`;
    const { data, error } = await m.client
      .from('tasks')
      .update({ title })
      .eq('id', task.id)
      .select();

    expect(error).toBeNull();
    expect(((data ?? []) as TaskRow[]).map((r) => r.title)).toEqual([title]);
    expect(await changeStatus(a.client, task.id, 'on_review')).toBeNull();
    expect((await readTaskAsAdmin(admin, task.id))?.status).toBe('on_review');
  });

  it('§2.10: restore_task on an active task → TASK_NOT_FOUND', async () => {
    const { error } = await callTrashRpc(m.client, 'restore_task', task.id);

    expect(error?.message).toBe('TASK_NOT_FOUND');
  });

  it('§3.1: restore_task on a random uuid → TASK_NOT_FOUND', async () => {
    const { error } = await callTrashRpc(m.client, 'restore_task', randomUUID());

    expect(error?.message).toBe('TASK_NOT_FOUND');
  });

  it('§2.10: executor → NOT_ALLOWED, task stays deleted', async () => {
    const object = await createObject(m.client);
    const deleted = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

    await trashRpc(m, 'soft_delete_task', deleted.id);

    const { error } = await callTrashRpc(a.client, 'restore_task', deleted.id);

    expect(error?.message).toBe('NOT_ALLOWED');
    expect((await readTaskAsAdmin(admin, deleted.id))?.deleted_at).not.toBeNull();
  });

  it('§2.6: restore_task while its object is deleted → OBJECT_DELETED, task stays deleted', async () => {
    const object = await createObject(m.client);
    const deleted = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

    await trashRpc(m, 'soft_delete_task', deleted.id);
    await trashRpc(m, 'soft_delete_object', object.id);

    const { error } = await callTrashRpc(m.client, 'restore_task', deleted.id);

    expect(error?.message).toBe('OBJECT_DELETED');
    expect((await readTaskAsAdmin(admin, deleted.id))?.deleted_at).not.toBeNull();
  });
});

describe('AC4 restore_object', () => {
  let object: ObjectRow;
  let kept: TaskRow;
  let individuallyDeleted: TaskRow;
  let result: RpcRawResult;

  beforeAll(async () => {
    object = await createObject(m.client);
    kept = await createTask(m.client, { objectId: object.id, assigneeId: a.id });
    individuallyDeleted = await createTask(m.client, { objectId: object.id, assigneeId: a.id });
    await trashRpc(m, 'soft_delete_task', individuallyDeleted.id);
    await trashRpc(m, 'soft_delete_object', object.id);
    result = await callTrashRpc(m.client, 'restore_object', object.id);
  });

  it('§3.1: manager call succeeds and clears deleted_at/deleted_by', async () => {
    expect(result.error).toBeNull();
    expect(result.data).toBeNull();

    const stored = await readObjectAsAdmin(admin, object.id);

    expect(stored?.deleted_at).toBeNull();
    expect(stored?.deleted_by).toBeNull();
  });

  it.each([
    ['manager', () => m],
    ['assignee', () => a],
  ])(
    'AC4: %s sees the object and its not-individually-deleted task again; the individually deleted one stays hidden',
    async (_label, getActor) => {
      const client = getActor().client;

      expect(await visibleIds(client, 'objects', 'id', object.id)).toEqual([object.id]);
      expect(await visibleIds(client, 'tasks', 'object_id', object.id)).toEqual([kept.id]);
      expect(await visibleIds(client, 'tasks', 'id', individuallyDeleted.id)).toEqual([]);
    },
  );

  it('AC4: individually deleted task is in list_deleted_tasks with object_deleted = false', async () => {
    const { data, error } = await listDeletedTasks(m.client);

    expect(error).toBeNull();
    expect((data ?? []).find((r) => r.id === individuallyDeleted.id)?.object_deleted).toBe(false);
  });

  it('§2.10: restore_object on an active object → OBJECT_NOT_FOUND', async () => {
    const { error } = await callTrashRpc(m.client, 'restore_object', object.id);

    expect(error?.message).toBe('OBJECT_NOT_FOUND');
  });

  it('§3.1: restore_object on a random uuid → OBJECT_NOT_FOUND', async () => {
    const { error } = await callTrashRpc(m.client, 'restore_object', randomUUID());

    expect(error?.message).toBe('OBJECT_NOT_FOUND');
  });

  it('§2.10: executor → NOT_ALLOWED, object stays deleted', async () => {
    const deleted = await createObject(m.client);

    await createTask(m.client, { objectId: deleted.id, assigneeId: a.id });
    await trashRpc(m, 'soft_delete_object', deleted.id);

    const { error } = await callTrashRpc(a.client, 'restore_object', deleted.id);

    expect(error?.message).toBe('NOT_ALLOWED');
    expect((await readObjectAsAdmin(admin, deleted.id))?.deleted_at).not.toBeNull();
  });
});

describe('AC3 / §3.1 service_role', () => {
  it('§3.1: UPDATE title of a deleted task → TASK_DELETED, title unchanged', async () => {
    const object = await createObject(m.client);
    const task = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

    await trashRpc(m, 'soft_delete_task', task.id);

    const { error } = await admin
      .from('tasks')
      .update({ title: `Svc ${uniqueSuffix()}` })
      .eq('id', task.id);

    expect(error?.message).toBe('TASK_DELETED');
    expect((await readTaskAsAdmin(admin, task.id))?.title).toBe(task.title);
  });

  it('§3.1: UPDATE title of a task in a deleted object → TASK_DELETED, title unchanged', async () => {
    const object = await createObject(m.client);
    const task = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

    await trashRpc(m, 'soft_delete_object', object.id);

    const { error } = await admin
      .from('tasks')
      .update({ title: `Svc ${uniqueSuffix()}` })
      .eq('id', task.id);

    expect(error?.message).toBe('TASK_DELETED');
    expect((await readTaskAsAdmin(admin, task.id))?.title).toBe(task.title);
  });

  it('§3.1: INSERT into a deleted object → OBJECT_DELETED', async () => {
    const object = await createObject(m.client);

    await trashRpc(m, 'soft_delete_object', object.id);

    const title = `Svc ${uniqueSuffix()}`;
    const { error } = await admin
      .from('tasks')
      .insert({ object_id: object.id, title, assignee_id: a.id, author_id: m.id });

    expect(error?.message).toBe('OBJECT_DELETED');

    const { data } = await admin.from('tasks').select('id').eq('title', title);

    expect(data).toEqual([]);
  });

  it('§3.1: INSERT with deleted_at/deleted_by set → both stored as null', async () => {
    const object = await createObject(m.client);
    const { data, error } = await admin
      .from('tasks')
      .insert({
        object_id: object.id,
        title: `Svc ${uniqueSuffix()}`,
        assignee_id: a.id,
        author_id: m.id,
        deleted_at: new Date().toISOString(),
        deleted_by: m.id,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect((data as TaskRow).deleted_at).toBeNull();
    expect((data as TaskRow).deleted_by).toBeNull();
  });

  it('§2.11: hard DELETE of an object cascades to tasks and both history tables', async () => {
    const object = await createObject(m.client);
    const created = await createTask(m.client, { objectId: object.id, assigneeId: a.id });
    const task = await advanceTask({ manager: m, executor: a }, created.id, 'in_progress');
    const { error: editError } = await m.client
      .from('tasks')
      .update({ title: `Edited ${uniqueSuffix()}` })
      .eq('id', task.id);

    expect(editError).toBeNull();
    expect((await readStatusHistory(admin, [task.id])).length).toBeGreaterThan(0);
    expect((await readFieldHistory(admin, [task.id])).length).toBeGreaterThan(0);

    const { error } = await admin.from('objects').delete().eq('id', object.id);

    expect(error).toBeNull();
    expect(await readObjectAsAdmin(admin, object.id)).toBeNull();
    expect(await readTaskAsAdmin(admin, task.id)).toBeNull();
    expect(await readStatusHistory(admin, [task.id])).toEqual([]);
    expect(await readFieldHistory(admin, [task.id])).toEqual([]);
  });
});
