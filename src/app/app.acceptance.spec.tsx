import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { App } from './app';
import { AppProviders } from './app-providers';

// Тестовый хелпер: компонент, которому нужен QueryClient из контекста.
function QueryClientConsumer(): JSX.Element {
  const client = useQueryClient();

  return <p>{client ? 'query-client-ok' : 'query-client-missing'}</p>;
}

describe('Step 0 scaffold: App placeholder route "/"', () => {
  it('renders level-1 heading «Мини-CRM «Объекты и задачи»» inside AppProviders + MemoryRouter at "/"', () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Мини-CRM «Объекты и задачи»' }),
    ).toBeVisible();
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
