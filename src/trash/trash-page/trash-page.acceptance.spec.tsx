import { notifications } from '@mantine/notifications';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import { AuthContext } from '../../auth/auth-context/auth-context';
import type { AuthContextValue } from '../../auth/auth.interfaces';
import type { Profile } from '../../auth/auth.type';
import {
  fetchDeletedObjects,
  fetchDeletedTasks,
  restoreObject,
  restoreTask,
} from '../trash-api/trash-api';
import type { DeletedObject, DeletedTask } from '../trash.type';
import { TrashPage } from './trash-page';

vi.mock('../trash-api/trash-api', () => ({
  fetchDeletedObjects: vi.fn(),
  fetchDeletedTasks: vi.fn(),
  restoreObject: vi.fn(),
  restoreTask: vi.fn(),
}));

const MANAGER: Profile = { id: 'mgr-1', full_name: 'Иван Петров', role: 'manager' };

const DELETED_OBJECTS: DeletedObject[] = [
  {
    id: 'obj-1',
    name: 'Дом на Ленина',
    address: 'ул. Ленина, 1',
    deleted_at: '2026-03-20T10:00:00Z',
    deleted_by_name: 'Иван Петров',
  },
  {
    id: 'obj-2',
    name: 'Склад',
    address: 'пр. Мира, 10',
    deleted_at: '2026-03-19T08:15:00Z',
    deleted_by_name: null,
  },
];

const DELETED_TASKS: DeletedTask[] = [
  {
    id: 'task-1',
    title: 'Залить фундамент',
    object_id: 'obj-3',
    object_name: 'Гараж',
    object_deleted: false,
    deleted_at: '2026-03-18T12:30:00Z',
    deleted_by_name: 'Ольга Смирнова',
  },
  {
    id: 'task-2',
    title: 'Возвести стены',
    object_id: 'obj-1',
    object_name: 'Дом на Ленина',
    object_deleted: true,
    deleted_at: '2026-03-17T07:45:00Z',
    deleted_by_name: null,
  },
];

const RESTORE = 'Восстановить';
const OBJECT_IN_TRASH = 'объект в корзине';

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

function renderTrash(): void {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/trash']}>
        <AuthContext.Provider value={fakeAuth(MANAGER)}>
          <TrashPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </AppProviders>,
  );
}

async function renderLoaded(): Promise<void> {
  renderTrash();

  await screen.findByText('ул. Ленина, 1');
  await screen.findByText('Залить фундамент');
}

// Тестовый хелпер: строка таблицы, содержащая уникальный текст.
function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest('tr');

  if (!row) {
    throw new Error(`row with «${text}» not found`);
  }

  return row;
}

// Тестовый хелпер: таблица, у которой есть заголовок колонки с этим именем.
function tableWithHeader(name: string): HTMLElement {
  const table = screen.getByRole('columnheader', { name }).closest('table');

  if (!table) {
    throw new Error(`table with header «${name}» not found`);
  }

  return table;
}

function headerTexts(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole('columnheader')
    .map((header) => (header.textContent ?? '').trim());
}

function restoreIn(row: HTMLElement): HTMLElement {
  return within(row).getByRole('button', { name: RESTORE });
}

beforeEach(() => {
  vi.mocked(fetchDeletedObjects).mockResolvedValue(DELETED_OBJECTS);
  vi.mocked(fetchDeletedTasks).mockResolvedValue(DELETED_TASKS);
  vi.mocked(restoreObject).mockResolvedValue(undefined);
  vi.mocked(restoreTask).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  act(() => {
    notifications.clean();
  });
});

describe('step 8 §4.4 Trash page: heading «Корзина» (order 2), sections (order 3)', () => {
  it('shows h2 «Корзина», h3 «Удалённые объекты» and h3 «Удалённые задачи»', async () => {
    await renderLoaded();

    expect(screen.getByRole('heading', { level: 2, name: 'Корзина' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Удалённые объекты' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Удалённые задачи' })).toBeInTheDocument();
    expect(fetchDeletedObjects).toHaveBeenCalled();
    expect(fetchDeletedTasks).toHaveBeenCalled();
  });
});

