import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readSupabaseEnv } from './supabase.util';

const LOCAL_URL = 'http://127.0.0.1:54321';
const ANON_KEY = 'test-anon-key';

// Достаёт сообщение ошибки, брошенной readSupabaseEnv; падает, если ошибки не было.
function captureErrorMessage(env: Readonly<Record<string, unknown>>): string {
  try {
    readSupabaseEnv(env);
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(Error);

    return (error as Error).message;
  }

  throw new Error('readSupabaseEnv did not throw');
}

describe('readSupabaseEnv: client is created only from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (§8.1)', () => {
  it('throws an Error naming both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY when env is empty', () => {
    const message = captureErrorMessage({});

    expect(message).toContain('VITE_SUPABASE_URL');
    expect(message).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('names only the missing VITE_SUPABASE_ANON_KEY when only the URL is set', () => {
    const message = captureErrorMessage({ VITE_SUPABASE_URL: LOCAL_URL });

    expect(message).toContain('VITE_SUPABASE_ANON_KEY');
    expect(message).not.toContain('VITE_SUPABASE_URL');
  });

  it('treats whitespace-only values as missing', () => {
    const message = captureErrorMessage({
      VITE_SUPABASE_URL: '   ',
      VITE_SUPABASE_ANON_KEY: '   ',
    });

    expect(message).toContain('VITE_SUPABASE_URL');
    expect(message).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('treats non-string values as missing', () => {
    const message = captureErrorMessage({
      VITE_SUPABASE_URL: true,
      VITE_SUPABASE_ANON_KEY: 42,
    });

    expect(message).toContain('VITE_SUPABASE_URL');
    expect(message).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('returns { url, anonKey } for valid values', () => {
    expect(
      readSupabaseEnv({ VITE_SUPABASE_URL: LOCAL_URL, VITE_SUPABASE_ANON_KEY: ANON_KEY }),
    ).toEqual({ url: LOCAL_URL, anonKey: ANON_KEY });
  });

  it('trims padded values', () => {
    expect(
      readSupabaseEnv({
        VITE_SUPABASE_URL: `  ${LOCAL_URL}  `,
        VITE_SUPABASE_ANON_KEY: `\t${ANON_KEY} `,
      }),
    ).toEqual({ url: LOCAL_URL, anonKey: ANON_KEY });
  });
});

describe('supabase singleton module reads import.meta.env at load', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('fails to load when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are empty', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(import('./supabase')).rejects.toThrow('VITE_SUPABASE_URL');
  });

  it('exports a supabase client with auth and from() when both env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', LOCAL_URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', ANON_KEY);

    const { supabase } = await import('./supabase');

    expect(supabase.auth).toBeDefined();
    expect(typeof supabase.from).toBe('function');
  });
});
