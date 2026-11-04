import { describe, expect, it } from 'vitest';

import type { Profile } from '../../auth/auth.type';
import type { Task, TaskStatus } from '../tasks.type';
import { getAvailableActions } from './task-actions';
import type { TaskAction } from './task-actions.type';

const MANAGER: Pick<Profile, 'id' | 'role'> = { id: 'm1', role: 'manager' };
const OWN_EXECUTOR: Pick<Profile, 'id' | 'role'> = { id: 'e1', role: 'executor' };
const FOREIGN_EXECUTOR: Pick<Profile, 'id' | 'role'> = { id: 'e2', role: 'executor' };

const START: TaskAction = {
  id: 'start',
  label: 'Взять в работу',
  toStatus: 'in_progress',
  requiresComment: false,
};
const SUBMIT: TaskAction = {
  id: 'submit_for_review',
  label: 'Отправить на проверку',
  toStatus: 'on_review',
  requiresComment: false,
};
const ACCEPT: TaskAction = {
  id: 'accept',
  label: 'Принять',
  toStatus: 'accepted',
  requiresComment: false,
};
const RETURN_TO_REWORK: TaskAction = {
  id: 'return_to_rework',
  label: 'Вернуть на доработку',
  toStatus: 'rework',
  requiresComment: true,
};
const RESUME: TaskAction = {
  id: 'resume',
  label: 'Возобновить работу',
  toStatus: 'in_progress',
  requiresComment: false,
};

const task = (status: TaskStatus, assigneeId = 'e1'): Pick<Task, 'status' | 'assignee_id'> => ({
  status,
  assignee_id: assigneeId,
});

describe('§8.4 getAvailableActions: manager', () => {
  it.each<[TaskStatus, TaskAction[]]>([
    ['new', []],
    ['in_progress', []],
    ['on_review', [ACCEPT, RETURN_TO_REWORK]],
    ['accepted', []],
    ['rework', []],
  ])('status %s → %j', (status, expected) => {
    expect(getAvailableActions(task(status), MANAGER)).toEqual(expected);
  });

  it.each<[TaskStatus, TaskAction[]]>([
    ['new', []],
    ['in_progress', []],
    ['on_review', [ACCEPT, RETURN_TO_REWORK]],
    ['accepted', []],
    ['rework', []],
  ])(
    '«Постановщик не может выполнять переходы исполнителя»: even with assignee_id = manager.id, status %s → %j',
    (status, expected) => {
      expect(getAvailableActions(task(status, MANAGER.id), MANAGER)).toEqual(expected);
    },
  );
});

describe('§8.4 getAvailableActions: own executor (assignee_id = user.id)', () => {
  it.each<[TaskStatus, TaskAction[]]>([
    ['new', [START]],
    ['in_progress', [SUBMIT]],
    ['on_review', []],
    ['accepted', []],
    ['rework', [RESUME]],
  ])('status %s → %j', (status, expected) => {
    expect(getAvailableActions(task(status, OWN_EXECUTOR.id), OWN_EXECUTOR)).toEqual(expected);
  });
});

describe('§8.4 getAvailableActions: foreign executor (assignee_id ≠ user.id)', () => {
  it.each<TaskStatus>(['new', 'in_progress', 'on_review', 'accepted', 'rework'])(
    'status %s → no actions',
    (status) => {
      expect(getAvailableActions(task(status, OWN_EXECUTOR.id), FOREIGN_EXECUTOR)).toEqual([]);
    },
  );
});

describe('§8.4 getAvailableActions is pure', () => {
  it('does not mutate its inputs', () => {
    const input = task('on_review');
    const user = { ...MANAGER };

    getAvailableActions(input, user);

    expect(input).toEqual({ status: 'on_review', assignee_id: 'e1' });
    expect(user).toEqual({ id: 'm1', role: 'manager' });
  });

  it('returns a new array on each call', () => {
    const first = getAvailableActions(task('on_review'), MANAGER);
    const second = getAvailableActions(task('on_review'), MANAGER);

    expect(first).not.toBe(second);
  });
});
