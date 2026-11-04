import { createContext, useContext } from 'react';
import type { AuthContextValue } from '../auth.interfaces';
import type { Profile } from '../auth.type';

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
}

export function useCurrentProfile(): Profile {
  const { profile } = useAuth();

  if (profile === null) {
    throw new Error('useCurrentProfile must be used inside an authenticated route');
  }

  return profile;
}
