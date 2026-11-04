import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertSupabaseReachable, loadDbTestEnv } from './env';

const LOCAL_URL = 'http://127.0.0.1:54321';
const ANON_LINE = 'SUPABASE_ANON_KEY=test-anon-key';
const SERVICE_LINE = 'SUPABASE_SERVICE_ROLE_KEY=test-service-role-key';

describe('§10.1: loadDbTestEnv reads .env.test.local-style file', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mini-crm-env-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeEnv(lines: string[]): string {
    const file = join(dir, '.env.test.local');

    writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');

    return file;
  }

  it('§10.1: missing env file -> throws "not found" with the file name', () => {
    const missing = join(dir, 'does-not-exist.env');

    expect(() => loadDbTestEnv(missing)).toThrow(/not found/);
    expect(() => loadDbTestEnv(missing)).toThrow(/does-not-exist\.env/);
  });

  it('§10.1: file without SUPABASE_URL -> throws naming SUPABASE_URL', () => {
    const file = writeEnv([ANON_LINE, SERVICE_LINE]);

    expect(() => loadDbTestEnv(file)).toThrow(/SUPABASE_URL/);
  });

  it('§11: non-local SUPABASE_URL is refused ("non-local")', () => {
    const file = writeEnv(['SUPABASE_URL=https://example.supabase.co', ANON_LINE, SERVICE_LINE]);

    expect(() => loadDbTestEnv(file)).toThrow(/non-local/);
  });

  it('§10.1: valid local file -> returns { url, anonKey, serviceRoleKey } without touching process.env', () => {
    const before = process.env.SUPABASE_URL;
    const file = writeEnv([`SUPABASE_URL=${LOCAL_URL}`, ANON_LINE, SERVICE_LINE]);

    expect(loadDbTestEnv(file)).toEqual({
      url: LOCAL_URL,
      anonKey: 'test-anon-key',
      serviceRoleKey: 'test-service-role-key',
    });
    expect(process.env.SUPABASE_URL).toBe(before);
  });
});

describe('§10.1: assertSupabaseReachable fails fast when local Supabase is down', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      const s = server;

      server = undefined;
      s.closeAllConnections();
      await new Promise<void>((resolve) => s.close(() => resolve()));
    }
  });

  it(
    '§10.1: unreachable URL rejects within 5 s, mentioning the URL and `supabase start`',
    async () => {
      const started = Date.now();
      const error: unknown = await assertSupabaseReachable('http://127.0.0.1:1', 1000).then(
        () => undefined,
        (e: unknown) => e,
      );

      expect(Date.now() - started).toBeLessThan(5000);
      expect(error).toBeInstanceOf(Error);

      const message = (error as Error).message;

      expect(message).toContain('http://127.0.0.1:1');
      expect(message).toContain('supabase start');
    },
    10_000,
  );

  it('§10.1: any HTTP response (even 404) counts as reachable', async () => {
    const s = createServer((_req, res) => {
      res.statusCode = 404;
      res.end('not found');
    });

    server = s;
    await new Promise<void>((resolve) => s.listen(0, '127.0.0.1', () => resolve()));

    const { port } = s.address() as AddressInfo;

    await expect(assertSupabaseReachable(`http://127.0.0.1:${port}`)).resolves.toBeUndefined();
  });
});
