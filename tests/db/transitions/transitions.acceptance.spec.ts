import { randomUUID } from 'node:crypto';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
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
  TaskStatus,
  TestUser,
} from '../fixtures/fixtures.type';

type RpcResult = { data: TaskRow | null; error: PostgrestError | null };

async function changeStatus(
  client: SupabaseClient,
  taskId: string,
  to: TaskStatus,
  comment?: string | null,
): Promise<RpcResult> {
  const args: Record<string, unknown> = { p_task_id: taskId, p_to_status: to };

  if (comment !== undefined) {
    args.p_comment = comment;
  }

  const { data, error } = await client.rpc('change_task_status', args);

  return { data: data as TaskRow | null, error };
}

async function readTask(admin: SupabaseClient, id: string): Promise<TaskRow> {
  const { data, error } = await admin.from('tasks').select('*').eq('id', id).single();

  if (error) {
    throw new Error(`readTask failed: ${error.message}`);
  }

  return data as TaskRow;
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

let admin: SupabaseClient;
let m: TestUser;
let m2: TestUser;
let a: TestUser;
let b: TestUser;
let object: ObjectRow;
let actors: TaskActors;

async function taskIn(status: TaskStatus): Promise<TaskRow> {
  const task = await createTask(m.client, { objectId: object.id, assigneeId: a.id });

  return advanceTask(actors, task.id, status);
}

beforeAll(async () => {
  admin = await createAdminClient();
  m = await createManager();
  m2 = await createManager();
  a = await createExecutor();
  b = await createExecutor();
  object = await createObject(m.client);
  actors = { manager: m, executor: a };
});

describe('§5.6 / §5.7 / §10.1 Transitions: full happy path writes history', () => {
  it('every allowed transition succeeds for the right actor and is logged with comment normalisation', async () => {
    const task = await createTask(m.client, { objectId: object.id, assigneeId: a.id });
    const steps: Array<{ actor: TestUser; to: TaskStatus; comment?: string }> = [
      { actor: a, to: 'in_progress' },
      { actor: a, to: 'on_review' },
      { actor: m, to: 'rework', comment: '  fix it  ' },
      { actor: a, to: 'in_progress', comment: '   ' },
      { actor: a, to: 'on_review', comment: 'done' },
      { actor: m2, to: 'accepted' },
    ];

    for (const step of steps) {
      const { data, error } = await changeStatus(step.actor.client, task.id, step.to, step.comment);

      expect(error).toBeNull();
      expect(data?.status).toBe(step.to);
      expect(data?.id).toBe(task.id);
    }

    const history = await readHistory(admin, task.id);

    expect(
      history.map(({ from_status, to_status, changed_by, comment }) => ({
        from_status,
        to_status,
        changed_by,
        comment,
      })),
    ).toEqual([
      { from_status: null, to_status: 'new', changed_by: m.id, comment: null },
      { from_status: 'new', to_status: 'in_progress', changed_by: a.id, comment: null },
      { from_status: 'in_progress', to_status: 'on_review', changed_by: a.id, comment: null },
      { from_status: 'on_review', to_status: 'rework', changed_by: m.id, comment: 'fix it' },
      { from_status: 'rework', to_status: 'in_progress', changed_by: a.id, comment: null },
      { from_status: 'in_progress', to_status: 'on_review', changed_by: a.id, comment: 'done' },
      { from_status: 'on_review', to_status: 'accepted', changed_by: m2.id, comment: null },
    ]);
  });
});

describe('§5.7 / §10.1 Transitions: every forbidden pair → INVALID_TRANSITION', () => {
  const statuses: TaskStatus[] = ['new', 'in_progress', 'on_review', 'accepted', 'rework'];
  const allowed = new Set([
    'new>in_progress',
    'in_progress>on_review',
    'on_review>accepted',
    'on_review>rework',
    'rework>in_progress',
  ]);
  const forbidden: Array<[TaskStatus, TaskStatus]> = statuses.flatMap((from) =>
    statuses
      .filter((to) => !allowed.has(`${from}>${to}`))
      .map((to): [TaskStatus, TaskStatus] => [from, to]),
  );
  const tasksByStatus = new Map<TaskStatus, TaskRow>();

  beforeAll(async () => {
    for (const status of statuses) {
      tasksByStatus.set(status, await taskIn(status));
    }
  });

  it('oracle covers 5×5 minus 5 allowed = 20 pairs', () => {
    expect(forbidden).toHaveLength(20);
  });

  it.each(forbidden)('%s → %s is rejected for manager and assignee', async (from, to) => {
    const task = tasksByStatus.get(from);

    if (!task) {
      throw new Error(`no fixture task in status ${from}`);
    }

    const countBefore = (await readHistory(admin, task.id)).length;
    const byManager = await changeStatus(m.client, task.id, to, 'comment');
    const byAssignee = await changeStatus(a.client, task.id, to, 'comment');

    expect(byManager.error?.message).toBe('INVALID_TRANSITION');
    expect(byAssignee.error?.message).toBe('INVALID_TRANSITION');
    expect((await readTask(admin, task.id)).status).toBe(from);
    expect(await readHistory(admin, task.id)).toHaveLength(countBefore);
  });
});

describe('§5.6 / §5.7 / §10.1 Transitions: wrong actor', () => {
  let newTask: TaskRow;
  let inProgressTask: TaskRow;
  let onReviewTask: TaskRow;
  let reworkTask: TaskRow;

  beforeAll(async () => {
    newTask = await taskIn('new');
    inProgressTask = await taskIn('in_progress');
    onReviewTask = await taskIn('on_review');
    reworkTask = await taskIn('rework');
  });

  it.each([
    ['new', 'in_progress', () => newTask],
    ['in_progress', 'on_review', () => inProgressTask],
    ['rework', 'in_progress', () => reworkTask],
  ] as Array<[TaskStatus, TaskStatus, () => TaskRow]>)(
    '§12.8: manager cannot do executor transition %s → %s (NOT_ALLOWED)',
    async (from, to, getTask) => {
      const { error } = await changeStatus(m.client, getTask().id, to);

      expect(error?.message).toBe('NOT_ALLOWED');
      expect((await readTask(admin, getTask().id)).status).toBe(from);
    },
  );

  it('§10.1: assignee cannot accept (on_review → accepted) → NOT_ALLOWED', async () => {
    const { error } = await changeStatus(a.client, onReviewTask.id, 'accepted');

    expect(error?.message).toBe('NOT_ALLOWED');
    expect((await readTask(admin, onReviewTask.id)).status).toBe('on_review');
  });

  it('§5.6: assignee cannot return to rework, with comment → NOT_ALLOWED', async () => {
    const { error } = await changeStatus(a.client, onReviewTask.id, 'rework', 'please');

    expect(error?.message).toBe('NOT_ALLOWED');
    expect((await readTask(admin, onReviewTask.id)).status).toBe('on_review');
  });

  it('§5.6: NOT_ALLOWED wins over COMMENT_REQUIRED (assignee rework without comment)', async () => {
    const { error } = await changeStatus(a.client, onReviewTask.id, 'rework');

    expect(error?.message).toBe('NOT_ALLOWED');
  });

  it('§10.1 / §12.13: foreign executor on an allowed transition → TASK_NOT_FOUND', async () => {
    const { error } = await changeStatus(b.client, newTask.id, 'in_progress');

    expect(error?.message).toBe('TASK_NOT_FOUND');
    expect((await readTask(admin, newTask.id)).status).toBe('new');
  });

  it('§5.6: TASK_NOT_FOUND wins over INVALID_TRANSITION for a foreign executor', async () => {
    const { error } = await changeStatus(b.client, newTask.id, 'accepted');

    expect(error?.message).toBe('TASK_NOT_FOUND');
  });

  it('§5.6: non-existent task id → TASK_NOT_FOUND', async () => {
    const { error } = await changeStatus(m.client, randomUUID(), 'accepted');

    expect(error?.message).toBe('TASK_NOT_FOUND');
  });
});

describe('§5.6 / §10.1 Transitions: rework comment', () => {
  let onReviewTask: TaskRow;

  beforeAll(async () => {
    onReviewTask = await taskIn('on_review');
  });

  it.each([
    ['omitted', undefined],
    ['null', null],
    ['empty', ''],
    ['whitespace only', '   '],
  ] as Array<[string, string | null | undefined]>)(
    'on_review → rework with comment %s → COMMENT_REQUIRED',
    async (_label, comment) => {
      const { error } = await changeStatus(m.client, onReviewTask.id, 'rework', comment);

      expect(error?.message).toBe('COMMENT_REQUIRED');
      expect((await readTask(admin, onReviewTask.id)).status).toBe('on_review');
    },
  );

  it('§5.5: comment longer than 2000 chars is rejected by check (23514), whole call rolled back', async () => {
    const countBefore = (await readHistory(admin, onReviewTask.id)).length;
    const { error } = await changeStatus(m.client, onReviewTask.id, 'rework', 'x'.repeat(2001));

    expect(error?.code).toBe('23514');
    expect((await readTask(admin, onReviewTask.id)).status).toBe('on_review');
    expect(await readHistory(admin, onReviewTask.id)).toHaveLength(countBefore);
  });
});

describe('§7.2 / §10.1 Transitions: direct status UPDATE by service_role', () => {
  let newTask: TaskRow;
  let acceptedTask: TaskRow;

  beforeAll(async () => {
    newTask = await taskIn('new');
    acceptedTask = await taskIn('accepted');
  });

  it('§7.2: new → in_progress via direct UPDATE → STATUS_CHANGE_FORBIDDEN', async () => {
    const { error } = await admin
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', newTask.id);

    expect(error?.message).toBe('STATUS_CHANGE_FORBIDDEN');
    expect((await readTask(admin, newTask.id)).status).toBe('new');
  });

  it('§7.2: any UPDATE of an accepted task → TASK_ACCEPTED_READONLY', async () => {
    const { error } = await admin.from('tasks').update({ status: 'new' }).eq('id', acceptedTask.id);

    expect(error?.message).toBe('TASK_ACCEPTED_READONLY');
    expect((await readTask(admin, acceptedTask.id)).status).toBe('accepted');
  });
});

describe('§5.6 Transitions: concurrency', () => {
  it('two parallel new → in_progress calls: exactly one succeeds, the other INVALID_TRANSITION', async () => {
    const task = await taskIn('new');
    const results = await Promise.all([
      changeStatus(a.client, task.id, 'in_progress'),
      changeStatus(a.client, task.id, 'in_progress'),
    ]);
    const succeeded = results.filter((r) => r.error === null);
    const failed = results.filter((r) => r.error !== null);

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].error?.message).toBe('INVALID_TRANSITION');

    const history = await readHistory(admin, task.id);

    expect(history.filter((h) => h.to_status === 'in_progress')).toHaveLength(1);
  });
});
