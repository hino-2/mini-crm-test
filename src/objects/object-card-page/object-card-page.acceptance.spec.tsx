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
import { fetchExecutors } from '../../profiles/profiles-api/profiles-api';
import { createTask, fetchObjectTasks } from '../../tasks/tasks-api/tasks-api';
import type { TaskListItem } from '../../tasks/tasks.type';
import { deleteObject, fetchObject, updateObject } from '../objects-api/objects-api';
import type { ObjectSummary } from '../objects.type';
import { ObjectCardPage } from './object-card-page';

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

const OBJECT: ObjectSummary = {
  id: 'obj-1',
  name: 'Дом на Ленина',
  address: 'ул. Ленина, 1',
  task_count: 3,
};

const TASKS: TaskListItem[] = [
  {
    id: 'task-1',
    title: 'Залить фундамент',
    status: 'rework',
    created_at: '2026-03-15T09:30:00Z',
    assignee: { full_name: 'Сергей Кузнецов' },
  },
  {
    id: 'task-2',
    title: 'Возвести стены',
    status: 'new',
    created_at: '2026-04-01T14:05:00Z',
    assignee: { full_name: 'Алексей Морозов' },
  },
];

const EXECUTORS = [
  { id: 'exec-1', full_name: 'Сергей Кузнецов' },
  { id: 'exec-2', full_name: 'Алексей Морозов' },
];

const OBJECTS_LIST_PROBE = 'OBJECTS LIST PROBE';
const TASK_CARD_PROBE = 'TASK CARD PROBE';
const EDIT_DIALOG = 'Редактировать объект';
const DELETE_DIALOG = 'Удалить объект?';
const TASK_DIALOG = 'Создать задачу';

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

function renderCard(profile: Profile): void {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/objects/obj-1']}>
        <AuthContext.Provider value={fakeAuth(profile)}>
          <Routes>
            <Route path="/objects" element={<div>{OBJECTS_LIST_PROBE}</div>} />
            <Route path="/objects/:objectId" element={<ObjectCardPage />} />
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

async function pasteInto(user: UserEvent, input: HTMLElement, value: string): Promise<void> {
  await user.click(input);
  await user.paste(value);
}

// Тестовый хелпер: менеджер открывает карточку и модалку по кнопке.
async function openDialog(user: UserEvent, button: string, dialog: string): Promise<HTMLElement> {
  renderCard(MANAGER);

  await user.click(await screen.findByRole('button', { name: button }));

  return screen.findByRole('dialog', { name: dialog });
}

// Тестовый хелпер: выбор исполнителя в Select (опции рендерятся в портале).
async function pickAssignee(user: UserEvent, dialog: HTMLElement, name: string): Promise<void> {
  const select = within(dialog).getByLabelText('Исполнитель');

  await waitFor(() => {
    expect(select).toBeEnabled();
  });

  await user.click(select);
  await user.click(await screen.findByRole('option', { name }));
}

beforeEach(() => {
  vi.mocked(fetchObject).mockResolvedValue(OBJECT);
  vi.mocked(fetchObjectTasks).mockResolvedValue(TASKS);
  vi.mocked(fetchExecutors).mockResolvedValue(EXECUTORS);
  vi.mocked(updateObject).mockResolvedValue(undefined);
  vi.mocked(deleteObject).mockResolvedValue(undefined);
  vi.mocked(createTask).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.resetAllMocks();
  act(() => {
    notifications.clean();
  });
});

describe('§8.3 п.3 «Карточка объекта. Название, адрес»', () => {
  it('shows heading «Карточка объекта», the object name and address loaded by fetchObject("obj-1")', async () => {
    renderCard(EXECUTOR);

    expect(await screen.findByRole('heading', { name: 'Карточка объекта' })).toBeInTheDocument();
    expect(await screen.findByText('Дом на Ленина')).toBeInTheDocument();
    expect(screen.getByText('ул. Ленина, 1')).toBeInTheDocument();
    expect(fetchObject).toHaveBeenCalledWith('obj-1');
  });

  it('loads the object tasks via fetchObjectTasks("obj-1")', async () => {
    renderCard(EXECUTOR);

    await screen.findByText('Залить фундамент');

    expect(fetchObjectTasks).toHaveBeenCalledWith('obj-1');
  });
});

describe('§8.2 «Если объект/задача не найдены (RLS вернул пусто) — «Не найдено или нет доступа»»', () => {
  it.each([
    ['manager', MANAGER],
    ['executor', EXECUTOR],
  ] as const)(
    '%s: fetchObject → null shows «Не найдено или нет доступа», no actions, tasks are not loaded',
    async (_role, profile) => {
      vi.mocked(fetchObject).mockResolvedValue(null);
      renderCard(profile);

      expect(await screen.findByText('Не найдено или нет доступа')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Карточка объекта' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Создать задачу' })).not.toBeInTheDocument();
      expect(fetchObjectTasks).not.toHaveBeenCalled();
    },
  );
});

