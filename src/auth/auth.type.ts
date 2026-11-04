export type UserRole = 'manager' | 'executor';

export type Profile = { id: string; full_name: string; role: UserRole };

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
