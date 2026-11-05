import { notifications } from '@mantine/notifications';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import { AuthContext } from '../../auth/auth-context/auth-context';
import type { AuthContextValue } from '../../auth/auth.interfaces';
import type { Profile } from '../../auth/auth.type';
import { fetchObjects } from '../../objects/objects-api/objects-api';
import type { ObjectSummary } from '../../objects/objects.type';
import { fetchExecutors } from '../../profiles/profiles-api/profiles-api';
import {
  changeTaskStatus,
  deleteTask,
  fetchTask,
  fetchTaskHistory,
  updateTask,
} from '../../tasks/tasks-api/tasks-api';
import type { TaskDetails, TaskHistoryEntry } from '../../tasks/tasks.type';
import { TaskCardPage } from './task-card-page';

vi.mock('../../tasks/tasks-api/tasks-api', () => ({
  fetchObjectTasks: vi.fn(),
  createTask: vi.fn(),
  fetchTask: vi.fn(),
  fetchTaskHistory: vi.fn(),
  fetchMyTasks: vi.fn(),
  changeTaskStatus: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock('../../objects/objects-api/objects-api', () => ({
  fetchObjects: vi.fn(),
  fetchObject: vi.fn(),
  createObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('../../profiles/profiles-api/profiles-api', () => ({
  fetchExecutors: vi.fn(),
}));

// Тестовый хелпер-тип: статус задачи.
type Status = TaskDetails['status'];

const MANAGER: Profile = { id: 'mgr-1', full_name: 'Иван Петров', role: 'manager' };
const EXECUTOR: Profile = { id: 'exec-1', full_name: 'Сергей Кузнецов', role: 'executor' };
const OTHER_EXECUTOR: Profile = { id: 'exec-2', full_name: 'Алексей Морозов', role: 'executor' };

const TASK: TaskDetails = {
  id: 'task-1',
  object_id: 'obj-1',
  title: 'Залить фундамент',
  description: 'Бетон М300',
  assignee_id: 'exec-1',
  status: 'new',
  created_at: '2026-03-15T09:30:00Z',
  object: { name: 'Дом на Ленина' },
  assignee: { full_name: 'Сергей Кузнецов' },
  author: { full_name: 'Иван Петров' },
};

const HISTORY: TaskHistoryEntry[] = [
  {
    kind: 'status',
    id: 1,
    from_status: null,
    to_status: 'new',
    changed_at: '2026-03-15T09:30:00Z',
    comment: null,
    actor: { full_name: 'Иван Петров' },
  },
  {
    kind: 'status',
    id: 2,
    from_status: 'new',
    to_status: 'in_progress',
    changed_at: '2026-03-16T08:00:00Z',
    comment: null,
    actor: { full_name: 'Сергей Кузнецов' },
  },
  {
    kind: 'status',
    id: 3,
    from_status: 'in_progress',
    to_status: 'on_review',
    changed_at: '2026-03-17T10:00:00Z',
    comment: null,
    actor: { full_name: 'Сергей Кузнецов' },
  },
  {
    kind: 'status',
    id: 4,
    from_status: 'on_review',
    to_status: 'rework',
    changed_at: '2026-03-18T12:00:00Z',
    comment: 'Нет арматуры',
    actor: { full_name: 'Ольга Смирнова' },
  },
];

const EXECUTORS = [
  { id: 'exec-1', full_name: 'Сергей Кузнецов' },
  { id: 'exec-2', full_name: 'Алексей Морозов' },
];

const OBJECTS: ObjectSummary[] = [
  { id: 'obj-1', name: 'Дом на Ленина', address: 'ул. Ленина, 1', task_count: 3 },
  { id: 'obj-2', name: 'Склад', address: 'пр. Мира, 10', task_count: 0 },
];

const ACTION_LABELS = [
  'Взять в работу',
  'Отправить на проверку',
  'Принять',
  'Вернуть на доработку',
  'Возобновить работу',
] as const;

const HEADING = 'Карточка задачи';
const NOT_FOUND_TEXT = 'Не найдено или нет доступа';
const OBJECT_CARD_PROBE = 'OBJECT CARD PROBE';
const REWORK_DIALOG = 'Вернуть на доработку';
const EDIT_DIALOG = 'Редактировать задачу';
const DELETE_DIALOG = 'Удалить задачу?';

// Тестовый хелпер: статичный фейк контекста авторизации.
function fakeAuth(profile: Profile): AuthContextValue {
  return {
    status: 'authenticated',
    session: null,
    profile,
    signIn: vi.fn<AuthContextValue['signIn']>().mockResolvedValue(undefined),
    signOut: vi.fn<AuthContextValue['signOut']>().mockResolvedValue(undefined),
  };
}

function taskWith(status: Status): TaskDetails {
  return { ...TASK, status };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU');
}

function renderCard(profile: Profile): void {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/tasks/task-1']}>
        <AuthContext.Provider value={fakeAuth(profile)}>
          <Routes>
            <Route path="/tasks/:taskId" element={<TaskCardPage />} />
            <Route path="/objects/:objectId" element={<div>{OBJECT_CARD_PROBE}</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </AppProviders>,
  );
}

// Тестовый хелпер: рендер карточки задачи с заданным статусом и ожидание загрузки.
async function renderLoaded(profile: Profile, status: Status): Promise<void> {
  vi.mocked(fetchTask).mockResolvedValue(taskWith(status));
  renderCard(profile);

  await screen.findByText('Залить фундамент');
}

// Тестовый хелпер: строка таблицы, содержащая текст.
function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest('tr');

  if (!row) {
    throw new Error(`row with «${text}» not found`);
  }

  return row;
}

function historyTable(): HTMLElement {
  const table = screen.getByRole('columnheader', { name: 'Изменение' }).closest('table');

  if (!table) {
    throw new Error('history table not found');
  }

  return table;
}

function bodyRows(table: HTMLElement): HTMLElement[] {
  return within(table)
    .getAllByRole('row')
    .filter((row) => within(row).queryAllByRole('cell').length > 0);
}

function nth(rows: HTMLElement[], index: number): HTMLElement {
  const row = rows.at(index);

  if (!row) {
    throw new Error(`row #${index} not found`);
  }

  return row;
}

// Тестовый хелпер: какие кнопки действий из §8.4 сейчас видны.
function visibleActions(): string[] {
  return ACTION_LABELS.filter((name) => screen.queryByRole('button', { name }) !== null);
}

async function pasteInto(user: UserEvent, input: HTMLElement, value: string): Promise<void> {
  await user.click(input);
  await user.paste(value);
}

// Тестовый хелпер: менеджер на задаче on_review открывает модалку доработки.
async function openReworkDialog(user: UserEvent): Promise<HTMLElement> {
  await renderLoaded(MANAGER, 'on_review');
  await user.click(screen.getByRole('button', { name: 'Вернуть на доработку' }));

  return screen.findByRole('dialog', { name: REWORK_DIALOG });
}

// Тестовый хелпер: менеджер открывает модалку редактирования и ждёт загрузки исполнителей.
async function openEditDialog(user: UserEvent, status: Status = 'new'): Promise<HTMLElement> {
  await renderLoaded(MANAGER, status);
  await user.click(screen.getByRole('button', { name: 'Редактировать' }));

  const dialog = await screen.findByRole('dialog', { name: EDIT_DIALOG });

  await waitFor(() => {
    expect(within(dialog).getByLabelText('Исполнитель')).toHaveValue('Сергей Кузнецов');
  });

  return dialog;
}

// Тестовый хелпер: выбор значения в Select (опции рендерятся в портале).
async function pickOption(
  user: UserEvent,
  dialog: HTMLElement,
  label: string,
  name: string,
): Promise<void> {
  const select = within(dialog).getByLabelText(label);

  await waitFor(() => {
    expect(select).toBeEnabled();
  });

  await user.click(select);
  await user.click(await screen.findByRole('option', { name }));
}

beforeEach(() => {
  vi.mocked(fetchTask).mockResolvedValue(TASK);
  vi.mocked(fetchTaskHistory).mockResolvedValue(HISTORY);
  vi.mocked(fetchExecutors).mockResolvedValue(EXECUTORS);
  vi.mocked(fetchObjects).mockResolvedValue(OBJECTS);
  vi.mocked(changeTaskStatus).mockResolvedValue(undefined);
  vi.mocked(updateTask).mockResolvedValue(undefined);
  vi.mocked(deleteTask).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  act(() => {
    notifications.clean();
  });
});

describe('§8.3 п.4 «Карточка задачи. Поля: название, описание, объект (ссылка), исполнитель, статус, автор, дата создания»', () => {
  it.each([
    ['manager', MANAGER],
    ['executor', EXECUTOR],
  ] as const)('%s sees heading «Карточка задачи»; task loaded via fetchTask("task-1")', async (_role, profile) => {
    renderCard(profile);

    expect(await screen.findByRole('heading', { name: HEADING })).toBeInTheDocument();
    expect(await screen.findByText('Залить фундамент')).toBeInTheDocument();
    expect(fetchTask).toHaveBeenCalledWith('task-1');
  });

  it('shows title, description, object link, assignee, status badge, author and ru-RU created date under their labels', async () => {
    await renderLoaded(EXECUTOR, 'new');

    expect(within(rowOf('Описание')).getByText('Бетон М300')).toBeInTheDocument();
    expect(
      within(rowOf('Объект')).getByRole('link', { name: 'Дом на Ленина' }),
    ).toHaveAttribute('href', '/objects/obj-1');
    expect(within(rowOf('Исполнитель')).getByText('Сергей Кузнецов')).toBeInTheDocument();
    expect(within(rowOf('Статус')).getByText('Новая')).toBeInTheDocument();
    expect(within(rowOf('Автор')).getByText('Иван Петров')).toBeInTheDocument();
    expect(
      within(rowOf('Дата создания')).getByText(formatDate('2026-03-15T09:30:00Z')),
    ).toBeInTheDocument();
  });

  it('empty description is shown as «—»', async () => {
    vi.mocked(fetchTask).mockResolvedValue({ ...TASK, description: '' });
    renderCard(EXECUTOR);

    await screen.findByText('Залить фундамент');

    expect(within(rowOf('Описание')).getByText('—')).toBeInTheDocument();
  });

  it('clicking the object link opens the object card', async () => {
    const user = userEvent.setup();

    await renderLoaded(EXECUTOR, 'new');
    await user.click(screen.getByRole('link', { name: 'Дом на Ленина' }));

    expect(await screen.findByText(OBJECT_CARD_PROBE)).toBeInTheDocument();
  });
});

describe('§8.2 «Если объект/задача не найдены (RLS вернул пусто) — «Не найдено или нет доступа»»', () => {
  it.each([
    ['manager', MANAGER],
    ['executor', EXECUTOR],
  ] as const)(
    '%s: fetchTask → null shows «Не найдено или нет доступа», no actions, history is not loaded',
    async (_role, profile) => {
      vi.mocked(fetchTask).mockResolvedValue(null);
      renderCard(profile);

      expect(await screen.findByText(NOT_FOUND_TEXT)).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: HEADING })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument();
      expect(visibleActions()).toEqual([]);
      expect(fetchTaskHistory).not.toHaveBeenCalled();
    },
  );
});

describe('§8.4 «UI рендерит ровно результат getAvailableActions» (матрица §5.7 × роль × свой/чужой)', () => {
  it.each([
    ['own executor', EXECUTOR, 'new', ['Взять в работу']],
    ['own executor', EXECUTOR, 'in_progress', ['Отправить на проверку']],
    ['own executor', EXECUTOR, 'on_review', []],
    ['own executor', EXECUTOR, 'accepted', []],
    ['own executor', EXECUTOR, 'rework', ['Возобновить работу']],
    ['other executor', OTHER_EXECUTOR, 'new', []],
    ['other executor', OTHER_EXECUTOR, 'in_progress', []],
    ['other executor', OTHER_EXECUTOR, 'on_review', []],
    ['other executor', OTHER_EXECUTOR, 'accepted', []],
    ['other executor', OTHER_EXECUTOR, 'rework', []],
    ['manager', MANAGER, 'new', []],
    ['manager', MANAGER, 'in_progress', []],
    ['manager', MANAGER, 'on_review', ['Принять', 'Вернуть на доработку']],
    ['manager', MANAGER, 'accepted', []],
    ['manager', MANAGER, 'rework', []],
  ] as const)('%s on status %s sees exactly %j', async (_who, profile, status, expected) => {
    await renderLoaded(profile, status);

    expect(visibleActions()).toEqual([...expected]);
  });
});

describe('§8.4 «кнопка, сразу RPC» — change_task_status', () => {
  it('executor «Взять в работу» → changeTaskStatus("task-1", "in_progress", null), card refetched with new actions', async () => {
    const user = userEvent.setup();

    await renderLoaded(EXECUTOR, 'new');

    const taskCallsBefore = vi.mocked(fetchTask).mock.calls.length;
    const historyCallsBefore = vi.mocked(fetchTaskHistory).mock.calls.length;

    vi.mocked(fetchTask).mockResolvedValue(taskWith('in_progress'));
    await user.click(screen.getByRole('button', { name: 'Взять в работу' }));

    await waitFor(() => {
      expect(changeTaskStatus).toHaveBeenCalledWith('task-1', 'in_progress', null);
    });

    expect(await screen.findByRole('button', { name: 'Отправить на проверку' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Взять в работу' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(vi.mocked(fetchTask).mock.calls.length).toBeGreaterThan(taskCallsBefore);
    });

    await waitFor(() => {
      expect(vi.mocked(fetchTaskHistory).mock.calls.length).toBeGreaterThan(historyCallsBefore);
    });
  });

  it.each([
    ['executor', EXECUTOR, 'in_progress', 'Отправить на проверку', 'on_review'],
    ['executor', EXECUTOR, 'rework', 'Возобновить работу', 'in_progress'],
    ['manager', MANAGER, 'on_review', 'Принять', 'accepted'],
  ] as const)('%s on %s clicks «%s» → changeTaskStatus("task-1", "%s", null)', async (_who, profile, status, button, to) => {
    const user = userEvent.setup();

    await renderLoaded(profile, status);
    await user.click(screen.getByRole('button', { name: button }));

    await waitFor(() => {
      expect(changeTaskStatus).toHaveBeenCalledWith('task-1', to, null);
    });
  });

  it('«Кнопки блокируются на время запроса»: while «Принять» is pending, «Принять» and «Вернуть на доработку» are disabled', async () => {
    vi.mocked(changeTaskStatus).mockReturnValue(new Promise<void>(() => undefined));

    const user = userEvent.setup();

    await renderLoaded(MANAGER, 'on_review');
    await user.click(screen.getByRole('button', { name: 'Принять' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Принять' })).toBeDisabled();
    });

    expect(screen.getByRole('button', { name: 'Вернуть на доработку' })).toBeDisabled();
  });
});

describe('§8.4 «Вернуть на доработку» — модалка с обязательным комментарием (trim ≠ \'\', ≤ 2000)', () => {
  it('opens dialog «Вернуть на доработку» with textarea «Комментарий»', async () => {
    const user = userEvent.setup();
    const dialog = await openReworkDialog(user);

    expect(within(dialog).getByLabelText('Комментарий')).toBeInTheDocument();
  });

  it('empty comment → «Укажите комментарий», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openReworkDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }));

    expect(await within(dialog).findByText('Укажите комментарий')).toBeInTheDocument();
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('whitespace-only comment → «Укажите комментарий», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openReworkDialog(user);

    await user.type(within(dialog).getByLabelText('Комментарий'), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }));

    expect(await within(dialog).findByText('Укажите комментарий')).toBeInTheDocument();
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('comment of 2001 chars → «Не более 2000 символов», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openReworkDialog(user);

    await pasteInto(user, within(dialog).getByLabelText('Комментарий'), 'к'.repeat(2001));
    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }));

    expect(await within(dialog).findByText('Не более 2000 символов')).toBeInTheDocument();
    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it('comment of exactly 2000 chars is accepted', async () => {
    const user = userEvent.setup();
    const dialog = await openReworkDialog(user);
    const comment = 'к'.repeat(2000);

    await pasteInto(user, within(dialog).getByLabelText('Комментарий'), comment);
    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      expect(changeTaskStatus).toHaveBeenCalledWith('task-1', 'rework', comment);
    });
  });

  it('«  Нет арматуры  » → changeTaskStatus("task-1", "rework", "Нет арматуры"), dialog closes', async () => {
    const user = userEvent.setup();
    const dialog = await openReworkDialog(user);

    await user.type(within(dialog).getByLabelText('Комментарий'), '  Нет арматуры  ');
    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }));

    await waitFor(() => {
      expect(changeTaskStatus).toHaveBeenCalledTimes(1);
    });

    expect(changeTaskStatus).toHaveBeenCalledWith('task-1', 'rework', 'Нет арматуры');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: REWORK_DIALOG })).not.toBeInTheDocument();
    });
  });

  it('rejects NOT_ALLOWED → «Недостаточно прав для этого действия», dialog stays open', async () => {
    vi.mocked(changeTaskStatus).mockRejectedValue(new Error('NOT_ALLOWED'));

    const user = userEvent.setup();
    const dialog = await openReworkDialog(user);

    await user.type(within(dialog).getByLabelText('Комментарий'), 'Нет арматуры');
    await user.click(within(dialog).getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByText('Недостаточно прав для этого действия')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: REWORK_DIALOG })).toBeInTheDocument();
  });
});

