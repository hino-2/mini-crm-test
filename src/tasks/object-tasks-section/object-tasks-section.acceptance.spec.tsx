import { notifications } from '@mantine/notifications';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import { AuthContext } from '../../auth/auth-context/auth-context';
import type { AuthContextValue } from '../../auth/auth.interfaces';
import type { Profile } from '../../auth/auth.type';
import { fetchExecutors } from '../../profiles/profiles-api/profiles-api';
import { fetchObjectTasks } from '../../tasks/tasks-api/tasks-api';
import type { TaskListItem } from '../../tasks/tasks.type';
import { ObjectTasksSection } from './object-tasks-section';

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

const MANAGER: Profile = { id: 'mgr-1', full_name: 'Иван Петров', role: 'manager' };
const EXECUTOR: Profile = { id: 'exec-1', full_name: 'Сергей Кузнецов', role: 'executor' };

const OBJECT_TASKS: TaskListItem[] = [
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
    created_at: '2026-03-10T09:00:00Z',
    assignee: { full_name: 'Сергей Кузнецов' },
  },
];

const EXECUTORS = [
  { id: 'exec-1', full_name: 'Сергей Кузнецов' },
  { id: 'exec-2', full_name: 'Алексей Морозов' },
];

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

function renderSection(profile: Profile): void {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={['/objects/obj-1']}>
        <AuthContext.Provider value={fakeAuth(profile)}>
          <Routes>
            <Route path="/objects/:objectId" element={<ObjectTasksSection objectId="obj-1" />} />
            <Route path="/tasks/:taskId" element={<div>{TASK_CARD_PROBE}</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </AppProviders>,
  );
}

beforeEach(() => {
  vi.mocked(fetchObjectTasks).mockResolvedValue(OBJECT_TASKS);
  vi.mocked(fetchExecutors).mockResolvedValue(EXECUTORS);
});

afterEach(() => {
  vi.resetAllMocks();
  act(() => {
    notifications.clean();
  });
});

describe('Step-4 a11y: task title in the object tasks table is a real link to the task card', () => {
  it.each([
    ['manager', MANAGER],
    ['executor', EXECUTOR],
  ] as const)('%s: «Возвести стены» is a link with href /tasks/task-2', async (_role, profile) => {
    renderSection(profile);

    expect(await screen.findByRole('link', { name: 'Возвести стены' })).toHaveAttribute(
      'href',
      '/tasks/task-2',
    );
    expect(screen.getByRole('link', { name: 'Залить фундамент' })).toHaveAttribute(
      'href',
      '/tasks/task-1',
    );
  });

  it('keyboard: focusing the link and pressing Enter opens the task card', async () => {
    const user = userEvent.setup();

    renderSection(EXECUTOR);

    const link = await screen.findByRole('link', { name: 'Возвести стены' });

    act(() => {
      link.focus();
    });

    await user.keyboard('{Enter}');

    expect(await screen.findByText(TASK_CARD_PROBE)).toBeInTheDocument();
  });
});
