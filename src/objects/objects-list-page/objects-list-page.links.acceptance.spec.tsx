import { notifications } from '@mantine/notifications';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import { AuthContext } from '../../auth/auth-context/auth-context';
import type { AuthContextValue } from '../../auth/auth.interfaces';
import type { Profile } from '../../auth/auth.type';
import { fetchObjects } from '../objects-api/objects-api';
import type { ObjectSummary } from '../objects.type';
import { ObjectsListPage } from './objects-list-page';

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

vi.mock('../objects-api/objects-api', () => ({
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

const OBJECTS: ObjectSummary[] = [
  { id: 'obj-1', name: 'Дом на Ленина', address: 'ул. Ленина, 1', task_count: 3 },
  { id: 'obj-2', name: 'Склад', address: 'пр. Мира, 10', task_count: 0 },
];

const OBJECT_CARD_PROBE = 'OBJECT CARD PROBE';

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

beforeEach(() => {
  vi.mocked(fetchObjects).mockResolvedValue(OBJECTS);
});

afterEach(() => {
  vi.resetAllMocks();
  act(() => {
    notifications.clean();
  });
});

describe('Step-4 a11y: object name in the objects list is a real link to the object card', () => {
  it.each([
    ['manager', MANAGER],
    ['executor', EXECUTOR],
  ] as const)('%s: «Склад» is a link with href /objects/obj-2', async (_role, profile) => {
    renderList(profile);

    expect(await screen.findByRole('link', { name: 'Склад' })).toHaveAttribute(
      'href',
      '/objects/obj-2',
    );
    expect(screen.getByRole('link', { name: 'Дом на Ленина' })).toHaveAttribute(
      'href',
      '/objects/obj-1',
    );
  });

  it('keyboard: focusing the link and pressing Enter opens the object card', async () => {
    const user = userEvent.setup();

    renderList(EXECUTOR);

    const link = await screen.findByRole('link', { name: 'Склад' });

    act(() => {
      link.focus();
    });

    await user.keyboard('{Enter}');

    expect(await screen.findByText(OBJECT_CARD_PROBE)).toBeInTheDocument();
  });
});
