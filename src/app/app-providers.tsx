import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

export function AppProviders({ children }: PropsWithChildren): JSX.Element {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <MantineProvider>
      <Notifications />
      <ModalsProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}
