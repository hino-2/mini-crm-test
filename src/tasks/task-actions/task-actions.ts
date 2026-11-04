import type { Profile } from '../../auth/auth.type';
import type { Task } from '../tasks.type';
import { TASK_ACTIONS } from './task-actions.constants';
import type { TaskAction } from './task-actions.type';

export function getAvailableActions(
  task: Pick<Task, 'status' | 'assignee_id'>,
  user: Pick<Profile, 'id' | 'role'>,
): TaskAction[] {
  return TASK_ACTIONS.filter(
    (action) =>
      action.fromStatus === task.status &&
      ((action.actor === 'manager' && user.role === 'manager') ||
        (action.actor === 'assignee' && user.role === 'executor' && task.assignee_id === user.id)),
  ).map(({ id, label, toStatus, requiresComment }) => ({ id, label, toStatus, requiresComment }));
}
