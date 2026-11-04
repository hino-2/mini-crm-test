import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { runSeed } from '../../../scripts/seed/seed';
import {
  assertNoServiceKeyInViteVars,
  isLocalSupabaseUrl,
  parseSeedArgs,
  resolveSeedOptions,
} from '../../../scripts/seed/seed-config/seed-config';
import { getDbTestEnv } from '../env/env';
import type { DbTestEnv } from '../env/env.type';
import { createAdminClient, createAnonClient } from '../fixtures/fixtures';
import type {
  HistoryRow,
  ObjectRow,
  ProfileRow,
  TaskRow,
  TaskStatus,
  UserRole,
} from '../fixtures/fixtures.type';

// Test-only helper types.
type SeedSummaryResult = Awaited<ReturnType<typeof runSeed>>;
type DemoKey = 'manager1' | 'manager2' | 'executor1' | 'executor2';
type ExpectedUser = { key: DemoKey; email: string; fullName: string; role: UserRole };
type ExpectedTask = {
  title: string;
  objectName: string;
  assignee: 'executor1' | 'executor2';
  status: TaskStatus;
};
type HistoryView = {
  from: TaskStatus | null;
  to: TaskStatus;
  by: string;
  comment: string | null;
};

const SEED_TEST_PASSWORD = 'Seed-demo-123!';
const INTEGRATION_TIMEOUT_MS = 120_000;
const LOCAL_URL = 'http://127.0.0.1:54321';
const REMOTE_URL = 'https://fxvcwxsumzwewmzjzoua.supabase.co';
const FAKE_SERVICE_ROLE_KEY = 'fake-service-role-value-7f3a9c';

const EXPECTED_USERS: readonly ExpectedUser[] = [
  { key: 'manager1', email: 'manager1@demo.local', fullName: 'Иван Петров', role: 'manager' },
  { key: 'manager2', email: 'manager2@demo.local', fullName: 'Ольга Смирнова', role: 'manager' },
  {
    key: 'executor1',
    email: 'executor1@demo.local',
    fullName: 'Сергей Кузнецов',
    role: 'executor',
  },
  {
    key: 'executor2',
    email: 'executor2@demo.local',
    fullName: 'Алексей Морозов',
    role: 'executor',
  },
];

const OBJ_NORTH_PARK = 'ЖК «Северный парк», корпус 2';
const OBJ_GALAXY = 'Бизнес-центр «Галактика»';
const OBJ_PINE_FOREST = 'Частный дом, КП «Сосновый бор»';
const DEMO_OBJECT_NAMES = [OBJ_NORTH_PARK, OBJ_GALAXY, OBJ_PINE_FOREST];

const T1 = 'Монтаж опалубки перекрытия 5-го этажа';
const T2 = 'Армирование колонн 6-го этажа';
const T3 = 'Гидроизоляция кровли, секция А';
const T4 = 'Демонтаж перегородок на 3-м этаже';
const T5 = 'Прокладка кабельных трасс в серверной';
const T6 = 'Монтаж приточной вентиляции, 3-й этаж';
const T7 = 'Устройство ленточного фундамента';
const T8 = 'Монтаж кровли из металлочерепицы';

const REWORK_COMMENT_ARMATURE =
  'Шаг хомутов в зоне стыка не соответствует проекту (должен быть 100 мм). Переделать и приложить фото.';
const RESUBMIT_COMMENT_ARMATURE = 'Хомуты переставлены с шагом 100 мм, фото приложены.';
const REWORK_COMMENT_ROOF =
  'На примыканиях к парапету нахлёст рулонов меньше 150 мм. Устранить и сдать повторно.';

