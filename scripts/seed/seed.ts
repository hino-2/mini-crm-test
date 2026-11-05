import { createClient, type User } from '@supabase/supabase-js';
import type { Database } from '../../src/shared/api/database.types';
import {
  CLIENT_OPTIONS,
  DEMO_OBJECTS,
  DEMO_TASKS,
  DEMO_USERS,
  LIST_USERS_PAGE_SIZE,
} from './seed.constants';
import type {
  DemoUser,
  DemoUserKey,
  SeedClient,
  SeedClients,
  SeedLogger,
  SeedObjectSummary,
  SeedOptions,
  SeedSummary,
  SeedTaskSummary,
  SeedUserSummary,
} from './seed.type';

function createSeedClient(url: string, key: string): SeedClient {
  return createClient<Database>(url, key, CLIENT_OPTIONS);
}

function fail(what: string, context: string, message: string): Error {
  return new Error(`Seed failed: ${what} (${context}): ${message}`);
}

// ponytail: pages through listUsers (local DB may hold thousands of test users), early exit once
// all emails are found; upgrade to a GoTrue admin filter query or an SQL RPC if it gets slow.
async function findUsersByEmail(
  admin: SeedClient,
  emails: readonly string[],
): Promise<Map<string, User>> {
  const wanted = new Set(emails.map((email) => email.toLowerCase()));
  const found = new Map<string, User>();

  for (let page = 1; found.size < wanted.size; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LIST_USERS_PAGE_SIZE,
    });

    if (error) {
      throw fail('list users', `page ${page}`, error.message);
    }

    for (const user of data.users) {
      const email = (user.email ?? '').toLowerCase();

      if (wanted.has(email)) {
        found.set(email, user);
      }
    }

    if (data.users.length < LIST_USERS_PAGE_SIZE) {
      break;
    }
  }

  return found;
}

async function ensureDemoUsers(
  admin: SeedClient,
  password: string,
  log: SeedLogger,
): Promise<SeedUserSummary[]> {
  const existing = await findUsersByEmail(
    admin,
    DEMO_USERS.map((user) => user.email),
  );
  const summaries: SeedUserSummary[] = [];

  for (const demo of DEMO_USERS) {
    const attributes = {
      password,
      email_confirm: true,
      app_metadata: { role: demo.role },
      user_metadata: { full_name: demo.fullName },
    };
    const current = existing.get(demo.email.toLowerCase());
    const result = current
      ? await admin.auth.admin.updateUserById(current.id, attributes)
      : await admin.auth.admin.createUser({ email: demo.email, ...attributes });

    if (result.error) {
      throw fail('ensure user', demo.email, result.error.message);
    }

    log(`User ${demo.email} (${demo.role}): ${current ? 'updated' : 'created'}`);
    summaries.push({
      key: demo.key,
      id: result.data.user.id,
      email: demo.email,
      fullName: demo.fullName,
      role: demo.role,
      created: !current,
    });
  }

  await repairProfiles(admin, summaries);

  return summaries;
}

// The profile trigger only syncs the role on conflict, so a renamed demo user needs a name fix here.
async function repairProfiles(admin: SeedClient, users: readonly SeedUserSummary[]): Promise<void> {
  const { data, error } = await admin
    .from('profiles')
    .select('id, full_name, role')
    .in(
      'id',
      users.map((user) => user.id),
    );

  if (error) {
    throw fail('read profiles', 'demo users', error.message);
  }

  for (const user of users) {
    const profile = data.find((row) => row.id === user.id);

    if (!profile) {
      throw fail('read profiles', user.email, 'profile row is missing (profile trigger broken?)');
    }

    if (profile.role !== user.role) {
      throw fail(
        'check profile role',
        user.email,
        `expected ${user.role}, got ${profile.role} (profile trigger broken?)`,
      );
    }

    if (profile.full_name !== user.fullName) {
      const update = await admin
        .from('profiles')
        .update({ full_name: user.fullName })
        .eq('id', user.id);

      if (update.error) {
        throw fail('update profile name', user.email, update.error.message);
      }
    }
  }
}

async function signIn(
  url: string,
  anonKey: string,
  demo: DemoUser,
  password: string,
): Promise<SeedClient> {
  const client = createSeedClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email: demo.email, password });

  if (error) {
    throw fail('sign in', demo.email, error.message);
  }

  return client;
}

async function signInAll(url: string, anonKey: string, password: string): Promise<SeedClients> {
  const entries = await Promise.all(
    DEMO_USERS.map(async (demo) => [demo.key, await signIn(url, anonKey, demo, password)] as const),
  );

  return Object.fromEntries(entries) as SeedClients;
}

