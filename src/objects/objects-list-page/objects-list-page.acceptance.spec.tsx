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
import { createObject, fetchObjects } from '../objects-api/objects-api';
import type { ObjectSummary } from '../objects.type';
import { ObjectsListPage } from './objects-list-page';

vi.mock('../objects-api/objects-api', () => ({
  fetchObjects: vi.fn(),
  fetchObject: vi.fn(),
  createObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('../../tasks/tasks-api/tasks-api', () => ({
  fetchObjectTasks: vi.fn(),
  createTask: vi.fn(),
}));

vi.mock('../../profiles/profiles-api/profiles-api', () => ({
  fetchExecutors: vi.fn(),
}));

const MANAGER: Profile = { id: 'mgr-1', full_name: 'Иван Петров', role: 'manager' };
const EXECUTOR: Profile = { id: 'exec-1', full_name: 'Сергей Кузнецов', role: 'executor' };

const OBJECTS: ObjectSummary[] = [
  { id: 'obj-1', name: 'Дом на Ленина', address: 'ул. Ленина, 1', task_count: 3 },
  { id: 'obj-2', name: 'Склад', address: 'пр. Мира, 10', task_count: 0 },
];

const OBJECT_CARD_PROBE = 'OBJECT CARD PROBE';
const CREATE_DIALOG = 'Создать объект';

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

function renderList(profile: Profile): void {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/objects']}>
        <AuthContext.Provider value={fakeAuth(profile)}>
          <Routes>
            <Route path="/objects" element={<ObjectsListPage />} />
            <Route path="/objects/:objectId" element={<div>{OBJECT_CARD_PROBE}</div>} />
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

// Тестовый хелпер: менеджер открывает модалку создания объекта.
async function openCreateDialog(user: UserEvent): Promise<HTMLElement> {
  renderList(MANAGER);

  await user.click(await screen.findByRole('button', { name: 'Создать объект' }));

  return screen.findByRole('dialog', { name: CREATE_DIALOG });
}

async function pasteInto(user: UserEvent, input: HTMLElement, value: string): Promise<void> {
  await user.click(input);
  await user.paste(value);
}

beforeEach(() => {
  vi.mocked(fetchObjects).mockResolvedValue(OBJECTS);
  vi.mocked(createObject).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  act(() => {
    notifications.clean();
  });
});

describe('§8.3 п.2 «Список объектов»: heading', () => {
  it.each([
    ['manager', MANAGER],
    ['executor', EXECUTOR],
  ] as const)('%s sees heading «Объекты»', async (_role, profile) => {
    renderList(profile);

    expect(await screen.findByRole('heading', { name: 'Объекты' })).toBeInTheDocument();
  });
});

describe('§8.3 п.2 «Таблица: название, адрес, кол-во задач (видимых пользователю)»', () => {
  it('loads objects via fetchObjects() with no arguments', async () => {
    renderList(MANAGER);

    await screen.findByText('Дом на Ленина');

    expect(fetchObjects).toHaveBeenCalledWith();
  });

  it('renders column headers «Название», «Адрес», «Задач»', async () => {
    renderList(EXECUTOR);

    await screen.findByText('Дом на Ленина');

    expect(screen.getByRole('columnheader', { name: 'Название' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Адрес' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Задач' })).toBeInTheDocument();
  });

  it('each row shows the object name, address and task count', async () => {
    renderList(EXECUTOR);

    await screen.findByText('Дом на Ленина');

    const first = rowOf('Дом на Ленина');
    const second = rowOf('Склад');

    expect(within(first).getByText('ул. Ленина, 1')).toBeInTheDocument();
    expect(within(first).getByText('3')).toBeInTheDocument();
    expect(within(second).getByText('пр. Мира, 10')).toBeInTheDocument();
    expect(within(second).getByText('0')).toBeInTheDocument();
  });
});

describe('§8.3 п.2 «Клик → карточка»', () => {
  it('clicking a row navigates to /objects/<id>', async () => {
    const user = userEvent.setup();

    renderList(EXECUTOR);

    await user.click(await screen.findByText('Склад'));

    expect(await screen.findByText(OBJECT_CARD_PROBE)).toBeInTheDocument();
  });
});

describe('§8.3 п.2 «Manager: кнопка «Создать объект»»', () => {
  it('manager sees «Создать объект»', async () => {
    renderList(MANAGER);

    expect(await screen.findByRole('button', { name: 'Создать объект' })).toBeInTheDocument();
  });

  it('executor does not see «Создать объект»', async () => {
    renderList(EXECUTOR);

    await screen.findByText('Дом на Ленина');

    expect(screen.queryByRole('button', { name: 'Создать объект' })).not.toBeInTheDocument();
  });
});

describe('§8.3 п.2 empty state', () => {
  it('executor with no objects sees «У вас пока нет объектов»', async () => {
    vi.mocked(fetchObjects).mockResolvedValue([]);
    renderList(EXECUTOR);

    expect(await screen.findByText('У вас пока нет объектов')).toBeInTheDocument();
  });

  it('manager with no objects sees «Объектов пока нет»', async () => {
    vi.mocked(fetchObjects).mockResolvedValue([]);
    renderList(MANAGER);

    expect(await screen.findByText('Объектов пока нет')).toBeInTheDocument();
  });
});

describe('§8.3 п.2 «Создать объект» (модалка: название, адрес)', () => {
  it('submits trimmed { name, address } once, closes the dialog and refetches the list', async () => {
    const user = userEvent.setup();
    const dialog = await openCreateDialog(user);
    const callsBefore = vi.mocked(fetchObjects).mock.calls.length;

    await user.type(within(dialog).getByLabelText('Название'), '  Дом на Ленина  ');
    await user.type(within(dialog).getByLabelText('Адрес'), '  ул. Ленина, 1  ');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(createObject).toHaveBeenCalledTimes(1);
    });

    expect(createObject).toHaveBeenCalledWith({ name: 'Дом на Ленина', address: 'ул. Ленина, 1' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: CREATE_DIALOG })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(vi.mocked(fetchObjects).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});

describe('§5.3 validation: name trim 1..200, address trim 1..500', () => {
  it('empty submit shows «Введите название» and «Введите адрес», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openCreateDialog(user);

    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await within(dialog).findByText('Введите название')).toBeInTheDocument();
    expect(within(dialog).getByText('Введите адрес')).toBeInTheDocument();
    expect(createObject).not.toHaveBeenCalled();
  });

  it('whitespace-only values show «Введите название» and «Введите адрес», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openCreateDialog(user);

    await user.type(within(dialog).getByLabelText('Название'), '   ');
    await user.type(within(dialog).getByLabelText('Адрес'), '   ');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await within(dialog).findByText('Введите название')).toBeInTheDocument();
    expect(within(dialog).getByText('Введите адрес')).toBeInTheDocument();
    expect(createObject).not.toHaveBeenCalled();
  });

  it('name of 201 chars → «Не более 200 символов», address of 501 → «Не более 500 символов», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openCreateDialog(user);

    await pasteInto(user, within(dialog).getByLabelText('Название'), 'а'.repeat(201));
    await pasteInto(user, within(dialog).getByLabelText('Адрес'), 'б'.repeat(501));
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await within(dialog).findByText('Не более 200 символов')).toBeInTheDocument();
    expect(within(dialog).getByText('Не более 500 символов')).toBeInTheDocument();
    expect(createObject).not.toHaveBeenCalled();
  });

  it('name of exactly 200 chars and address of exactly 500 chars are accepted', async () => {
    const user = userEvent.setup();
    const dialog = await openCreateDialog(user);
    const name = 'а'.repeat(200);
    const address = 'б'.repeat(500);

    await pasteInto(user, within(dialog).getByLabelText('Название'), name);
    await pasteInto(user, within(dialog).getByLabelText('Адрес'), address);
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(createObject).toHaveBeenCalledWith({ name, address });
    });
  });
});

describe('§8.1 «Ошибки — Mantine notifications с текстом по коду (5.8)»', () => {
  it('createObject rejects NOT_ALLOWED → «Недостаточно прав для этого действия», dialog stays open', async () => {
    vi.mocked(createObject).mockRejectedValue(new Error('NOT_ALLOWED'));

    const user = userEvent.setup();
    const dialog = await openCreateDialog(user);

    await user.type(within(dialog).getByLabelText('Название'), 'Дом');
    await user.type(within(dialog).getByLabelText('Адрес'), 'ул. Мира, 2');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await screen.findByText('Недостаточно прав для этого действия')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: CREATE_DIALOG })).toBeInTheDocument();
  });

  it('createObject rejects with an unknown message → «Не удалось выполнить действие»', async () => {
    vi.mocked(createObject).mockRejectedValue(new Error('SOMETHING_UNEXPECTED'));

    const user = userEvent.setup();
    const dialog = await openCreateDialog(user);

    await user.type(within(dialog).getByLabelText('Название'), 'Дом');
    await user.type(within(dialog).getByLabelText('Адрес'), 'ул. Мира, 2');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await screen.findByText('Не удалось выполнить действие')).toBeInTheDocument();
  });
});