describe('§8.3 п.3 manager-only actions «Редактировать», «Удалить», «Создать задачу»', () => {
  it('manager sees «Редактировать», «Удалить», «Создать задачу»', async () => {
    renderCard(MANAGER);

    expect(await screen.findByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Удалить' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Создать задачу' })).toBeInTheDocument();
  });

  it('executor sees none of them but sees the tasks table', async () => {
    renderCard(EXECUTOR);

    expect(await screen.findByText('Залить фундамент')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Редактировать' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Создать задачу' })).not.toBeInTheDocument();
  });
});

describe('§8.3 п.3 «Список задач: название, исполнитель, статус (цветной бейдж), дата создания»', () => {
  it('renders column headers «Название», «Исполнитель», «Статус», «Создана»', async () => {
    renderCard(EXECUTOR);

    await screen.findByText('Залить фундамент');

    expect(screen.getByRole('columnheader', { name: 'Название' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Исполнитель' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Статус' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Создана' })).toBeInTheDocument();
  });

  it('each row shows title, assignee name, status label (§5.1) and created date in ru-RU', async () => {
    renderCard(MANAGER);

    await screen.findByText('Залить фундамент');

    const first = rowOf('Залить фундамент');
    const second = rowOf('Возвести стены');

    expect(within(first).getByText('Сергей Кузнецов')).toBeInTheDocument();
    expect(within(first).getByText('На доработке')).toBeInTheDocument();
    expect(
      within(first).getByText(new Date('2026-03-15T09:30:00Z').toLocaleString('ru-RU')),
    ).toBeInTheDocument();
    expect(within(second).getByText('Алексей Морозов')).toBeInTheDocument();
    expect(within(second).getByText('Новая')).toBeInTheDocument();
    expect(
      within(second).getByText(new Date('2026-04-01T14:05:00Z').toLocaleString('ru-RU')),
    ).toBeInTheDocument();
  });

  it('no tasks → «Задач пока нет»', async () => {
    vi.mocked(fetchObjectTasks).mockResolvedValue([]);
    renderCard(MANAGER);

    expect(await screen.findByText('Задач пока нет')).toBeInTheDocument();
  });
});

describe('§8.3 п.3 «клик → карточка задачи»', () => {
  it('clicking a task row navigates to /tasks/<id>', async () => {
    const user = userEvent.setup();

    renderCard(EXECUTOR);

    await user.click(await screen.findByText('Возвести стены'));

    expect(await screen.findByText(TASK_CARD_PROBE)).toBeInTheDocument();
  });
});

describe('§8.3 п.3 «Редактировать» (модалка)', () => {
  it('opens «Редактировать объект» prefilled with current name and address', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Редактировать', EDIT_DIALOG);

    expect(within(dialog).getByLabelText('Название')).toHaveValue('Дом на Ленина');
    expect(within(dialog).getByLabelText('Адрес')).toHaveValue('ул. Ленина, 1');
  });

  it('«Сохранить» sends updateObject("obj-1", trimmed values), closes the dialog and refetches the object', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Редактировать', EDIT_DIALOG);
    const callsBefore = vi.mocked(fetchObject).mock.calls.length;
    const nameInput = within(dialog).getByLabelText('Название');

    await user.clear(nameInput);
    await user.type(nameInput, '  Новое имя  ');
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(updateObject).toHaveBeenCalledTimes(1);
    });

    expect(updateObject).toHaveBeenCalledWith('obj-1', {
      name: 'Новое имя',
      address: 'ул. Ленина, 1',
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: EDIT_DIALOG })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(vi.mocked(fetchObject).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('clearing the name shows «Введите название» and nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Редактировать', EDIT_DIALOG);

    await user.clear(within(dialog).getByLabelText('Название'));
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }));

    expect(await within(dialog).findByText('Введите название')).toBeInTheDocument();
    expect(updateObject).not.toHaveBeenCalled();
  });
});

describe('step 8 §4.4 «Удалить» — подтверждение «Объект будет перемещён в корзину вместе с задачами: N…»', () => {
  it('confirmation shows N = task_count; «Отмена» sends nothing; confirming deletes and goes to /objects', async () => {
    const user = userEvent.setup();
    let dialog = await openDialog(user, 'Удалить', DELETE_DIALOG);

    expect(
      within(dialog).getByText(
        'Объект будет перемещён в корзину вместе с задачами: 3. Восстановить его можно из корзины.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText(/Действие необратимо/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: DELETE_DIALOG })).not.toBeInTheDocument();
    });

    expect(deleteObject).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Удалить' }));
    dialog = await screen.findByRole('dialog', { name: DELETE_DIALOG });
    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(deleteObject).toHaveBeenCalledWith('obj-1');
    });

    expect(await screen.findByText(OBJECTS_LIST_PROBE)).toBeInTheDocument();
  });

  it('object without tasks → «…вместе с задачами: 0. Восстановить его можно из корзины.»', async () => {
    vi.mocked(fetchObject).mockResolvedValue({ ...OBJECT, task_count: 0 });

    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Удалить', DELETE_DIALOG);

    expect(
      within(dialog).getByText(
        'Объект будет перемещён в корзину вместе с задачами: 0. Восстановить его можно из корзины.',
      ),
    ).toBeInTheDocument();
  });

  it('deleteObject rejects NOT_ALLOWED → «Недостаточно прав для этого действия», stays on the card', async () => {
    vi.mocked(deleteObject).mockRejectedValue(new Error('NOT_ALLOWED'));

    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Удалить', DELETE_DIALOG);

    await user.click(within(dialog).getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByText('Недостаточно прав для этого действия')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Карточка объекта' })).toBeInTheDocument();
    expect(screen.queryByText(OBJECTS_LIST_PROBE)).not.toBeInTheDocument();
  });
});

