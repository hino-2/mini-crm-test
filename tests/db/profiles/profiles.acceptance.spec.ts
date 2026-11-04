import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createAdminClient,
  createExecutor,
  createManager,
  createTestUser,
} from '../fixtures/fixtures';
import type { ProfileRow, TestUser } from '../fixtures/fixtures.type';

async function readProfile(admin: SupabaseClient, id: string): Promise<ProfileRow | null> {
  const { data, error } = await admin.from('profiles').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`readProfile failed: ${error.message}`);
  }

  return data as ProfileRow | null;
}

describe('§4 / §5.2 Profiles: created by trigger from auth.users', () => {
  let admin: SupabaseClient;

  beforeAll(async () => {
    admin = await createAdminClient();
  });

  it('§4: app_metadata.role = manager gives profile role manager and full_name from user_metadata', async () => {
    const manager = await createManager();
    const profile = await readProfile(admin, manager.id);

    expect(profile?.role).toBe('manager');
    expect(profile?.full_name).toMatch(/^Manager [a-z0-9]+$/);
  });

  it('§4 / §10.1: role from user_metadata is ignored (no app role → executor)', async () => {
    const user = await createTestUser({ userMetadata: { role: 'manager', full_name: 'X' } });
    const profile = await readProfile(admin, user.id);

    expect(profile?.role).toBe('executor');
    expect(profile?.full_name).toBe('X');
  });

  it('§4: invalid app_metadata.role falls back to executor', async () => {
    const user = await createTestUser({ appMetadata: { role: 'admin' } });
    const profile = await readProfile(admin, user.id);

    expect(profile?.role).toBe('executor');
  });

  it('§4 / §5.2: no metadata → role executor, full_name defaults to email', async () => {
    const user = await createTestUser();
    const profile = await readProfile(admin, user.id);

    expect(profile?.role).toBe('executor');
    expect(profile?.full_name).toBe(user.email);
  });

  it('§5.2: full_name is trimmed', async () => {
    const user = await createTestUser({ userMetadata: { full_name: '  Name  ' } });
    const profile = await readProfile(admin, user.id);

    expect(profile?.full_name).toBe('Name');
  });

  it('§5.2: blank full_name falls back to email', async () => {
    const user = await createTestUser({ userMetadata: { full_name: '   ' } });
    const profile = await readProfile(admin, user.id);

    expect(profile?.full_name).toBe(user.email);
  });

  it('§5.2: full_name longer than 200 chars is cut to 200', async () => {
    const user = await createTestUser({ userMetadata: { full_name: 'x'.repeat(250) } });
    const profile = await readProfile(admin, user.id);

    expect(profile?.full_name).toHaveLength(200);
  });

  it('§4: promotion to manager via service key (app_metadata update) syncs profile role', async () => {
    const executor = await createExecutor();
    const { error } = await admin.auth.admin.updateUserById(executor.id, {
      app_metadata: { role: 'manager' },
    });

    expect(error).toBeNull();

    const profile = await readProfile(admin, executor.id);

    expect(profile?.role).toBe('manager');
  });
});

describe('§6.2 / §6.3 / §10.1 Profiles: authenticated may only SELECT', () => {
  let admin: SupabaseClient;
  let executor: TestUser;
  let other: TestUser;

  beforeAll(async () => {
    admin = await createAdminClient();
    executor = await createExecutor();
    other = await createManager();
  });

  it('§12.12: executor sees another user profile with exactly id, full_name, role, created_at (no email)', async () => {
    const { data, error } = await executor.client.from('profiles').select('*').eq('id', other.id);

    expect(error).toBeNull();

    const rows = (data ?? []) as ProfileRow[];

    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(['created_at', 'full_name', 'id', 'role']);
  });

  it('§10.1: executor cannot UPDATE own role (42501), role unchanged', async () => {
    const { error } = await executor.client
      .from('profiles')
      .update({ role: 'manager' })
      .eq('id', executor.id);

    expect(error?.code).toBe('42501');

    const profile = await readProfile(admin, executor.id);

    expect(profile?.role).toBe('executor');
  });

  it('§10.1: executor cannot INSERT a profile (42501)', async () => {
    const id = randomUUID();
    const { error } = await executor.client
      .from('profiles')
      .insert({ id, full_name: 'Fake profile', role: 'manager' });

    expect(error?.code).toBe('42501');
    expect(await readProfile(admin, id)).toBeNull();
  });

  it('§6.2: executor cannot DELETE own profile (42501), profile still exists', async () => {
    const { error } = await executor.client.from('profiles').delete().eq('id', executor.id);

    expect(error?.code).toBe('42501');
    expect(await readProfile(admin, executor.id)).not.toBeNull();
  });
});