describe('§5.8 status-change errors are shown by code and the card self-corrects', () => {
  it('rejects INVALID_TRANSITION → «Этот переход статуса недоступен», task refetched, actions follow the fresh status', async () => {
    vi.mocked(changeTaskStatus).mockRejectedValue(new Error('INVALID_TRANSITION'));

    const user = userEvent.setup();

    await renderLoaded(EXECUTOR, 'new');

    const callsBefore = vi.mocked(fetchTask).mock.calls.length;

    vi.mocked(fetchTask).mockResolvedValue(taskWith('in_progress'));
    await user.click(screen.getByRole('button', { name: 'Взять в работу' }));

    expect(await screen.findByText('Этот переход статуса недоступен')).toBeInTheDocument();

    await waitFor(() => {
      expect(vi.mocked(fetchTask).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    await screen.findByRole('button', { name: 'Отправить на проверку' });

    expect(visibleActions()).toEqual(['Отправить на проверку']);
  });

  it('rejects TASK_NOT_FOUND → «Задача не найдена», then «Не найдено или нет доступа»', async () => {
    vi.mocked(changeTaskStatus).mockRejectedValue(new Error('TASK_NOT_FOUND'));

    const user = userEvent.setup();

    await renderLoaded(EXECUTOR, 'new');
    vi.mocked(fetchTask).mockResolvedValue(null);
    await user.click(screen.getByRole('button', { name: 'Взять в работу' }));

    expect(await screen.findByText('Задача не найдена')).toBeInTheDocument();
    expect(await screen.findByText(NOT_FOUND_TEXT)).toBeInTheDocument();
  });
});

describe('§8.4 «Последний комментарий доработки (из истории) показывается исполнителю над блоком действий, когда статус rework»', () => {
  it('executor on rework sees alert «Комментарий к доработке» with «Нет арматуры» above «Возобновить работу»', async () => {
    await renderLoaded(EXECUTOR, 'rework');

    const alert = await screen.findByRole('alert');

    expect(within(alert).getByText('Комментарий к доработке')).toBeInTheDocument();
    expect(within(alert).getByText('Нет арматуры')).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Возобновить работу' });

    expect(alert.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('rework comment = last entry with kind «status» and to_status rework: later field entries do not hide it', async () => {
    vi.mocked(fetchTaskHistory).mockResolvedValue([
      ...HISTORY,
      {
        kind: 'field',
        id: 9,
        field: 'title',
        old_value: 'Фундамент',
        new_value: 'Залить фундамент',
        changed_at: '2026-03-19T09:00:00Z',
        actor: { full_name: 'Иван Петров' },
      },
    ]);

    await renderLoaded(EXECUTOR, 'rework');

    const alert = await screen.findByRole('alert');

    expect(within(alert).getByText('Нет арматуры')).toBeInTheDocument();
  });

  it('manager on rework with the same history sees no alert', async () => {
    await renderLoaded(MANAGER, 'rework');
    await screen.findByText('Нет арматуры');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('executor on in_progress sees no alert', async () => {
    await renderLoaded(EXECUTOR, 'in_progress');
    await screen.findByText('Нет арматуры');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('§8.3 п.4 «История: список по changed_at по возрастанию — дата/время, кто, «из → в» (для создания «Создана»), комментарий»', () => {
  it('loads history via fetchTaskHistory("task-1") and renders heading «История» with headers «Дата», «Кто», «Изменение», «Комментарий»', async () => {
    await renderLoaded(EXECUTOR, 'new');
    await screen.findByText('Создана');

    expect(fetchTaskHistory).toHaveBeenCalledWith('task-1');
    expect(screen.getByRole('heading', { name: 'История' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Дата' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Кто' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Изменение' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Комментарий' })).toBeInTheDocument();
  });

  it('rows in API order: «Создана», then «из → в» with actor names, ru-RU dates and comment', async () => {
    await renderLoaded(EXECUTOR, 'new');
    await screen.findByText('Создана');

    const rows = bodyRows(historyTable());

    expect(rows).toHaveLength(4);

    const first = nth(rows, 0);
    const second = nth(rows, 1);
    const third = nth(rows, 2);
    const fourth = nth(rows, 3);

    expect(within(first).getByText('Создана')).toBeInTheDocument();
    expect(within(first).getByText('Иван Петров')).toBeInTheDocument();
    expect(within(first).getByText(formatDate('2026-03-15T09:30:00Z'))).toBeInTheDocument();
    expect(within(second).getByText('Новая → В работе')).toBeInTheDocument();
    expect(within(second).getByText('Сергей Кузнецов')).toBeInTheDocument();
    expect(within(second).getByText(formatDate('2026-03-16T08:00:00Z'))).toBeInTheDocument();
    expect(within(third).getByText('В работе → На проверке')).toBeInTheDocument();
    expect(within(fourth).getByText('На проверке → На доработке')).toBeInTheDocument();
    expect(within(fourth).getByText('Ольга Смирнова')).toBeInTheDocument();
    expect(within(fourth).getByText('Нет арматуры')).toBeInTheDocument();
  });
});

describe('step 8 §4.4 «Manager sees «Редактировать» and «Удалить» in EVERY status incl. accepted»', () => {
  it.each(['new', 'in_progress', 'on_review', 'accepted', 'rework'] as const)(
    'manager on %s sees «Редактировать» and «Удалить»',
    async (status) => {
      await renderLoaded(MANAGER, status);

      expect(screen.getByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument();
    },
  );

  it.each(['new', 'accepted'] as const)('executor on %s sees neither', async (status) => {
    await renderLoaded(EXECUTOR, status);

    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument();
  });
});

describe('step 8 §4.4 «Task edit modal»: fields «Название», «Описание», «Исполнитель»; NO «Объект»', () => {
  it('opens «Редактировать задачу» prefilled from the task; executors loaded; no «Объект» field; fetchObjects not called', async () => {
    const user = userEvent.setup();
    const dialog = await openEditDialog(user);

    expect(within(dialog).getByLabelText('Название')).toHaveValue('Залить фундамент');
    expect(within(dialog).getByLabelText('Описание')).toHaveValue('Бетон М300');
    expect(within(dialog).queryByLabelText('Объект')).not.toBeInTheDocument();
    expect(fetchExecutors).toHaveBeenCalled();
    expect(fetchObjects).not.toHaveBeenCalled();
  });

  it('«Сохранить» sends updateTask("task-1", { title: trimmed, description: trimmed, assignee_id }) without object_id, closes the dialog and refetches the task', async () => {
    const user = userEvent.setup();
    const dialog = await openEditDialog(user);
    const callsBefore = vi.mocked(fetchTask).mock.calls.length;
    const titleInput = within(dialog).getByLabelText('Название');
    const descriptionInput = within(dialog).getByLabelText('Описание');

    await user.clear(titleInput);
    await user.type(titleInput, '  Новое название  ');
    await user.clear(descriptionInput);
    await user.type(descriptionInput, '  Бетон М400  ');
    await pickOption(user, dialog, 'Исполнитель', 'Алексей Морозов');
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledTimes(1);
    });

    expect(updateTask).toHaveBeenCalledWith('task-1', {
      title: 'Новое название',
      description: 'Бетон М400',
      assignee_id: 'exec-2',
    });

    const payload = vi.mocked(updateTask).mock.calls[0]?.[1];

    expect(Object.keys(payload ?? {}).sort()).toEqual(['assignee_id', 'description', 'title']);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: EDIT_DIALOG })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(vi.mocked(fetchTask).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('AC6: accepted task can be edited by the manager → updateTask("task-1", …)', async () => {
    const user = userEvent.setup();
    const dialog = await openEditDialog(user, 'accepted');
    const titleInput = within(dialog).getByLabelText('Название');

    await user.clear(titleInput);
    await user.type(titleInput, 'Принятая, правка');
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(updateTask).toHaveBeenCalledWith('task-1', {
        title: 'Принятая, правка',
        description: 'Бетон М300',
        assignee_id: 'exec-1',
      });
    });
  });

  it('clearing the title shows «Введите название» and nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openEditDialog(user);

    await user.clear(within(dialog).getByLabelText('Название'));
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await within(dialog).findByText('Введите название')).toBeInTheDocument();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it('rejects ASSIGNEE_NOT_EXECUTOR → text from §5.8, dialog stays open', async () => {
    vi.mocked(updateTask).mockRejectedValue(new Error('ASSIGNEE_NOT_EXECUTOR'));

    const user = userEvent.setup();
    const dialog = await openEditDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(
      await screen.findByText('Исполнителем может быть только пользователь с ролью «Исполнитель»'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: EDIT_DIALOG })).toBeInTheDocument();
  });

  it('rejects TASK_DELETED → «Задача находится в корзине»', async () => {
    vi.mocked(updateTask).mockRejectedValue(new Error('TASK_DELETED'));

    const user = userEvent.setup();
    const dialog = await openEditDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Задача находится в корзине')).toBeInTheDocument();
  });
});

describe('step 8 §4.4 «Удалить» (подтверждение «Удалить задачу?» / «Задача будет перемещена в корзину…»)', () => {
  it('«Отмена» sends nothing; confirming calls deleteTask("task-1") and opens the object card', async () => {
    const user = userEvent.setup();

    await renderLoaded(MANAGER, 'new');
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    let dialog = await screen.findByRole('dialog', { name: DELETE_DIALOG });

    expect(
      within(dialog).getByText('Задача будет перемещена в корзину. Восстановить её можно из корзины.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/Действие необратимо/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: DELETE_DIALOG })).not.toBeInTheDocument();
    });

    expect(deleteTask).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Удалить' }));
    dialog = await screen.findByRole('dialog', { name: DELETE_DIALOG });
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(deleteTask).toHaveBeenCalledWith('task-1');
    });

    expect(await screen.findByText(OBJECT_CARD_PROBE)).toBeInTheDocument();
  });

  it('accepted task can be deleted too (§12.2)', async () => {
    const user = userEvent.setup();

    await renderLoaded(MANAGER, 'accepted');
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    const dialog = await screen.findByRole('dialog', { name: DELETE_DIALOG });

    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(deleteTask).toHaveBeenCalledWith('task-1');
    });

    expect(await screen.findByText(OBJECT_CARD_PROBE)).toBeInTheDocument();
  });

  it('deleteTask rejects NOT_ALLOWED → «Недостаточно прав для этого действия», stays on the card', async () => {
    vi.mocked(deleteTask).mockRejectedValue(new Error('NOT_ALLOWED'));

    const user = userEvent.setup();

    await renderLoaded(MANAGER, 'new');
    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    const dialog = await screen.findByRole('dialog', { name: DELETE_DIALOG });

    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByText('Недостаточно прав для этого действия')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: HEADING })).toBeInTheDocument();
    expect(screen.queryByText(OBJECT_CARD_PROBE)).not.toBeInTheDocument();
  });
});
