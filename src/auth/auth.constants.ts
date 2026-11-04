import type { UserRole } from './auth.type';

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  manager: 'Постановщик',
  executor: 'Исполнитель',
};

export const PROFILE_QUERY_KEY = 'profile';
