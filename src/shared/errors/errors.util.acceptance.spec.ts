import { AuthApiError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import type { DbErrorCode } from './errors.type';
import { getErrorMessage, getLoginErrorMessage } from './errors.util';

const UNKNOWN = 'Не удалось выполнить действие';

// Таблица §5.8: код → текст для UI.
const CODE_TEXTS: ReadonlyArray<readonly [DbErrorCode, string]> = [
  ['NOT_AUTHENTICATED', 'Сессия истекла, войдите снова'],
  ['TASK_NOT_FOUND', 'Задача не найдена'],
  ['INVALID_TRANSITION', 'Этот переход статуса недоступен'],
  ['NOT_ALLOWED', 'Недостаточно прав для этого действия'],
  ['COMMENT_REQUIRED', 'Укажите комментарий'],
  ['STATUS_CHANGE_FORBIDDEN', 'Статус меняется только через действия задачи'],
  ['TASK_ACCEPTED_READONLY', 'Принятую задачу нельзя изменить'],
  ['ASSIGNEE_NOT_EXECUTOR', 'Исполнителем может быть только пользователь с ролью «Исполнитель»'],
  ['IMMUTABLE_FIELD', 'Поле нельзя изменить'],
];

describe('§5.8 getErrorMessage: code → Russian UI text', () => {
  it.each(CODE_TEXTS)('PostgREST error with message %s → «%s»', (code, text) => {
    expect(getErrorMessage({ code: 'P0001', message: code, details: null, hint: null })).toBe(text);
  });

  it.each(CODE_TEXTS)('Error(%s) → «%s»', (code, text) => {
    expect(getErrorMessage(new Error(code))).toBe(text);
  });
});

describe('§5.8 «неизвестная ошибка → «Не удалось выполнить действие»»', () => {
  it.each<[string, unknown]>([
    ['unknown code', { code: 'P0001', message: 'SOMETHING_ELSE', details: null, hint: null }],
    ['prototype key "toString"', { message: 'toString' }],
    ['lowercase known code', { message: 'not_allowed' }],
    ['null', null],
    ['undefined', undefined],
    ['plain string code', 'NOT_ALLOWED'],
    ['empty object', {}],
    [
      'RLS 42501 error',
      {
        code: '42501',
        message: 'new row violates row-level security policy for table "tasks"',
        details: null,
        hint: null,
      },
    ],
  ])('%s → «Не удалось выполнить действие»', (_case, error) => {
    expect(getErrorMessage(error)).toBe(UNKNOWN);
  });
});

describe('§8.3.1 getLoginErrorMessage', () => {
  it('AuthApiError invalid credentials → «Неверный email или пароль»', () => {
    expect(
      getLoginErrorMessage(
        new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
      ),
    ).toBe('Неверный email или пароль');
  });

  it.each<[string, unknown]>([
    ['generic Error', new Error('Failed to fetch')],
    ['null', null],
  ])('%s → «Не удалось выполнить действие»', (_case, error) => {
    expect(getLoginErrorMessage(error)).toBe(UNKNOWN);
  });
});