// Reads go through the service_role client: soft-deleted demo objects are hidden by RLS.
async function findDemoObjects(
  admin: SeedClient,
  manager1Id: string,
): Promise<SeedObjectSummary[]> {
  const { data, error } = await admin
    .from('objects')
    .select('id, name')
    .in(
      'name',
      DEMO_OBJECTS.map((object) => object.name),
    )
    .eq('created_by', manager1Id);

  if (error) {
    throw fail('find demo objects', 'service_role', error.message);
  }

  return data;
}

async function readDemoTasks(
  admin: SeedClient,
  objectIds: readonly string[],
): Promise<SeedTaskSummary[]> {
  if (objectIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from('tasks')
    .select('id, object_id, title, assignee_id, status')
    .in('object_id', [...objectIds])
    .order('created_at');

  if (error) {
    throw fail('read demo tasks', 'service_role', error.message);
  }

  return data.map((task) => ({
    id: task.id,
    objectId: task.object_id,
    title: task.title,
    assigneeId: task.assignee_id,
    status: task.status,
  }));
}

async function createDemoData(
  clients: SeedClients,
  users: readonly SeedUserSummary[],
): Promise<{ objects: SeedObjectSummary[]; tasks: SeedTaskSummary[] }> {
  const manager1 = clients.manager1;
  const userIds = new Map<DemoUserKey, string>(users.map((user) => [user.key, user.id]));
  const objectIds = new Map<string, string>();
  const objects: SeedObjectSummary[] = [];
  const tasks: SeedTaskSummary[] = [];

  for (const demo of DEMO_OBJECTS) {
    const { data, error } = await manager1
      .from('objects')
      .insert({ name: demo.name, address: demo.address })
      .select('id, name')
      .single();

    if (error) {
      throw fail('create object', demo.name, error.message);
    }

    objectIds.set(demo.key, data.id);
    objects.push(data);
  }

  for (const demo of DEMO_TASKS) {
    const objectId = objectIds.get(demo.objectKey);
    const assigneeId = userIds.get(demo.assigneeKey);

    if (objectId === undefined || assigneeId === undefined) {
      throw fail('create task', demo.title, 'unknown object or assignee key');
    }

    const { data, error } = await manager1
      .from('tasks')
      .insert({
        object_id: objectId,
        title: demo.title,
        description: demo.description,
        assignee_id: assigneeId,
      })
      .select('id, object_id, title, assignee_id, status')
      .single();

    if (error) {
      throw fail('create task', demo.title, error.message);
    }

    let status = data.status;

    for (const step of demo.steps) {
      const { error: rpcError } = await clients[step.actor].rpc('change_task_status', {
        p_task_id: data.id,
        p_to_status: step.to,
        ...(step.comment ? { p_comment: step.comment } : {}),
      });

      if (rpcError) {
        throw new Error(
          `Seed failed: task "${demo.title}" → ${step.to} as ${step.actor}: ${rpcError.message}`,
        );
      }

      status = step.to;
    }

    tasks.push({
      id: data.id,
      objectId: data.object_id,
      title: data.title,
      assigneeId: data.assignee_id,
      status,
    });
  }

  return { objects, tasks };
}

export async function runSeed(options: SeedOptions): Promise<SeedSummary> {
  const log: SeedLogger = options.log ?? (() => undefined);
  const admin = createSeedClient(options.url, options.serviceRoleKey);
  const users = await ensureDemoUsers(admin, options.password, log);
  const clients = await signInAll(options.url, options.anonKey, options.password);
  const manager1Id = users.find((user) => user.key === 'manager1')?.id;

  if (manager1Id === undefined) {
    throw new Error('Seed failed: manager1 missing from demo users');
  }

  const existing = await findDemoObjects(admin, manager1Id);
  let deletedObjectCount = 0;

  if (existing.length > 0 && !options.reset) {
    log(
      `Demo data already present (${existing.length} objects), skipping. Run with --reset to recreate.`,
    );

    if (existing.length !== DEMO_OBJECTS.length) {
      log('Warning: incomplete demo data, use --reset');
    }

    return {
      users,
      demoData: 'skipped',
      deletedObjectCount: 0,
      objects: existing,
      tasks: await readDemoTasks(
        admin,
        existing.map((object) => object.id),
      ),
    };
  }

  if (existing.length > 0) {
    // Physical deletion is service_role only (authenticated has no DELETE grant).
    const { data, error } = await admin
      .from('objects')
      .delete()
      .in(
        'id',
        existing.map((object) => object.id),
      )
      .select('id');

    if (error) {
      throw fail('delete demo objects', 'service_role', error.message);
    }

    if (data.length !== existing.length) {
      throw fail(
        'delete demo objects',
        'service_role',
        `expected ${existing.length} deleted, got ${data.length}`,
      );
    }

    deletedObjectCount = data.length;
  }

  const created = await createDemoData(clients, users);

  log(`Demo data created: ${created.objects.length} objects, ${created.tasks.length} tasks`);

  return {
    users,
    demoData: 'created',
    deletedObjectCount,
    objects: created.objects,
    tasks: created.tasks,
  };
}
