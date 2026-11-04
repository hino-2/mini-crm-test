import { Anchor, AppShell, Button, Container, Group, Text } from '@mantine/core';
import { NavLink, Outlet } from 'react-router';
import { useAuth, useCurrentProfile } from '../../auth/auth-context/auth-context';
import { ROLE_LABELS } from '../../auth/auth.constants';
import { notifyError } from '../../shared/errors/errors.util';
import { NAV_LINKS } from '../app.constants';

export function AppLayout(): JSX.Element {
  const profile = useCurrentProfile();
  const { signOut } = useAuth();

  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="lg" wrap="nowrap">
            <Text fw={700}>Мини-CRM «Объекты и задачи»</Text>
            <Group component="nav" gap="md">
              {NAV_LINKS[profile.role].map((link) => (
                <Anchor key={link.to} component={NavLink} to={link.to}>
                  {link.label}
                </Anchor>
              ))}
            </Group>
          </Group>
          <Group gap="md" wrap="nowrap">
            <Text>{profile.full_name}</Text>
            <Text c="dimmed">{ROLE_LABELS[profile.role]}</Text>
            <Button variant="default" onClick={() => signOut().catch(notifyError)}>
              Выйти
            </Button>
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container>
          <Outlet />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
