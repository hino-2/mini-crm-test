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

export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_DESCRIPTION_MAX_LENGTH = 5000;

export const TASK_TITLE_REQUIRED_MESSAGE = 'Введите название';
export const TASK_ASSIGNEE_REQUIRED_MESSAGE = 'Выберите исполнителя';

export const OBJECT_TASKS_SELECT =
  'id, title, status, created_at, assignee:profiles!tasks_assignee_id_fkey(full_name)';
