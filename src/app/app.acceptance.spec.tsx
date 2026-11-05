import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo, useState } from 'react';
import type { JSX, PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../auth/auth-context/auth-context';
import type { AuthContextValue } from '../auth/auth.interfaces';
import type { Profile } from '../auth/auth.type';
import { App } from './app';
import { AppProviders } from './app-providers';

vi.mock('../trash/trash-api/trash-api', () => ({
  fetchDeletedObjects: vi.fn().mockResolvedValue([]),
  fetchDeletedTasks: vi.fn().mockResolvedValue([]),
  restoreObject: vi.fn().mockResolvedValue(undefined),
  restoreTask: vi.fn().mockResolvedValue(undefined),
}));

// Тестовый хелпер: компонент, которому нужен QueryClient из контекста.
function QueryClientConsumer(): JSX.Element {
  const client = useQueryClient();

  return <p>{client ? 'query-client-ok' : 'query-client-missing'}</p>;
}

const MANAGER: Profile = { id: 'm1', full_name: 'Иван Петров', role: 'manager' };
const EXECUTOR: Profile = { id: 'e1', full_name: 'Сергей Кузнецов', role: 'executor' };

// Тестовый хелпер: статичный фейк контекста авторизации.
function fakeAuth(
  status: AuthContextValue['status'],
  profile: Profile | null,
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    status,
    session: null,
    profile,
    signIn: vi.fn<AuthContextValue['signIn']>().mockResolvedValue(undefined),
    signOut: vi.fn<AuthContextValue['signOut']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

const GUEST = (): AuthContextValue => fakeAuth('unauthenticated', null);
const LOADING = (): AuthContextValue => fakeAuth('loading', null);
const AS_MANAGER = (): AuthContextValue => fakeAuth('authenticated', MANAGER);
const AS_EXECUTOR = (): AuthContextValue => fakeAuth('authenticated', EXECUTOR);

interface StatefulAuthProps {
  initialProfile: Profile | null;
  loginProfile: Profile;
}

// Тестовый хелпер: фейк-провайдер с состоянием (signIn выставляет профиль, signOut — сбрасывает).
function StatefulAuth({
  initialProfile,
  loginProfile,
  children,
}: PropsWithChildren<StatefulAuthProps>): JSX.Element {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: profile ? 'authenticated' : 'unauthenticated',
      session: null,
      profile,
      signIn: async (): Promise<void> => {
        setProfile(loginProfile);
      },
      signOut: async (): Promise<void> => {
        setProfile(null);
      },
    }),
    [profile, loginProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function renderAt(path: string, ui: JSX.Element): void {
  render(
    <AppProviders>
      <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
    </AppProviders>,
  );
}

function renderApp(path: string, auth: AuthContextValue): void {
  renderAt(
    path,
    <AuthContext.Provider value={auth}>
      <App />
    </AuthContext.Provider>,
  );
}

describe('§8.2 route guards: unauthenticated → /login', () => {
  it.each(['/objects', '/my-tasks', '/tasks/t1', '/'])(
    'guest at %s is redirected to the login screen «Вход»',
    async (path) => {
      renderApp(path, GUEST());

      expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument();
    },
  );

  it('while auth status is loading, neither «Вход» nor «Объекты» is shown at /objects', () => {
    renderApp('/objects', LOADING());

    expect(screen.queryByRole('heading', { name: 'Вход' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Объекты' })).not.toBeInTheDocument();
  });
});

describe('§8.2 route "/": redirect by role (manager → /objects, executor → /my-tasks)', () => {
  it('manager at "/" lands on «Объекты»', async () => {
    renderApp('/', AS_MANAGER());

    expect(await screen.findByRole('heading', { name: 'Объекты' })).toBeInTheDocument();
  });

  it('executor at "/" lands on «Мои задачи»', async () => {
    renderApp('/', AS_EXECUTOR());

    expect(await screen.findByRole('heading', { name: 'Мои задачи' })).toBeInTheDocument();
  });
});

describe('§8.2 /my-tasks is executor-only: «Manager на /my-tasks → редирект на /objects»', () => {
  it('manager at /my-tasks is redirected to «Объекты»', async () => {
    renderApp('/my-tasks', AS_MANAGER());

    expect(await screen.findByRole('heading', { name: 'Объекты' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Мои задачи' })).not.toBeInTheDocument();
  });

  it('executor at /my-tasks sees «Мои задачи»', async () => {
    renderApp('/my-tasks', AS_EXECUTOR());

    expect(await screen.findByRole('heading', { name: 'Мои задачи' })).toBeInTheDocument();
  });
});

describe('§8.2 routes available to both roles', () => {
  it.each([
    ['manager', AS_MANAGER],
    ['executor', AS_EXECUTOR],
  ] as const)('%s at /objects/o1 sees «Карточка объекта»', async (_role, auth) => {
    renderApp('/objects/o1', auth());

    expect(await screen.findByRole('heading', { name: 'Карточка объекта' })).toBeInTheDocument();
  });

  it.each([
    ['manager', AS_MANAGER],
    ['executor', AS_EXECUTOR],
  ] as const)('%s at /tasks/t1 sees «Карточка задачи»', async (_role, auth) => {
    renderApp('/tasks/t1', auth());

    expect(await screen.findByRole('heading', { name: 'Карточка задачи' })).toBeInTheDocument();
  });

  it('executor at /objects sees «Объекты»', async () => {
    renderApp('/objects', AS_EXECUTOR());

    expect(await screen.findByRole('heading', { name: 'Объекты' })).toBeInTheDocument();
  });
});

describe('§8.2 «Авторизованный на /login → /»', () => {
  it('authenticated manager at /login ends on «Объекты»', async () => {
    renderApp('/login', AS_MANAGER());

    expect(await screen.findByRole('heading', { name: 'Объекты' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Вход' })).not.toBeInTheDocument();
  });

  it('authenticated executor at /login ends on «Мои задачи»', async () => {
    renderApp('/login', AS_EXECUTOR());

    expect(await screen.findByRole('heading', { name: 'Мои задачи' })).toBeInTheDocument();
  });
});

describe('§8.2 route "*": «Страница не найдена»', () => {
  it.each([
    ['guest', GUEST],
    ['manager', AS_MANAGER],
    ['executor', AS_EXECUTOR],
  ] as const)('%s at /unknown sees «Страница не найдена»', async (_who, auth) => {
    renderApp('/unknown', auth());

    expect(await screen.findByRole('heading', { name: 'Страница не найдена' })).toBeInTheDocument();
  });
});

describe('§8.2 «с возвратом на исходный путь после входа»', () => {
  it('guest at /objects/o1 → «Вход» → signs in → lands back on «Карточка объекта»', async () => {
    const user = userEvent.setup();

    renderAt(
      '/objects/o1',
      <StatefulAuth initialProfile={null} loginProfile={MANAGER}>
        <App />
      </StatefulAuth>,
    );

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email', { selector: 'input' }), 'manager1@demo.local');
    await user.type(screen.getByLabelText('Пароль', { selector: 'input' }), 'secret');
    await user.click(screen.getByRole('button', { name: 'Войти' }));

    expect(await screen.findByRole('heading', { name: 'Карточка объекта' })).toBeInTheDocument();
  });
});

describe('§8.1 header: «имя, роль, ссылки по роли, кнопка «Выйти»»', () => {
  it('manager sees name «Иван Петров», role «Постановщик», link «Объекты» → /objects and no «Мои задачи» link', async () => {
    renderApp('/objects', AS_MANAGER());

    await screen.findByRole('heading', { name: 'Объекты' });

    expect(screen.getByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByText('Постановщик')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Объекты' })).toHaveAttribute('href', '/objects');
    expect(screen.queryByRole('link', { name: 'Мои задачи' })).not.toBeInTheDocument();
  });

  it('executor sees name «Сергей Кузнецов», role «Исполнитель», links «Мои задачи» → /my-tasks and «Объекты» → /objects', async () => {
    renderApp('/objects', AS_EXECUTOR());

    await screen.findByRole('heading', { name: 'Объекты' });

    expect(screen.getByText('Сергей Кузнецов')).toBeInTheDocument();
    expect(screen.getByText('Исполнитель')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Мои задачи' })).toHaveAttribute('href', '/my-tasks');
    expect(screen.getByRole('link', { name: 'Объекты' })).toHaveAttribute('href', '/objects');
  });

  it('click «Выйти» calls signOut exactly once', async () => {
    const user = userEvent.setup();
    const auth = AS_MANAGER();

    renderApp('/objects', auth);

    await user.click(await screen.findByRole('button', { name: 'Выйти' }));

    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('after «Выйти» the user ends on the login screen «Вход»', async () => {
    const user = userEvent.setup();

    renderAt(
      '/objects',
      <StatefulAuth initialProfile={MANAGER} loginProfile={MANAGER}>
        <App />
      </StatefulAuth>,
    );

    await user.click(await screen.findByRole('button', { name: 'Выйти' }));

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument();
  });
});

describe('step 8 AC8: /trash route (manager only) and «Корзина» nav link', () => {
  it('manager header has link «Корзина» → /trash next to «Объекты»', async () => {
    renderApp('/objects', AS_MANAGER());

    await screen.findByRole('heading', { name: 'Объекты' });

    expect(screen.getByRole('link', { name: 'Объекты' })).toHaveAttribute('href', '/objects');
    expect(screen.getByRole('link', { name: 'Корзина' })).toHaveAttribute('href', '/trash');
  });

  it('executor header has no «Корзина» link', async () => {
    renderApp('/objects', AS_EXECUTOR());

    await screen.findByRole('heading', { name: 'Объекты' });

    expect(screen.queryByRole('link', { name: 'Корзина' })).not.toBeInTheDocument();
  });

  it('manager at /trash sees heading «Корзина»', async () => {
    renderApp('/trash', AS_MANAGER());

    expect(await screen.findByRole('heading', { name: 'Корзина' })).toBeInTheDocument();
  });

  it('executor at /trash is redirected to «Мои задачи»', async () => {
    renderApp('/trash', AS_EXECUTOR());

    expect(await screen.findByRole('heading', { name: 'Мои задачи' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Корзина' })).not.toBeInTheDocument();
  });

  it('guest at /trash is redirected to the login screen «Вход»', async () => {
    renderApp('/trash', GUEST());

    expect(await screen.findByRole('heading', { name: 'Вход' })).toBeInTheDocument();
  });
});

describe('Step 0 scaffold: AppProviders (Mantine, Query, notifications)', () => {
  it('provides a TanStack QueryClient to children (useQueryClient does not throw)', () => {
    render(
      <AppProviders>
        <QueryClientConsumer />
      </AppProviders>,
    );

    expect(screen.getByText('query-client-ok')).toBeInTheDocument();
  });

  it('provides MantineProvider: Mantine <Button> labelled «OK» renders', () => {
    render(
      <AppProviders>
        <Button>OK</Button>
      </AppProviders>,
    );

    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('mounts Mantine Notifications: notifications.show message appears on screen', async () => {
    render(
      <AppProviders>
        <div />
      </AppProviders>,
    );

    act(() => {
      notifications.show({ message: 'Тестовое уведомление' });
    });

    expect(await screen.findByText('Тестовое уведомление')).toBeInTheDocument();
  });
});
