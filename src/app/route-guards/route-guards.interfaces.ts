import type { UserRole } from '../../auth/auth.type';

export interface RequireRoleProps {
  role: UserRole;
  redirectTo: string;
}
