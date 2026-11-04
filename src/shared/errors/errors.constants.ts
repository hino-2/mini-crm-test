import type { DbErrorCode } from './errors.type';

export const ERROR_MESSAGES: Readonly<Record<DbErrorCode, string>> = {
  NOT_AUTHENTICATED: 'Сессия истекла, войдите снова',
  TASK_NOT_FOUND: 'Задача не найдена',
  INVALID_TRANSITION: 'Этот переход статуса недоступен',
  NOT_ALLOWED: 'Недостаточно прав для этого действия',
  COMMENT_REQUIRED: 'Укажите комментарий',
  STATUS_CHANGE_FORBIDDEN: 'Статус меняется только через действия задачи',
  TASK_ACCEPTED_READONLY: 'Принятую задачу нельзя изменить',
  ASSIGNEE_NOT_EXECUTOR: 'Исполнителем может быть только пользователь с ролью «Исполнитель»',
  IMMUTABLE_FIELD: 'Поле нельзя изменить',
};

export const UNKNOWN_ERROR_MESSAGE = 'Не удалось выполнить действие';

export const INVALID_CREDENTIALS_MESSAGE = 'Неверный email или пароль';
