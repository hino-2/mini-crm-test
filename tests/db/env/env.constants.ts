export const DB_TEST_ENV_FILE = '.env.test.local';
export const DB_TEST_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;
export const LOCAL_SUPABASE_HOSTNAMES = ['127.0.0.1', 'localhost', '[::1]'];
export const SUPABASE_REACHABILITY_TIMEOUT_MS = 3000;
