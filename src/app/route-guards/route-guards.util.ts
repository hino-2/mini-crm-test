import { ROUTE_PATHS } from '../app.constants';
import { LOGIN_PATH_PATTERN } from './route-guards.constants';

export function getReturnPath(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const { from } = state;

    if (
      typeof from === 'string' &&
      from.startsWith('/') &&
      !from.startsWith('//') &&
      !LOGIN_PATH_PATTERN.test(from)
    ) {
      return from;
    }
  }

  return ROUTE_PATHS.home;
}
