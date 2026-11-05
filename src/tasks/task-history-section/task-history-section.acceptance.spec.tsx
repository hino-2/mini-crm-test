import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import { AuthContext } from '../../auth/auth-context/auth-context';
import type { AuthContextValue } from '../../auth/auth.interfaces';
import type { Profile } from '../../auth/auth.type';
import { fetchObjects } from '../../objects/objects-api/objects-api';
import { fetchExecutors } from '../../profiles/profiles-api/profiles-api';
import { fetchTask, fetchTaskHistory } from '../tasks-api/tasks-api';
import { TaskCardPage } from '../task-card-page/task-card-page';
import type { TaskDetails, TaskHistoryEntry } from '../tasks.type';

vi.mock('../tasks-api/tasks-api', () => ({
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

// API-порядок намеренно не хронологический в последней строке: UI не пересортировывает.
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
    kind: 'field',
    id: 1,
    field: 'title',
    old_value: 'Фундамент',
    new_value: 'Залить фундамент',
    changed_at: '2026-03-15T10:00:00Z',
    actor: { full_name: 'Иван Петров' },
  },
  {
    kind: 'field',
    id: 2,
    field: 'assignee_id',
    old_value: 'Алексей Морозов',
    new_value: 'Сергей Кузнецов',
    changed_at: '2026-03-15T11:00:00Z',
    actor: { full_name: 'Иван Петров' },
  },
  {
    kind: 'field',
    id: 3,
    field: 'description',
    old_value: '',
    new_value: 'Бетон М300',
    changed_at: '2026-03-15T12:00:00Z',
    actor: { full_name: 'Иван Петров' },
  },
  {
    kind: 'status',
    id: 2,
    from_status: 'on_review',
    to_status: 'rework',
    changed_at: '2026-03-16T08:00:00Z',
    comment: 'Нет арматуры',
    actor: { full_name: 'Ольга Смирнова' },
  },
  {
    kind: 'field',
    id: 4,
    field: 'deleted_at',
    old_value: null,
    new_value: '2026-03-17T09:00:00+00:00',
    changed_at: '2026-03-17T09:00:00Z',
    actor: { full_name: 'Иван Петров' },
  },
  {
    kind: 'field',
    id: 5,
    field: 'deleted_at',
    old_value: '2026-03-17T09:00:00+00:00',
    new_value: null,
    changed_at: '2026-03-18T09:00:00Z',
    actor: null,
  },
  {
    kind: 'field',
    id: 6,
    field: 'description',
    old_value: 'Бетон М300',
    new_value: '',
    changed_at: '2026-03-01T09:00:00Z',
    actor: { full_name: 'Ольга Смирнова' },
  },
];

const ROW = {
  created: 0,
  title: 1,
  assignee: 2,
  descriptionFilled: 3,
  rework: 4,
  deleted: 5,
  restored: 6,
  descriptionCleared: 7,
} as const;

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU');
}

