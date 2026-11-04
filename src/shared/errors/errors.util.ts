import { notifications } from '@mantine/notifications';
import { isAuthApiError } from '@supabase/supabase-js';
import {
  ERROR_MESSAGES,
  INVALID_CREDENTIALS_MESSAGE,
  UNKNOWN_ERROR_MESSAGE,
} from './errors.constants';
import type { DbErrorCode } from './errors.type';

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error;

    if (typeof message === 'string' && Object.hasOwn(ERROR_MESSAGES, message)) {
      return ERROR_MESSAGES[message as DbErrorCode];
    }
  }

  return UNKNOWN_ERROR_MESSAGE;
}

export function getLoginErrorMessage(error: unknown): string {
  if (isAuthApiError(error) && (error.code === 'invalid_credentials' || error.status === 400)) {
    return INVALID_CREDENTIALS_MESSAGE;
  }

  return UNKNOWN_ERROR_MESSAGE;
}

export function notifyError(error: unknown): void {
  notifications.show({ color: 'red', message: getErrorMessage(error) });
}
