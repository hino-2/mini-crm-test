import { notifications } from '@mantine/notifications';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import { AuthContext } from '../../auth/auth-context/auth-context';
import type { AuthContextValue } from '../../auth/auth.interfaces';
import type { Profile } from '../../auth/auth.type';
import { fetchMyTasks } from '../../tasks/tasks-api/tasks-api';
import type { MyTaskItem } from '../../tasks/tasks.type';
import { MyTasksPage } from './my-tasks-page';

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

const EXECUTOR: Profile = { id: 'exec-1', full_name: 'Сергей Кузнецов', role: 'executor' };

// Намеренно не отсортировано.
const MY_TASKS: MyTaskItem[] = [
  {
    id: 't-acc',
    title: 'Покраска',
    status: 'accepted',
    created_at: '2026-03-20T09:00:00Z',
    object: { name: 'Склад' },
  },
  {
    id: 't-new-old',
    title: 'Разметка',
    status: 'new',
    created_at: '2026-03-01T09:00:00Z',
    object: { name: 'Дом на Ленина' },
  },
  {
    id: 't-rew',
    title: 'Армирование',
    status: 'rework',
    created_at: '2026-02-01T09:00:00Z',
    object: { name: 'Дом на Ленина' },
  },
  {
    id: 't-new-new',
    title: 'Опалубка',
    status: 'new',
    created_at: '2026-03-10T09:00:00Z',
    object: { name: 'Склад' },
  },
  {
    id: 't-rev',
    title: 'Кладка',
    status: 'on_review',
    created_at: '2026-03-05T09:00:00Z',
    object: { name: 'Склад' },
  },
  {
    id: 't-prog',
    title: 'Стяжка',
    status: 'in_progress',
    created_at: '2026-03-06T09:00:00Z',
    object: { name: 'Дом на Ленина' },
  },
];

const EXPECTED_ORDER = ['Армирование', 'Опалубка', 'Разметка', 'Стяжка', 'Кладка', 'Покраска'];
const TASK_CARD_PROBE = 'TASK CARD PROBE';

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

function renderMyTasks(): void {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/my-tasks']}>
        <AuthContext.Provider value={fakeAuth(EXECUTOR)}>
          <Routes>
            <Route path="/my-tasks" element={<MyTasksPage />} />
            <Route path="/tasks/:taskId" element={<div>{TASK_CARD_PROBE}</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </AppProviders>,
  );
}

// Тестовый хелпер: строка таблицы, содержащая текст.
function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest('tr');

  if (!row) {
    throw new Error(`row with «${text}» not found`);
  }

  return row;
}

// Тестовый хелпер: названия задач в строках таблицы сверху вниз (первая ячейка).
function rowTitles(): string[] {
  const table = screen.getByRole('columnheader', { name: 'Название' }).closest('table');

  if (!table) {
    throw new Error('tasks table not found');
  }

  return within(table)
    .getAllByRole('row')
    .map((row) => within(row).queryAllByRole('cell').at(0)?.textContent ?? null)
    .filter((title): title is string => title !== null);
}

beforeEach(() => {
  vi.mocked(fetchMyTasks).mockResolvedValue(MY_TASKS);
});

afterEach(() => {
  vi.resetAllMocks();
  act(() => {
    notifications.clean();
  });
});

