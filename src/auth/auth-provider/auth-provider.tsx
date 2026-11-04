import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { notifyError } from '../../shared/errors/errors.util';
import {
  fetchProfile,
  signInWithPassword,
  signOut,
  subscribeToAuthChanges,
} from '../auth-api/auth-api';
import { AuthContext } from '../auth-context/auth-context';
import { PROFILE_QUERY_KEY } from '../auth.constants';
import type { AuthContextValue } from '../auth.interfaces';
import type { AuthStatus } from '../auth.type';

export function AuthProvider({ children }: PropsWithChildren): JSX.Element {
  const queryClient = useQueryClient();
  // undefined = no auth event received yet
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const userId = session?.user.id;

  useEffect(
    () =>
      subscribeToAuthChanges((nextSession) => {
        setSession(nextSession);

        if (nextSession === null) {
          queryClient.clear();
        }
      }),
    [queryClient],
  );

  const { data: profile, error: profileError } = useQuery({
    queryKey: [PROFILE_QUERY_KEY, userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: Boolean(userId),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (profileError) {
      notifyError(profileError);
      signOut().catch(notifyError);
    }
  }, [profileError]);

  const value = useMemo<AuthContextValue>(() => {
    let status: AuthStatus = 'loading';

    if (session === null) {
      status = 'unauthenticated';
    } else if (session !== undefined && profile) {
      status = 'authenticated';
    }

    return {
      status,
      session: session ?? null,
      profile: status === 'authenticated' ? (profile ?? null) : null,
      signIn: signInWithPassword,
      signOut,
    };
  }, [session, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
