import type { TaskStatus } from './tasks.type';

export const TASK_STATUS_LABELS: Readonly<Record<TaskStatus, string>> = {
  new: 'Новая',
  in_progress: 'В работе',
  on_review: 'На проверке',
  accepted: 'Принята',
  rework: 'На доработке',
};

export const TASK_STATUS_COLORS: Readonly<Record<TaskStatus, string>> = {
  new: 'blue',
  in_progress: 'yellow',
  on_review: 'violet',
  accepted: 'green',
  rework: 'red',
};
