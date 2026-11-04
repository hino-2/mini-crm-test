import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs, parseEnv } from 'node:util';
import {
  LOCAL_SUPABASE_HOSTNAMES,
  SECRET_KEY_PREFIX,
  SEED_REQUIRED_ENV_VARS,
  SEED_USAGE,
  SERVICE_ROLE_JWT_ROLE,
  VITE_PREFIX,
} from '../seed.constants';
import type { SeedArgs, SeedEnv, SeedOptions } from '../seed.type';

export function parseSeedArgs(argv: readonly string[]): SeedArgs {
  try {
    const { values } = parseArgs({
      args: [...argv],
      strict: true,
      allowPositionals: false,
      options: {
        reset: { type: 'boolean' },
        yes: { type: 'boolean' },
        'env-file': { type: 'string' },
      },
    });

    return {
      reset: values.reset === true,
      yes: values.yes === true,
      envFile: values['env-file'] ?? null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(`${message}\n${SEED_USAGE}`);
  }
}

export function readSeedEnv(args: SeedArgs, processEnv: SeedEnv): SeedEnv {
  if (args.envFile === null) {
    return processEnv;
  }

  const absPath = path.resolve(args.envFile);
  let content: string;

  try {
    content = readFileSync(absPath, 'utf8');
  } catch {
    throw new Error(`Env file not found: ${absPath}`);
  }

  return { ...processEnv, ...parseEnv(content) };
}

function jwtRole(value: string): unknown {
  const parts = value.split('.');

  if (parts.length !== 3) {
    return undefined;
  }

  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1] ?? '', 'base64url').toString('utf8'));

    return typeof payload === 'object' && payload !== null && 'role' in payload
      ? payload.role
      : undefined;
  } catch {
    return undefined;
  }
}

export function assertNoServiceKeyInViteVars(env: SeedEnv): void {
  const serviceKey = (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();

  for (const [name, raw] of Object.entries(env)) {
    const value = (raw ?? '').trim();

    if (!name.startsWith(VITE_PREFIX) || value === '') {
      continue;
    }

    const upperName = name.toUpperCase();
    const leaked =
      upperName.includes('SERVICE_ROLE') ||
      upperName.includes('SECRET') ||
      (serviceKey !== '' && value === serviceKey) ||
      value.startsWith(SECRET_KEY_PREFIX) ||
      jwtRole(value) === SERVICE_ROLE_JWT_ROLE;

    if (leaked) {
      throw new Error(
        `Service role key found in VITE_-prefixed variable ${name}. VITE_ variables are bundled into the browser: remove it (and rotate the key if it was ever committed or deployed).`,
      );
    }
  }
}

export function isLocalSupabaseUrl(url: string): boolean {
  try {
    return LOCAL_SUPABASE_HOSTNAMES.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function resolveSeedOptions(args: SeedArgs, env: SeedEnv): SeedOptions {
  assertNoServiceKeyInViteVars(env);

  const missing = SEED_REQUIRED_ENV_VARS.filter((name) => (env[name] ?? '').trim() === '');

  if (missing.length > 0) {
    throw new Error(
      `Missing required env variable(s): ${missing.join(', ')}. Set them in the environment or pass --env-file <path> (see .env.example).`,
    );
  }

  const url = (env.SUPABASE_URL ?? '').trim();

  try {
    new URL(url);
  } catch {
    throw new Error(`SUPABASE_URL is not a valid URL: ${url}`);
  }

  if (!isLocalSupabaseUrl(url) && !args.yes) {
    throw new Error(`Refusing to seed non-local Supabase at ${url} without --yes.`);
  }

  return {
    url,
    anonKey: (env.SUPABASE_ANON_KEY ?? '').trim(),
    serviceRoleKey: (env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim(),
    password: (env.SEED_PASSWORD ?? '').trim(),
    reset: args.reset,
  };
}