describe('§8.3 п.5 «Мои задачи (executor). Все задачи, где assignee_id = текущий»', () => {
  it('shows heading «Мои задачи» and loads tasks via fetchMyTasks("exec-1")', async () => {
    renderMyTasks();

    expect(await screen.findByRole('heading', { name: 'Мои задачи' })).toBeInTheDocument();
    expect(await screen.findByText('Армирование')).toBeInTheDocument();
    expect(fetchMyTasks).toHaveBeenCalledWith('exec-1');
  });

  it('renders column headers «Название», «Объект», «Статус», «Создана»', async () => {
    renderMyTasks();

    await screen.findByText('Армирование');

    expect(screen.getByRole('columnheader', { name: 'Название' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Объект' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Статус' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Создана' })).toBeInTheDocument();
  });

  it('each row shows title, object name, status label (§5.1) and ru-RU created date', async () => {
    renderMyTasks();

    await screen.findByText('Армирование');

    const rework = rowOf('Армирование');
    const accepted = rowOf('Покраска');

    expect(within(rework).getByText('Дом на Ленина')).toBeInTheDocument();
    expect(within(rework).getByText('На доработке')).toBeInTheDocument();
    expect(
      within(rework).getByText(new Date('2026-02-01T09:00:00Z').toLocaleString('ru-RU')),
    ).toBeInTheDocument();
    expect(within(accepted).getByText('Склад')).toBeInTheDocument();
    expect(within(accepted).getByText('Принята')).toBeInTheDocument();
    expect(
      within(accepted).getByText(new Date('2026-03-20T09:00:00Z').toLocaleString('ru-RU')),
    ).toBeInTheDocument();
  });
});

describe('§8.3 п.5 «Сортировка: rework, new, in_progress, on_review, accepted, затем по created_at desc»', () => {
  it('rows are ordered Армирование, Опалубка, Разметка, Стяжка, Кладка, Покраска', async () => {
    renderMyTasks();

    await screen.findByText('Армирование');

    expect(rowTitles()).toEqual(EXPECTED_ORDER);
  });
});

describe('§8.3 п.5 «Фильтр по статусу, «Все» по умолчанию»', () => {
  it('offers «Все», «На доработке», «Новая», «В работе», «На проверке», «Принята»; «Все» is checked', async () => {
    renderMyTasks();

    await screen.findByText('Армирование');

    for (const name of ['Все', 'На доработке', 'Новая', 'В работе', 'На проверке', 'Принята']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }

    expect(screen.getByRole('radio', { name: 'Все' })).toBeChecked();
  });

  it('«Новая» keeps only new tasks in sort order; «Все» brings all back; no extra fetchMyTasks call', async () => {
    const user = userEvent.setup();

    renderMyTasks();

    await screen.findByText('Армирование');

    const callsBefore = vi.mocked(fetchMyTasks).mock.calls.length;

    await user.click(screen.getByRole('radio', { name: 'Новая' }));

    expect(rowTitles()).toEqual(['Опалубка', 'Разметка']);

    await user.click(screen.getByRole('radio', { name: 'Все' }));

    expect(rowTitles()).toEqual(EXPECTED_ORDER);
    expect(vi.mocked(fetchMyTasks).mock.calls.length).toBe(callsBefore);
  });

  it('filter with no matching tasks → «Нет задач с таким статусом»', async () => {
    vi.mocked(fetchMyTasks).mockResolvedValue(MY_TASKS.filter((task) => task.status !== 'accepted'));

    const user = userEvent.setup();

    renderMyTasks();

    await screen.findByText('Армирование');
    await user.click(screen.getByRole('radio', { name: 'Принята' }));

    expect(await screen.findByText('Нет задач с таким статусом')).toBeInTheDocument();
  });
});

describe('§8.3 п.5 empty state', () => {
  it('no tasks at all → «У вас пока нет задач»', async () => {
    vi.mocked(fetchMyTasks).mockResolvedValue([]);
    renderMyTasks();

    expect(await screen.findByText('У вас пока нет задач')).toBeInTheDocument();
  });
});

describe('§8.3 п.5 row link to the task card (a11y)', () => {
  it('title is a link to /tasks/<id>; clicking it opens the task card', async () => {
    const user = userEvent.setup();

    renderMyTasks();

    const link = await screen.findByRole('link', { name: 'Армирование' });

    expect(link).toHaveAttribute('href', '/tasks/t-rew');

    await user.click(link);

    expect(await screen.findByText(TASK_CARD_PROBE)).toBeInTheDocument();
  });
});
