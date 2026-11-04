import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import {
  DB_TEST_ENV_FILE,
  DB_TEST_ENV_VARS,
  LOCAL_SUPABASE_HOSTNAMES,
  SUPABASE_REACHABILITY_TIMEOUT_MS,
} from './env.constants';
import type { DbTestEnv } from './env.type';

export function loadDbTestEnv(envFilePath: string = DB_TEST_ENV_FILE): DbTestEnv {
  const absPath = path.resolve(envFilePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(
      `DB test env file not found: ${absPath}. Run \`npx supabase start\` and copy SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY from \`npx supabase status\` into it.`,
    );
  }

  const values = parseEnv(fs.readFileSync(absPath, 'utf8'));
  const missing = DB_TEST_ENV_VARS.filter((name) => (values[name] ?? '').trim() === '');

  if (missing.length > 0) {
    throw new Error(`Missing variable(s) in ${absPath}: ${missing.join(', ')}`);
  }

  const url = (values.SUPABASE_URL ?? '').trim();
  let hostname: string | null = null;

  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = null;
  }

  if (hostname === null || !LOCAL_SUPABASE_HOSTNAMES.includes(hostname)) {
    throw new Error(`Refusing to run DB tests against non-local Supabase URL: ${url}`);
  }

  return {
    url,
    anonKey: (values.SUPABASE_ANON_KEY ?? '').trim(),
    serviceRoleKey: (values.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
  };
}

export async function assertSupabaseReachable(
  url: string,
  timeoutMs: number = SUPABASE_REACHABILITY_TIMEOUT_MS,
): Promise<void> {
  try {
    await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Local Supabase is not reachable at ${url} (${cause}). Run \`npx supabase start\` (Docker required), then \`npx supabase db reset\`.`,
    );
  }
}

let dbTestEnvPromise: Promise<DbTestEnv> | undefined;

export function getDbTestEnv(): Promise<DbTestEnv> {
  dbTestEnvPromise ??= (async () => {
    const env = loadDbTestEnv();

    await assertSupabaseReachable(env.url);

    return env;
  })();

  return dbTestEnvPromise;
}
