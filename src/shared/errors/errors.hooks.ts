import { useEffect } from 'react';
import { notifyError } from './errors.util';

export function useNotifyError(error: unknown): void {
  useEffect(() => {
    if (error) {
      notifyError(error);
    }
  }, [error]);
}
