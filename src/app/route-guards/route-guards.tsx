import { Center, Loader } from '@mantine/core';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth, useCurrentProfile } from '../../auth/auth-context/auth-context';
import { ROLE_HOME_PATHS, ROUTE_PATHS } from '../app.constants';
import type { ReturnToState } from '../app.type';
import type { RequireRoleProps } from './route-guards.interfaces';
import { getReturnPath } from './route-guards.util';

function FullScreenLoader(): JSX.Element {
  return (
    <Center h="100vh">
      <Loader />
    </Center>
  );
}

export function RequireAuth(): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status === 'unauthenticated') {
    const state = {
      from: location.pathname + location.search + location.hash,
    } satisfies ReturnToState;

    return <Navigate to={ROUTE_PATHS.login} replace state={state} />;
  }

  return <Outlet />;
}

export function GuestOnly(): JSX.Element {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullScreenLoader />;
  }

  if (status === 'authenticated') {
    return <Navigate to={getReturnPath(location.state)} replace />;
  }

  return <Outlet />;
}

export function RequireRole({ role, redirectTo }: RequireRoleProps): JSX.Element {
  const profile = useCurrentProfile();

  if (profile.role === role) {
    return <Outlet />;
  }

  return <Navigate to={redirectTo} replace />;
}

export function RoleHomeRedirect(): JSX.Element {
  const profile = useCurrentProfile();

  return <Navigate to={ROLE_HOME_PATHS[profile.role]} replace />;
}