const EXPECTED_TASKS: readonly ExpectedTask[] = [
  { title: T1, objectName: OBJ_NORTH_PARK, assignee: 'executor1', status: 'accepted' },
  { title: T2, objectName: OBJ_NORTH_PARK, assignee: 'executor2', status: 'on_review' },
  { title: T3, objectName: OBJ_NORTH_PARK, assignee: 'executor1', status: 'rework' },
  { title: T4, objectName: OBJ_GALAXY, assignee: 'executor2', status: 'accepted' },
  { title: T5, objectName: OBJ_GALAXY, assignee: 'executor2', status: 'in_progress' },
  { title: T6, objectName: OBJ_GALAXY, assignee: 'executor2', status: 'new' },
  { title: T7, objectName: OBJ_PINE_FOREST, assignee: 'executor1', status: 'on_review' },
  { title: T8, objectName: OBJ_PINE_FOREST, assignee: 'executor1', status: 'new' },
];

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function buildJwt(payload: Record<string, unknown>): string {
  return `${base64UrlJson({ alg: 'HS256', typ: 'JWT' })}.${base64UrlJson(payload)}.c2lnbmF0dXJl`;
}

const SERVICE_ROLE_JWT = buildJwt({ iss: 'supabase-demo', role: 'service_role', exp: 1983812996 });
const ANON_JWT = buildJwt({ iss: 'supabase-demo', role: 'anon', exp: 1983812996 });

function localEnv(): Record<string, string | undefined> {
  return {
    SUPABASE_URL: LOCAL_URL,
    SUPABASE_ANON_KEY: ANON_JWT,
    SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_ROLE_KEY,
    SEED_PASSWORD: 'demo-password-123',
  };
}

function captureError(fn: () => unknown): Error {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error) {
      return error;
    }

    throw new Error(`Expected an Error instance, got: ${String(error)}`);
  }

  throw new Error('Expected function to throw, but it did not');
}

function expectServiceKeyError(error: Error, varName: string, secret: string): void {
  expect(error.message).toContain(varName);
  expect(error.message).toContain('Service role key found in VITE_-prefixed variable');
  expect(error.message).not.toContain(secret);
}

const noop = (): void => {};

async function signIn(
  email: string,
  password: string,
): Promise<{ client: SupabaseClient; errorMessage: string | null }> {
  const client = await createAnonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });

  return { client, errorMessage: error ? error.message : null };
}

async function signInOrFail(email: string, password: string): Promise<SupabaseClient> {
  const { client, errorMessage } = await signIn(email, password);

  if (errorMessage !== null) {
    throw new Error(`sign in as ${email} failed: ${errorMessage}`);
  }

  return client;
}

function sortedIds(rows: readonly { id: string }[]): string[] {
  return rows.map((row) => row.id).sort();
}

function expectSummaryShape(summary: SeedSummaryResult, users: Record<DemoKey, string>): void {
  expect(summary.objects).toHaveLength(3);
  expect(summary.objects.map((o) => o.name).sort()).toEqual([...DEMO_OBJECT_NAMES].sort());
  expect(summary.tasks).toHaveLength(8);

  const objectIdByName = new Map(summary.objects.map((o) => [o.name, o.id]));

  for (const expected of EXPECTED_TASKS) {
    const task = summary.tasks.find((t) => t.title === expected.title);

    expect(task, `task "${expected.title}" in summary`).toBeDefined();
    expect(task?.status).toBe(expected.status);
    expect(task?.assigneeId).toBe(users[expected.assignee]);
    expect(task?.objectId).toBe(objectIdByName.get(expected.objectName));
  }
}

describe('§9 seed config: parseSeedArgs', () => {
  it('no flags → { reset: false, yes: false, envFile: null }', () => {
    expect(parseSeedArgs([])).toEqual({ reset: false, yes: false, envFile: null });
  });

  it('parses --reset, --yes and --env-file <path>', () => {
    expect(parseSeedArgs(['--reset', '--yes', '--env-file', 'f.env'])).toEqual({
      reset: true,
      yes: true,
      envFile: 'f.env',
    });
  });

  it('parses --env-file=<path>', () => {
    expect(parseSeedArgs(['--env-file=f.env'])).toEqual({
      reset: false,
      yes: false,
      envFile: 'f.env',
    });
  });

  it('unknown flag throws', () => {
    expect(() => parseSeedArgs(['--bogus'])).toThrow(Error);
  });
});

