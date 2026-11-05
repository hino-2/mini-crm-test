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

export const TASK_COMMENT_MAX_LENGTH = 2000;
export const TASK_OBJECT_REQUIRED_MESSAGE = 'Выберите объект';
export const TASK_CREATED_HISTORY_LABEL = 'Создана';

export const TASK_DETAILS_SELECT =
  'id, object_id, title, description, assignee_id, status, created_at, object:objects!tasks_object_id_fkey(name), assignee:profiles!tasks_assignee_id_fkey(full_name), author:profiles!tasks_author_id_fkey(full_name)';
export const TASK_HISTORY_SELECT =
  'id, from_status, to_status, changed_at, comment, actor:profiles!task_status_history_changed_by_fkey(full_name)';
export const MY_TASKS_SELECT =
  'id, title, status, created_at, object:objects!tasks_object_id_fkey(name)';
