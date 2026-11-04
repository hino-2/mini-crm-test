import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const supabaseDir = join(process.cwd(), 'supabase');

// Test-only helper: returns the key = value lines of one TOML section (plain string handling).
function readSection(toml: string, section: string): string[] {
  const lines = toml.split(/\r?\n/);
  const result: string[] = [];
  let inSection = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (line.startsWith('[')) {
      inSection = line === `[${section}]`;
      continue;
    }

    if (inSection && line !== '' && !line.startsWith('#')) {
      result.push(line);
    }
  }

  return result;
}

function readSetting(section: string, key: string): string | undefined {
  const toml = readFileSync(join(supabaseDir, 'config.toml'), 'utf8');
  const pattern = new RegExp(`^${key}\\s*=\\s*([^#\\s]+)`);

  for (const line of readSection(toml, section)) {
    const match = pattern.exec(line);

    if (match) {
      return match[1];
    }
  }

  return undefined;
}

describe('§3 / §4: supabase/config.toml disables sign-up', () => {
  it('§4: [auth] has enable_signup = false', () => {
    expect(readSetting('auth', 'enable_signup')).toBe('false');
  });

  it('§4 / §8.3: [auth.email] has enable_signup = true (keeps the email provider enabled for password login; signup is still blocked globally by [auth])', () => {
    expect(readSetting('auth.email', 'enable_signup')).toBe('true');
  });
});

describe('§3: supabase/ layout from supabase init', () => {
  it('§3: supabase/migrations is a directory', () => {
    const migrations = join(supabaseDir, 'migrations');

    expect(existsSync(migrations)).toBe(true);
    expect(statSync(migrations).isDirectory()).toBe(true);
  });

  it('§3: supabase/seed.sql exists', () => {
    const seed = join(supabaseDir, 'seed.sql');

    expect(existsSync(seed)).toBe(true);
    expect(statSync(seed).isFile()).toBe(true);
  });
});
