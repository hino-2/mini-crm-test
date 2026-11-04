import type { TaskActionDefinition } from './task-actions.type';

export const TASK_ACTIONS: readonly TaskActionDefinition[] = [
  {
    id: 'start',
    label: 'Взять в работу',
    fromStatus: 'new',
    toStatus: 'in_progress',
    actor: 'assignee',
    requiresComment: false,
  },
  {
    id: 'submit_for_review',
    label: 'Отправить на проверку',
    fromStatus: 'in_progress',
    toStatus: 'on_review',
    actor: 'assignee',
    requiresComment: false,
  },
  {
    id: 'accept',
    label: 'Принять',
    fromStatus: 'on_review',
    toStatus: 'accepted',
    actor: 'manager',
    requiresComment: false,
  },
  {
    id: 'return_to_rework',
    label: 'Вернуть на доработку',
    fromStatus: 'on_review',
    toStatus: 'rework',
    actor: 'manager',
    requiresComment: true,
  },
  {
    id: 'resume',
    label: 'Возобновить работу',
    fromStatus: 'rework',
    toStatus: 'in_progress',
    actor: 'assignee',
    requiresComment: false,
  },
];