describe('§8.3 п.3 «Создать задачу» (модалка: название, описание, исполнитель; объект = текущий)', () => {
  it('opening the dialog loads executors and offers exactly them as options', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Создать задачу', TASK_DIALOG);

    await waitFor(() => {
      expect(fetchExecutors).toHaveBeenCalled();
    });

    const select = within(dialog).getByLabelText('Исполнитель');

    await waitFor(() => {
      expect(select).toBeEnabled();
    });

    await user.click(select);
    await screen.findByRole('option', { name: 'Сергей Кузнецов' });

    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Сергей Кузнецов',
      'Алексей Морозов',
    ]);
  });

  it('submits trimmed task for the current object, closes the dialog and refetches the tasks', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Создать задачу', TASK_DIALOG);
    const callsBefore = vi.mocked(fetchObjectTasks).mock.calls.length;

    await user.type(within(dialog).getByLabelText('Название'), '  Залить фундамент  ');
    await user.type(within(dialog).getByLabelText('Описание'), '  Бетон М300  ');
    await pickAssignee(user, dialog, 'Сергей Кузнецов');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledTimes(1);
    });

    expect(createTask).toHaveBeenCalledWith({
      object_id: 'obj-1',
      title: 'Залить фундамент',
      description: 'Бетон М300',
      assignee_id: 'exec-1',
    });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: TASK_DIALOG })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(vi.mocked(fetchObjectTasks).mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('empty description is sent as description: ""', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Создать задачу', TASK_DIALOG);

    await user.type(within(dialog).getByLabelText('Название'), 'Покраска');
    await pickAssignee(user, dialog, 'Алексей Морозов');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(createTask).toHaveBeenCalledWith({
        object_id: 'obj-1',
        title: 'Покраска',
        description: '',
        assignee_id: 'exec-2',
      });
    });
  });
});

describe('§5.4 / §12.5 task validation: title trim 1..200, description ≤ 5000, assignee required', () => {
  it('empty submit shows «Введите название» and «Выберите исполнителя», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Создать задачу', TASK_DIALOG);

    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await within(dialog).findByText('Введите название')).toBeInTheDocument();
    expect(within(dialog).getByText('Выберите исполнителя')).toBeInTheDocument();
    expect(createTask).not.toHaveBeenCalled();
  });

  it('title of 201 chars → «Не более 200 символов», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Создать задачу', TASK_DIALOG);

    await pasteInto(user, within(dialog).getByLabelText('Название'), 'а'.repeat(201));
    await pickAssignee(user, dialog, 'Сергей Кузнецов');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await within(dialog).findByText('Не более 200 символов')).toBeInTheDocument();
    expect(createTask).not.toHaveBeenCalled();
  });

  it('description of 5001 chars → «Не более 5000 символов», nothing is sent', async () => {
    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Создать задачу', TASK_DIALOG);

    await user.type(within(dialog).getByLabelText('Название'), 'Покраска');
    await pasteInto(user, within(dialog).getByLabelText('Описание'), 'б'.repeat(5001));
    await pickAssignee(user, dialog, 'Сергей Кузнецов');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(await within(dialog).findByText('Не более 5000 символов')).toBeInTheDocument();
    expect(createTask).not.toHaveBeenCalled();
  });
});

describe('§5.8 «ASSIGNEE_NOT_EXECUTOR» on task creation', () => {
  it('createTask rejects ASSIGNEE_NOT_EXECUTOR → notification text from §5.8, dialog stays open', async () => {
    vi.mocked(createTask).mockRejectedValue(new Error('ASSIGNEE_NOT_EXECUTOR'));

    const user = userEvent.setup();
    const dialog = await openDialog(user, 'Создать задачу', TASK_DIALOG);

    await user.type(within(dialog).getByLabelText('Название'), 'Покраска');
    await pickAssignee(user, dialog, 'Сергей Кузнецов');
    await user.click(within(dialog).getByRole('button', { name: 'Создать' }));

    expect(
      await screen.findByText('Исполнителем может быть только пользователь с ролью «Исполнитель»'),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: TASK_DIALOG })).toBeInTheDocument();
  });
});
