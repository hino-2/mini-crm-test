import type { Profile } from '../auth/auth.type';

export type ExecutorOption = Pick<Profile, 'id' | 'full_name'>;
