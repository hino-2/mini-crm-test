import type { TaskStatus } from '../tasks.type';
import { TASK_STATUS_LABELS } from '../tasks.constants';

export const MY_TASKS_STATUS_ORDER: readonly TaskStatus[] = [
  'rework',
  'new',
  'in_progress',
  'on_review',
  'accepted',
];

export const MY_TASKS_FILTER_ALL = 'all';

export const MY_TASKS_FILTER_OPTIONS = [
  { value: MY_TASKS_FILTER_ALL, label: 'Все' },
  ...MY_TASKS_STATUS_ORDER.map((status) => ({ value: status, label: TASK_STATUS_LABELS[status] })),
];