async function renderHistory(): Promise<HTMLElement[]> {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/tasks/task-1']}>
        <AuthContext.Provider value={fakeAuth(EXECUTOR)}>
          <Routes>
            <Route path="/tasks/:taskId" element={<TaskCardPage />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </AppProviders>,
  );

  await screen.findByText('Создана');

  const table = screen.getByRole('columnheader', { name: 'Изменение' }).closest('table');

  if (!table) {
    throw new Error('history table not found');
  }

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

// Тестовый хелпер: ячейка по индексу колонки (Дата, Кто, Изменение, Комментарий).
function cell(row: HTMLElement, index: number): HTMLElement {
  const found = within(row).getAllByRole('cell').at(index);

  if (!found) {
    throw new Error(`cell #${index} not found`);
  }

  return found;
}

beforeEach(() => {
  vi.mocked(fetchTask).mockResolvedValue(TASK);
  vi.mocked(fetchTaskHistory).mockResolvedValue(HISTORY);
  vi.mocked(fetchExecutors).mockResolvedValue([]);
  vi.mocked(fetchObjects).mockResolvedValue([]);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('step 8 §4.4 History section: heading «История», headers «Дата», «Кто», «Изменение», «Комментарий»', () => {
  it('renders heading and headers; history loaded via fetchTaskHistory("task-1")', async () => {
    await renderHistory();

    expect(fetchTaskHistory).toHaveBeenCalledWith('task-1');
    expect(screen.getByRole('heading', { name: 'История' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Дата' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Кто' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Изменение' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Комментарий' })).toBeInTheDocument();
  });

  it('«Rows in API order (no re-sort)»: one row per entry, last row is the earliest-dated entry', async () => {
    const rows = await renderHistory();

    expect(rows).toHaveLength(HISTORY.length);
    expect(
      within(nth(rows, ROW.descriptionCleared)).getByText(formatDate('2026-03-01T09:00:00Z')),
    ).toBeInTheDocument();
    expect(within(nth(rows, ROW.created)).getByText('Создана')).toBeInTheDocument();
  });
});

describe('step 8 §4.4 «Изменение» for status entries stays unchanged', () => {
  it('creation → «Создана»; transition → «На проверке → На доработке» with its comment', async () => {
    const rows = await renderHistory();
    const created = nth(rows, ROW.created);
    const rework = nth(rows, ROW.rework);

    expect(within(created).getByText('Создана')).toBeInTheDocument();
    expect(within(created).getByText('Иван Петров')).toBeInTheDocument();
    expect(within(created).getByText(formatDate('2026-03-15T09:30:00Z'))).toBeInTheDocument();
    expect(within(rework).getByText('На проверке → На доработке')).toBeInTheDocument();
    expect(within(rework).getByText('Ольга Смирнова')).toBeInTheDocument();
    expect(cell(rework, 3)).toHaveTextContent('Нет арматуры');
  });
});

describe('step 8 §4.4 «Изменение» for field entries', () => {
  it('title: «Изменено поле «Название»: «{old}» → «{new}»», ru-RU date and actor', async () => {
    const rows = await renderHistory();
    const row = nth(rows, ROW.title);

    expect(
      within(row).getByText('Изменено поле «Название»: «Фундамент» → «Залить фундамент»'),
    ).toBeInTheDocument();
    expect(within(row).getByText('Иван Петров')).toBeInTheDocument();
    expect(within(row).getByText(formatDate('2026-03-15T10:00:00Z'))).toBeInTheDocument();
  });

  it('assignee_id: «Изменено поле «Исполнитель»: {oldName} → {newName}»', async () => {
    const rows = await renderHistory();

    expect(
      within(nth(rows, ROW.assignee)).getByText(
        'Изменено поле «Исполнитель»: Алексей Морозов → Сергей Кузнецов',
      ),
    ).toBeInTheDocument();
  });

  it('description: «Изменено поле «Описание»», «Было: (пусто)» and «Стало: {new}» when old is empty', async () => {
    const rows = await renderHistory();
    const row = nth(rows, ROW.descriptionFilled);

    expect(within(row).getByText('Изменено поле «Описание»')).toBeInTheDocument();
    expect(within(row).getByText('Было: (пусто)')).toBeInTheDocument();
    expect(within(row).getByText('Стало: Бетон М300')).toBeInTheDocument();
  });

  it('description: «Было: {old}» and «Стало: (пусто)» when new is empty', async () => {
    const rows = await renderHistory();
    const row = nth(rows, ROW.descriptionCleared);

    expect(within(row).getByText('Изменено поле «Описание»')).toBeInTheDocument();
    expect(within(row).getByText('Было: Бетон М300')).toBeInTheDocument();
    expect(within(row).getByText('Стало: (пусто)')).toBeInTheDocument();
  });

  it('deleted_at with old_value null → «Задача перемещена в корзину»', async () => {
    const rows = await renderHistory();

    expect(
      within(nth(rows, ROW.deleted)).getByText('Задача перемещена в корзину'),
    ).toBeInTheDocument();
  });

  it('deleted_at with old_value set → «Задача восстановлена из корзины»', async () => {
    const rows = await renderHistory();

    expect(
      within(nth(rows, ROW.restored)).getByText('Задача восстановлена из корзины'),
    ).toBeInTheDocument();
  });
});

describe('step 8 §4.4 «Кто» and «Комментарий» for field entries', () => {
  it('actor null → «Кто» = «Система»', async () => {
    const rows = await renderHistory();

    expect(cell(nth(rows, ROW.restored), 1)).toHaveTextContent('Система');
  });

  it('actor present → «Кто» = actor.full_name', async () => {
    const rows = await renderHistory();

    expect(cell(nth(rows, ROW.deleted), 1)).toHaveTextContent('Иван Петров');
  });

  it.each([
    ['title', ROW.title],
    ['assignee_id', ROW.assignee],
    ['description', ROW.descriptionFilled],
    ['deleted_at (deleted)', ROW.deleted],
    ['deleted_at (restored)', ROW.restored],
  ] as const)('%s row has an empty «Комментарий» cell', async (_field, index) => {
    const rows = await renderHistory();

    expect(cell(nth(rows, index), 3).textContent).toBe('');
  });
});
