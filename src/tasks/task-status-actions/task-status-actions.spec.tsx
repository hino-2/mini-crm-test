import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppProviders } from '../../app/app-providers';
import { AuthContext } from '../../auth/auth-context/auth-context';
import type { AuthContextValue } from '../../auth/auth.interfaces';
import { fetchTaskHistory } from '../tasks-api/tasks-api';
import type { TaskDetails } from '../tasks.type';
import { TaskStatusActions } from './task-status-actions';

vi.mock('../tasks-api/tasks-api', () => ({
  fetchTaskHistory: vi.fn(),
  changeTaskStatus: vi.fn(),
}));

const AUTH: AuthContextValue = {
  status: 'authenticated',
  session: null,
  profile: { id: 'mgr-1', full_name: 'Иван Петров', role: 'manager' },
  signIn: vi.fn(),
  signOut: vi.fn(),
};

const TASK: TaskDetails = {
  id: 'task-1',
  object_id: 'obj-1',
  title: 'Залить фундамент',
  description: '',
  assignee_id: 'exec-1',
  status: 'on_review',
  created_at: '2026-03-15T09:30:00Z',
  object: { name: 'Дом на Ленина' },
  assignee: { full_name: 'Сергей Кузнецов' },
  author: { full_name: 'Иван Петров' },
};

function renderActions(task: TaskDetails): JSX.Element {
  return (
    <AppProviders>
      <AuthContext.Provider value={AUTH}>
        <TaskStatusActions task={task} />
      </AuthContext.Provider>
    </AppProviders>
  );
}

describe('TaskStatusActions rework modal', () => {
  beforeEach(() => {
    vi.mocked(fetchTaskHistory).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('does not reopen by itself after the rework action disappears and comes back', async () => {
    const user = userEvent.setup();
    const { rerender } = render(renderActions(TASK));

    await user.click(screen.getByRole('button', { name: 'Вернуть на доработку' }));
    expect(await screen.findByRole('dialog', { name: 'Вернуть на доработку' })).toBeInTheDocument();

    // Another manager returned the task to rework: no actions left for this manager.
    rerender(renderActions({ ...TASK, status: 'rework' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // The executor resubmitted it: the manager's actions are back.
    rerender(renderActions({ ...TASK, status: 'on_review' }));
    expect(screen.getByRole('button', { name: 'Принять' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