describe('§11 seed config: isLocalSupabaseUrl', () => {
  it.each(['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321'])(
    '%s is local',
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(true);
    },
  );

  it.each([REMOTE_URL, 'not a url'])('%s is not local', (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });
});

describe('§9/§11 seed config: resolveSeedOptions', () => {
  it('missing required vars → one error naming every missing var', () => {
    const error = captureError(() =>
      resolveSeedOptions(
        { reset: false, yes: false, envFile: null },
        { SUPABASE_URL: LOCAL_URL, SEED_PASSWORD: '   ' },
      ),
    );

    expect(error.message).toContain('Missing required env variable(s)');
    expect(error.message).toContain('SUPABASE_ANON_KEY');
    expect(error.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(error.message).toContain('SEED_PASSWORD');
    expect(error.message).not.toContain('SUPABASE_URL,');
  });

  it('empty env → error names all four required vars', () => {
    const error = captureError(() =>
      resolveSeedOptions({ reset: false, yes: false, envFile: null }, {}),
    );

    for (const name of [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SEED_PASSWORD',
    ]) {
      expect(error.message).toContain(name);
    }
  });

  it('invalid SUPABASE_URL → throws "not a valid URL"', () => {
    expect(() =>
      resolveSeedOptions(
        { reset: false, yes: false, envFile: null },
        { ...localEnv(), SUPABASE_URL: 'not a url' },
      ),
    ).toThrow('SUPABASE_URL is not a valid URL');
  });

  it('non-local URL without --yes → refuses, message mentions --yes', () => {
    const error = captureError(() =>
      resolveSeedOptions(
        { reset: false, yes: false, envFile: null },
        { ...localEnv(), SUPABASE_URL: REMOTE_URL },
      ),
    );

    expect(error.message).toContain('--yes');
    expect(error.message).toContain(REMOTE_URL);
  });

  it('non-local URL with --yes → returns options', () => {
    const options = resolveSeedOptions(
      { reset: false, yes: true, envFile: null },
      { ...localEnv(), SUPABASE_URL: REMOTE_URL },
    );

    expect(options).toEqual({
      url: REMOTE_URL,
      anonKey: ANON_JWT,
      serviceRoleKey: FAKE_SERVICE_ROLE_KEY,
      password: 'demo-password-123',
      reset: false,
    });
  });

  it('local URL without --yes → ok, reset passed through and values trimmed', () => {
    const options = resolveSeedOptions(
      { reset: true, yes: false, envFile: null },
      { ...localEnv(), SEED_PASSWORD: '  demo-password-123  ' },
    );

    expect(options).toEqual({
      url: LOCAL_URL,
      anonKey: ANON_JWT,
      serviceRoleKey: FAKE_SERVICE_ROLE_KEY,
      password: 'demo-password-123',
      reset: true,
    });
  });

  it('§11: service key in a VITE_ variable is rejected (before any other check)', () => {
    const error = captureError(() =>
      resolveSeedOptions(
        { reset: false, yes: true, envFile: null },
        { VITE_SUPABASE_ANON_KEY: SERVICE_ROLE_JWT },
      ),
    );

    expectServiceKeyError(error, 'VITE_SUPABASE_ANON_KEY', SERVICE_ROLE_JWT);
  });

  it('§11: VITE_ var equal to SUPABASE_SERVICE_ROLE_KEY is rejected via resolveSeedOptions', () => {
    const error = captureError(() =>
      resolveSeedOptions(
        { reset: false, yes: false, envFile: null },
        { ...localEnv(), VITE_SOME_KEY: FAKE_SERVICE_ROLE_KEY },
      ),
    );

    expectServiceKeyError(error, 'VITE_SOME_KEY', FAKE_SERVICE_ROLE_KEY);
  });
});

describe('§11 seed config: assertNoServiceKeyInViteVars', () => {
  it('throws for a VITE_ variable whose name contains SERVICE_ROLE', () => {
    const secret = 'some-opaque-value-123';
    const error = captureError(() =>
      assertNoServiceKeyInViteVars({ VITE_SUPABASE_SERVICE_ROLE_KEY: secret }),
    );

    expectServiceKeyError(error, 'VITE_SUPABASE_SERVICE_ROLE_KEY', secret);
  });

  it('throws for a VITE_ value equal to SUPABASE_SERVICE_ROLE_KEY', () => {
    const error = captureError(() =>
      assertNoServiceKeyInViteVars({
        SUPABASE_SERVICE_ROLE_KEY: FAKE_SERVICE_ROLE_KEY,
        VITE_API_TOKEN: FAKE_SERVICE_ROLE_KEY,
      }),
    );

    expectServiceKeyError(error, 'VITE_API_TOKEN', FAKE_SERVICE_ROLE_KEY);
  });

  it('throws for a VITE_ value starting with sb_secret_', () => {
    const secret = 'sb_secret_abcdef0123456789';
    const error = captureError(() => assertNoServiceKeyInViteVars({ VITE_SUPABASE_KEY: secret }));

    expectServiceKeyError(error, 'VITE_SUPABASE_KEY', secret);
  });

  it('throws for VITE_SUPABASE_ANON_KEY holding a JWT with role service_role', () => {
    const error = captureError(() =>
      assertNoServiceKeyInViteVars({ VITE_SUPABASE_ANON_KEY: SERVICE_ROLE_JWT }),
    );

    expectServiceKeyError(error, 'VITE_SUPABASE_ANON_KEY', SERVICE_ROLE_JWT);
  });

  it('does not throw for an anon-role JWT in VITE_SUPABASE_ANON_KEY', () => {
    expect(() =>
      assertNoServiceKeyInViteVars({
        VITE_SUPABASE_URL: LOCAL_URL,
        VITE_SUPABASE_ANON_KEY: ANON_JWT,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_JWT,
      }),
    ).not.toThrow();
  });

  it('does not throw for an empty VITE_SUPABASE_SERVICE_ROLE_KEY=', () => {
    expect(() => assertNoServiceKeyInViteVars({ VITE_SUPABASE_SERVICE_ROLE_KEY: '' })).not.toThrow();
  });
});

describe('§9 runSeed against local Supabase (sequential)', () => {
  let env: DbTestEnv;
  let admin: SupabaseClient;
  let first: SeedSummaryResult;
  let userIds: Record<DemoKey, string>;

  function seed(reset: boolean): Promise<SeedSummaryResult> {
    return runSeed({
      url: env.url,
      anonKey: env.anonKey,
      serviceRoleKey: env.serviceRoleKey,
      password: SEED_TEST_PASSWORD,
      reset,
      log: noop,
    });
  }

  async function readProfiles(): Promise<ProfileRow[]> {
    const { data, error } = await admin
      .from('profiles')
      .select('*')
      .in('id', Object.values(userIds));

    if (error) {
      throw new Error(`read profiles failed: ${error.message}`);
    }

    return data as ProfileRow[];
  }

  async function readTasks(client: SupabaseClient, objectIds: string[]): Promise<TaskRow[]> {
    const { data, error } = await client.from('tasks').select('*').in('object_id', objectIds);

    if (error) {
      throw new Error(`read tasks failed: ${error.message}`);
    }

    return data as TaskRow[];
  }

  async function readVisibleDemoObjects(client: SupabaseClient): Promise<ObjectRow[]> {
    const { data, error } = await client.from('objects').select('*').in('name', DEMO_OBJECT_NAMES);

    if (error) {
      throw new Error(`read objects failed: ${error.message}`);
    }

    return data as ObjectRow[];
  }

  async function readHistory(client: SupabaseClient, taskId: string): Promise<HistoryView[]> {
    const { data, error } = await client
      .from('task_status_history')
      .select('*')
      .eq('task_id', taskId)
      .order('changed_at', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`read history failed: ${error.message}`);
    }

    return (data as HistoryRow[]).map((row) => ({
      from: row.from_status,
      to: row.to_status,
      by: row.changed_by,
      comment: row.comment,
    }));
  }

  async function countHistory(taskIds: string[]): Promise<number> {
    const { count, error } = await admin
      .from('task_status_history')
      .select('id', { count: 'exact', head: true })
      .in('task_id', taskIds);

    if (error) {
      throw new Error(`count history failed: ${error.message}`);
    }

    return count ?? -1;
  }

  function taskIdByTitle(summary: SeedSummaryResult, title: string): string {
    const task = summary.tasks.find((t) => t.title === title);

    if (!task) {
      throw new Error(`task "${title}" missing in summary`);
    }

    return task.id;
  }

  beforeAll(async () => {
    env = await getDbTestEnv();
    admin = await createAdminClient();
  }, INTEGRATION_TIMEOUT_MS);

  it(
    '§9 step 1: first run with reset creates 4 users, 3 objects, 8 tasks; profiles match',
    async () => {
      first = await seed(true);

      expect(first.demoData).toBe('created');
      expect(first.users).toHaveLength(4);
      expect(
        first.users.map((u) => ({ key: u.key, email: u.email, fullName: u.fullName, role: u.role })),
      ).toEqual(EXPECTED_USERS);

      for (const user of first.users) {
        expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
      }

      userIds = {
        manager1: first.users[0].id,
        manager2: first.users[1].id,
        executor1: first.users[2].id,
        executor2: first.users[3].id,
      };

      expectSummaryShape(first, userIds);

      const profiles = await readProfiles();

      expect(profiles).toHaveLength(4);

      for (const expected of EXPECTED_USERS) {
        const profile = profiles.find((p) => p.id === userIds[expected.key]);

        expect(profile?.full_name).toBe(expected.fullName);
        expect(profile?.role).toBe(expected.role);
      }
    },
    INTEGRATION_TIMEOUT_MS,
  );

  it(
    '§9: every demo user signs in with SEED_PASSWORD; both managers see exactly the 3 demo objects',
    async () => {
      for (const user of EXPECTED_USERS) {
        const { errorMessage } = await signIn(user.email, SEED_TEST_PASSWORD);

        expect(errorMessage, `sign in ${user.email}`).toBeNull();
      }

      for (const email of ['manager1@demo.local', 'manager2@demo.local']) {
        const client = await signInOrFail(email, SEED_TEST_PASSWORD);
        const objects = await readVisibleDemoObjects(client);

        expect(sortedIds(objects)).toEqual(sortedIds(first.objects));
      }

      const manager1 = await signInOrFail('manager1@demo.local', SEED_TEST_PASSWORD);
      const objects = await readVisibleDemoObjects(manager1);

      for (const object of objects) {
        expect(object.created_by).toBe(userIds.manager1);
      }
    },
    INTEGRATION_TIMEOUT_MS,
  );

  it(
    '§9 step 2-3: tasks in DB have expected final statuses, assignees, objects; author is manager1; all 5 statuses present',
    async () => {
      const manager1 = await signInOrFail('manager1@demo.local', SEED_TEST_PASSWORD);
      const tasks = await readTasks(
        manager1,
        first.objects.map((o) => o.id),
      );
      const objectIdByName = new Map(first.objects.map((o) => [o.name, o.id]));

      expect(tasks).toHaveLength(8);
      expect(sortedIds(tasks)).toEqual(sortedIds(first.tasks));

      for (const expected of EXPECTED_TASKS) {
        const task = tasks.find((t) => t.title === expected.title);

        expect(task, `task "${expected.title}"`).toBeDefined();
        expect(task?.status).toBe(expected.status);
        expect(task?.assignee_id).toBe(userIds[expected.assignee]);
        expect(task?.object_id).toBe(objectIdByName.get(expected.objectName));
        expect(task?.author_id).toBe(userIds.manager1);
      }

      expect(new Set(tasks.map((t) => t.status))).toEqual(
        new Set<TaskStatus>(['new', 'in_progress', 'on_review', 'accepted', 'rework']),
      );
    },
    INTEGRATION_TIMEOUT_MS,
  );

  it(
    '§9: each executor sees only own tasks and objects with own tasks; other executor task by id → empty',
    async () => {
      const objectIds = first.objects.map((o) => o.id);
      const executor1 = await signInOrFail('executor1@demo.local', SEED_TEST_PASSWORD);
      const executor2 = await signInOrFail('executor2@demo.local', SEED_TEST_PASSWORD);
      const e1Tasks = await readTasks(executor1, objectIds);
      const e2Tasks = await readTasks(executor2, objectIds);

      expect(e1Tasks.map((t) => t.title).sort()).toEqual([T1, T3, T7, T8].sort());
      expect(e2Tasks.map((t) => t.title).sort()).toEqual([T2, T4, T5, T6].sort());

      const e1Objects = await readVisibleDemoObjects(executor1);
      const e2Objects = await readVisibleDemoObjects(executor2);

      expect(e1Objects.map((o) => o.name).sort()).toEqual([OBJ_NORTH_PARK, OBJ_PINE_FOREST].sort());
      expect(e2Objects.map((o) => o.name).sort()).toEqual([OBJ_NORTH_PARK, OBJ_GALAXY].sort());

      const foreignForE1 = await executor1
        .from('tasks')
        .select('id')
        .eq('id', taskIdByTitle(first, T2));
      const foreignForE2 = await executor2
        .from('tasks')
        .select('id')
        .eq('id', taskIdByTitle(first, T1));

      expect(foreignForE1.error).toBeNull();
      expect(foreignForE1.data).toEqual([]);
      expect(foreignForE2.error).toBeNull();
      expect(foreignForE2.data).toEqual([]);
    },
    INTEGRATION_TIMEOUT_MS,
  );

  it(
    '§9 step 3: status history is real (RPC by the correct users), incl. rework → in_progress → on_review cycle',
    async () => {
      const manager1 = await signInOrFail('manager1@demo.local', SEED_TEST_PASSWORD);
      const { manager1: m1, manager2: m2, executor2: e2 } = userIds;

      expect(await readHistory(manager1, taskIdByTitle(first, T2))).toEqual([
        { from: null, to: 'new', by: m1, comment: null },
        { from: 'new', to: 'in_progress', by: e2, comment: null },
        { from: 'in_progress', to: 'on_review', by: e2, comment: null },
        { from: 'on_review', to: 'rework', by: m2, comment: REWORK_COMMENT_ARMATURE },
        { from: 'rework', to: 'in_progress', by: e2, comment: null },
        { from: 'in_progress', to: 'on_review', by: e2, comment: RESUBMIT_COMMENT_ARMATURE },
      ]);

      const t3 = await readHistory(manager1, taskIdByTitle(first, T3));

      expect(t3.at(-1)).toEqual({
        from: 'on_review',
        to: 'rework',
        by: m1,
        comment: REWORK_COMMENT_ROOF,
      });

      const t1 = await readHistory(manager1, taskIdByTitle(first, T1));

      expect(t1.at(-1)).toMatchObject({ from: 'on_review', to: 'accepted', by: m1 });

      const t4 = await readHistory(manager1, taskIdByTitle(first, T4));

      expect(t4.at(-1)).toMatchObject({ from: 'on_review', to: 'accepted', by: m2 });

      const t6 = await readHistory(manager1, taskIdByTitle(first, T6));

      expect(t6).toEqual([{ from: null, to: 'new', by: m1, comment: null }]);
    },
    INTEGRATION_TIMEOUT_MS,
  );

  it(
    '§9 idempotent: rerun without --reset skips demo data, reuses users, no duplicates, history unchanged',
    async () => {
      const taskIds = first.tasks.map((t) => t.id);
      const historyBefore = await countHistory(taskIds);
      const second = await seed(false);

      expect(second.demoData).toBe('skipped');
      expect(second.deletedObjectCount).toBe(0);
      expect(second.users.map((u) => u.created)).toEqual([false, false, false, false]);
      expect(second.users.map((u) => u.id)).toEqual(first.users.map((u) => u.id));
      expect(sortedIds(second.objects)).toEqual(sortedIds(first.objects));
      expect(sortedIds(second.tasks)).toEqual(sortedIds(first.tasks));
      expectSummaryShape(second, userIds);

      const manager1 = await signInOrFail('manager1@demo.local', SEED_TEST_PASSWORD);

      expect(await readVisibleDemoObjects(manager1)).toHaveLength(3);
      expect(
        await readTasks(
          manager1,
          first.objects.map((o) => o.id),
        ),
      ).toHaveLength(8);
      expect(await countHistory(taskIds)).toBe(historyBefore);
    },
    INTEGRATION_TIMEOUT_MS,
  );

  it(
    '§9 idempotent: rerun repairs drifted role, full_name and password of existing demo users',
    async () => {
      const roleDrift = await admin.auth.admin.updateUserById(userIds.manager2, {
        app_metadata: { role: 'executor' },
      });

      expect(roleDrift.error).toBeNull();

      const nameDrift = await admin
        .from('profiles')
        .update({ full_name: 'X' })
        .eq('id', userIds.executor1);

      expect(nameDrift.error).toBeNull();

      const passwordDrift = await admin.auth.admin.updateUserById(userIds.executor1, {
        password: 'Other-password-456!',
      });

      expect(passwordDrift.error).toBeNull();

      const drifted = await readProfiles();

      expect(drifted.find((p) => p.id === userIds.manager2)?.role).toBe('executor');
      expect(drifted.find((p) => p.id === userIds.executor1)?.full_name).toBe('X');
      expect((await signIn('executor1@demo.local', SEED_TEST_PASSWORD)).errorMessage).not.toBeNull();

      const repaired = await seed(false);

      expect(repaired.demoData).toBe('skipped');
      expect(repaired.users.map((u) => u.created)).toEqual([false, false, false, false]);
      expect(repaired.users.find((u) => u.key === 'manager2')?.role).toBe('manager');

      const profiles = await readProfiles();

      expect(profiles.find((p) => p.id === userIds.manager2)?.role).toBe('manager');
      expect(profiles.find((p) => p.id === userIds.executor1)?.full_name).toBe('Сергей Кузнецов');
      expect((await signIn('executor1@demo.local', SEED_TEST_PASSWORD)).errorMessage).toBeNull();
    },
    INTEGRATION_TIMEOUT_MS,
  );

  it(
    '§9 --reset: deletes demo objects (tasks and history cascade) and recreates them with new ids',
    async () => {
      const oldObjectIds = first.objects.map((o) => o.id);
      const oldTaskIds = first.tasks.map((t) => t.id);
      const third = await seed(true);

      expect(third.deletedObjectCount).toBe(3);
      expect(third.demoData).toBe('created');
      expect(third.users.map((u) => u.id)).toEqual(first.users.map((u) => u.id));
      expectSummaryShape(third, userIds);

      for (const object of third.objects) {
        expect(oldObjectIds).not.toContain(object.id);
      }

      for (const task of third.tasks) {
        expect(oldTaskIds).not.toContain(task.id);
      }

      const manager1 = await signInOrFail('manager1@demo.local', SEED_TEST_PASSWORD);

      expect(sortedIds(await readVisibleDemoObjects(manager1))).toEqual(sortedIds(third.objects));

      const newTasks = await readTasks(
        manager1,
        third.objects.map((o) => o.id),
      );

      expect(newTasks).toHaveLength(8);

      for (const expected of EXPECTED_TASKS) {
        expect(newTasks.find((t) => t.title === expected.title)?.status).toBe(expected.status);
      }

      const oldObjects = await admin.from('objects').select('id').in('id', oldObjectIds);
      const oldTasks = await admin.from('tasks').select('id').in('id', oldTaskIds);

      expect(oldObjects.error).toBeNull();
      expect(oldObjects.data).toEqual([]);
      expect(oldTasks.error).toBeNull();
      expect(oldTasks.data).toEqual([]);
      expect(await countHistory(oldTaskIds)).toBe(0);
    },
    INTEGRATION_TIMEOUT_MS,
  );
});