describe('step 8 §4.4 «Удалённые объекты» section', () => {
  it('headers «Название», «Адрес», «Удалён», «Кто удалил» + empty action header', async () => {
    await renderLoaded();

    expect(headerTexts(tableWithHeader('Адрес'))).toEqual([
      'Название',
      'Адрес',
      'Удалён',
      'Кто удалил',
      '',
    ]);
  });

  it('row shows name, address, ru-RU deleted_at and deleted_by_name', async () => {
    await renderLoaded();

    const row = rowOf('ул. Ленина, 1');

    expect(within(row).getByText('Дом на Ленина')).toBeInTheDocument();
    expect(within(row).getByText(formatDate('2026-03-20T10:00:00Z'))).toBeInTheDocument();
    expect(within(row).getByText('Иван Петров')).toBeInTheDocument();
    expect(restoreIn(row)).toBeEnabled();
  });

  it('deleted_by_name null → «Система»', async () => {
    await renderLoaded();

    const row = rowOf('пр. Мира, 10');

    expect(within(row).getByText('Склад')).toBeInTheDocument();
    expect(within(row).getByText(formatDate('2026-03-19T08:15:00Z'))).toBeInTheDocument();
    expect(within(row).getByText('Система')).toBeInTheDocument();
  });

  it('names are plain text, not links', async () => {
    await renderLoaded();

    expect(within(rowOf('ул. Ленина, 1')).queryByRole('link')).not.toBeInTheDocument();
    expect(within(rowOf('пр. Мира, 10')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('empty list → «Нет удалённых объектов»', async () => {
    vi.mocked(fetchDeletedObjects).mockResolvedValue([]);
    renderTrash();

    expect(await screen.findByText('Нет удалённых объектов')).toBeInTheDocument();
  });
});

describe('step 8 §4.4 «Удалённые задачи» section', () => {
  it('headers «Название», «Объект», «Удалена», «Кто удалил» + empty action header', async () => {
    await renderLoaded();

    expect(headerTexts(tableWithHeader('Удалена'))).toEqual([
      'Название',
      'Объект',
      'Удалена',
      'Кто удалил',
      '',
    ]);
  });

  it('row shows title, object_name, ru-RU deleted_at and deleted_by_name; «Восстановить» enabled when object active', async () => {
    await renderLoaded();

    const row = rowOf('Залить фундамент');

    expect(within(row).getByText('Гараж')).toBeInTheDocument();
    expect(within(row).getByText(formatDate('2026-03-18T12:30:00Z'))).toBeInTheDocument();
    expect(within(row).getByText('Ольга Смирнова')).toBeInTheDocument();
    expect(within(row).queryByText(OBJECT_IN_TRASH)).not.toBeInTheDocument();
    expect(restoreIn(row)).toBeEnabled();
  });

  it('object_deleted → «Объект» cell has object_name and «объект в корзине»; «Восстановить» disabled; deleted_by_name null → «Система»', async () => {
    await renderLoaded();

    const row = rowOf('Возвести стены');

    expect(within(row).getByText('Дом на Ленина')).toBeInTheDocument();
    expect(within(row).getByText(OBJECT_IN_TRASH)).toBeInTheDocument();
    expect(within(row).getByText('Система')).toBeInTheDocument();
    expect(within(row).getByText(formatDate('2026-03-17T07:45:00Z'))).toBeInTheDocument();
    expect(restoreIn(row)).toBeDisabled();
  });

  it('names are plain text, not links', async () => {
    await renderLoaded();

    expect(within(rowOf('Залить фундамент')).queryByRole('link')).not.toBeInTheDocument();
    expect(within(rowOf('Возвести стены')).queryByRole('link')).not.toBeInTheDocument();
  });

  it('empty list → «Нет удалённых задач»', async () => {
    vi.mocked(fetchDeletedTasks).mockResolvedValue([]);
    renderTrash();

    expect(await screen.findByText('Нет удалённых задач')).toBeInTheDocument();
  });

  it('both lists empty → both empty texts', async () => {
    vi.mocked(fetchDeletedObjects).mockResolvedValue([]);
    vi.mocked(fetchDeletedTasks).mockResolvedValue([]);
    renderTrash();

    expect(await screen.findByText('Нет удалённых объектов')).toBeInTheDocument();
    expect(await screen.findByText('Нет удалённых задач')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: RESTORE })).not.toBeInTheDocument();
  });
});

describe('step 8 §4.4 «Восстановить» → restoreObject(id) / restoreTask(id), lists refetched', () => {
  it('object «Восстановить» → restoreObject("obj-1"), both lists refetched', async () => {
    const user = userEvent.setup();

    await renderLoaded();

    const objectsBefore = vi.mocked(fetchDeletedObjects).mock.calls.length;
    const tasksBefore = vi.mocked(fetchDeletedTasks).mock.calls.length;

    await user.click(restoreIn(rowOf('ул. Ленина, 1')));

    await waitFor(() => {
      expect(restoreObject).toHaveBeenCalledTimes(1);
    });

    expect(vi.mocked(restoreObject).mock.calls[0]?.[0]).toBe('obj-1');
    expect(restoreTask).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(vi.mocked(fetchDeletedObjects).mock.calls.length).toBeGreaterThan(objectsBefore);
    });

    await waitFor(() => {
      expect(vi.mocked(fetchDeletedTasks).mock.calls.length).toBeGreaterThan(tasksBefore);
    });
  });

  it('task «Восстановить» → restoreTask("task-1"), both lists refetched', async () => {
    const user = userEvent.setup();

    await renderLoaded();

    const objectsBefore = vi.mocked(fetchDeletedObjects).mock.calls.length;
    const tasksBefore = vi.mocked(fetchDeletedTasks).mock.calls.length;

    await user.click(restoreIn(rowOf('Залить фундамент')));

    await waitFor(() => {
      expect(restoreTask).toHaveBeenCalledTimes(1);
    });

    expect(vi.mocked(restoreTask).mock.calls[0]?.[0]).toBe('task-1');
    expect(restoreObject).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(vi.mocked(fetchDeletedTasks).mock.calls.length).toBeGreaterThan(tasksBefore);
    });

    await waitFor(() => {
      expect(vi.mocked(fetchDeletedObjects).mock.calls.length).toBeGreaterThan(objectsBefore);
    });
  });

  it('restored item disappears after refetch', async () => {
    const user = userEvent.setup();

    await renderLoaded();

    vi.mocked(fetchDeletedObjects).mockResolvedValue(
      DELETED_OBJECTS.filter((object) => object.id !== 'obj-2'),
    );
    await user.click(restoreIn(rowOf('пр. Мира, 10')));

    await waitFor(() => {
      expect(screen.queryByText('пр. Мира, 10')).not.toBeInTheDocument();
    });

    expect(vi.mocked(restoreObject).mock.calls[0]?.[0]).toBe('obj-2');
  });

  it('disabled task «Восстановить» (object_deleted) does not call restoreTask', async () => {
    const user = userEvent.setup();

    await renderLoaded();
    await user.click(restoreIn(rowOf('Возвести стены')));

    expect(restoreTask).not.toHaveBeenCalled();
  });
});

