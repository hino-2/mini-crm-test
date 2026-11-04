import type { UserRole } from '../auth/auth.type';
import type { NavLinkItem } from './app.type';

export const ROUTE_PATHS = {
  login: '/login',
  home: '/',
  objects: '/objects',
  object: '/objects/:objectId',
  task: '/tasks/:taskId',
  myTasks: '/my-tasks',
} as const;

export const ROLE_HOME_PATHS: Readonly<Record<UserRole, string>> = {
  manager: ROUTE_PATHS.objects,
  executor: ROUTE_PATHS.myTasks,
};

export const NAV_LINKS: Readonly<Record<UserRole, readonly NavLinkItem[]>> = {
  manager: [{ label: 'Объекты', to: ROUTE_PATHS.objects }],
  executor: [
    { label: 'Мои задачи', to: ROUTE_PATHS.myTasks },
    { label: 'Объекты', to: ROUTE_PATHS.objects },
  ],
};
