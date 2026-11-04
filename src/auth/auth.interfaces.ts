import type { Session } from '@supabase/supabase-js';
import type { AuthStatus, Profile } from './auth.type';

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}