describe("step 8 §4.4 «All «Восстановить» buttons of a section disabled while that section's restore is pending»", () => {
  it('pending restoreObject disables every object «Восстановить»; task section unaffected', async () => {
    vi.mocked(restoreObject).mockReturnValue(new Promise<void>(() => undefined));

    const user = userEvent.setup();

    await renderLoaded();
    await user.click(restoreIn(rowOf('ул. Ленина, 1')));

    await waitFor(() => {
      expect(restoreIn(rowOf('ул. Ленина, 1'))).toBeDisabled();
    });

    expect(restoreIn(rowOf('пр. Мира, 10'))).toBeDisabled();
    expect(restoreIn(rowOf('Залить фундамент'))).toBeEnabled();
  });

  it('pending restoreTask disables every task «Восстановить»; object section unaffected', async () => {
    vi.mocked(fetchDeletedTasks).mockResolvedValue([
      ...DELETED_TASKS,
      {
        id: 'task-3',
        title: 'Покраска',
        object_id: 'obj-3',
        object_name: 'Гараж',
        object_deleted: false,
        deleted_at: '2026-03-16T07:00:00Z',
        deleted_by_name: 'Иван Петров',
      },
    ]);
    vi.mocked(restoreTask).mockReturnValue(new Promise<void>(() => undefined));

    const user = userEvent.setup();

    await renderLoaded();
    await user.click(restoreIn(rowOf('Залить фундамент')));

    await waitFor(() => {
      expect(restoreIn(rowOf('Залить фундамент'))).toBeDisabled();
    });

    expect(restoreIn(rowOf('Покраска'))).toBeDisabled();
    expect(restoreIn(rowOf('ул. Ленина, 1'))).toBeEnabled();
  });
});

describe('step 8 §4.4 «Errors via notifyError»', () => {
  it('restoreTask rejects OBJECT_DELETED → «Объект находится в корзине — сначала восстановите его»', async () => {
    vi.mocked(restoreTask).mockRejectedValue(new Error('OBJECT_DELETED'));

    const user = userEvent.setup();

    await renderLoaded();
    await user.click(restoreIn(rowOf('Залить фундамент')));

    expect(
      await screen.findByText('Объект находится в корзине — сначала восстановите его'),
    ).toBeInTheDocument();
  });

  it('restoreObject rejects NOT_ALLOWED → «Недостаточно прав для этого действия»', async () => {
    vi.mocked(restoreObject).mockRejectedValue(new Error('NOT_ALLOWED'));

    const user = userEvent.setup();

    await renderLoaded();
    await user.click(restoreIn(rowOf('ул. Ленина, 1')));

    expect(await screen.findByText('Недостаточно прав для этого действия')).toBeInTheDocument();
  });

  it('restoreObject rejects OBJECT_NOT_FOUND → «Объект не найден»', async () => {
    vi.mocked(restoreObject).mockRejectedValue(new Error('OBJECT_NOT_FOUND'));

    const user = userEvent.setup();

    await renderLoaded();
    await user.click(restoreIn(rowOf('ул. Ленина, 1')));

    expect(await screen.findByText('Объект не найден')).toBeInTheDocument();
  });

  it('restoreTask rejects TASK_NOT_FOUND → «Задача не найдена»', async () => {
    vi.mocked(restoreTask).mockRejectedValue(new Error('TASK_NOT_FOUND'));

    const user = userEvent.setup();

    await renderLoaded();
    await user.click(restoreIn(rowOf('Залить фундамент')));

    expect(await screen.findByText('Задача не найдена')).toBeInTheDocument();
  });
});
