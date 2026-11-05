export const TEST_PASSWORD = 'Test-password-123!';
export const TEST_EMAIL_DOMAIN = 'test.local';
export const FIXTURE_REWORK_COMMENT = 'Fixture rework';
export const TRASH_RPC_ARG = {
  soft_delete_object: 'p_object_id',
  restore_object: 'p_object_id',
  soft_delete_task: 'p_task_id',
  restore_task: 'p_task_id',
} as const;
export const CLIENT_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};
