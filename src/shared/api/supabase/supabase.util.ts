import {
  MISSING_ENV_MESSAGE,
  SUPABASE_ANON_KEY_ENV_KEY,
  SUPABASE_URL_ENV_KEY,
} from './supabase.constants';
import type { SupabaseEnv } from './supabase.type';

function readValue(env: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = env[key];

  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

export function readSupabaseEnv(env: Readonly<Record<string, unknown>>): SupabaseEnv {
  const url = readValue(env, SUPABASE_URL_ENV_KEY);
  const anonKey = readValue(env, SUPABASE_ANON_KEY_ENV_KEY);
  const missing = [
    url === null ? SUPABASE_URL_ENV_KEY : null,
    anonKey === null ? SUPABASE_ANON_KEY_ENV_KEY : null,
  ].filter((key): key is string => key !== null);

  if (url === null || anonKey === null) {
    throw new Error(
      `${MISSING_ENV_MESSAGE}: ${missing.join(', ')}. Copy .env.example to .env.local and fill them in.`,
    );
  }

  return { url, anonKey };
}
