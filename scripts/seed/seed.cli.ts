import {
  isLocalSupabaseUrl,
  parseSeedArgs,
  readSeedEnv,
  resolveSeedOptions,
} from './seed-config/seed-config';
import { runSeed } from './seed';

try {
  const args = parseSeedArgs(process.argv.slice(2));
  const options = resolveSeedOptions(args, readSeedEnv(args, process.env));

  console.log(
    `Seeding ${options.url} (${isLocalSupabaseUrl(options.url) ? 'local' : 'REMOTE'})${options.reset ? ' with --reset' : ''}`,
  );

  const summary = await runSeed({ ...options, log: console.log });

  console.log(
    `Done: demo data ${summary.demoData}, ${summary.objects.length} objects, ${summary.tasks.length} tasks` +
      (summary.deletedObjectCount > 0 ? `, ${summary.deletedObjectCount} old objects deleted` : ''),
  );
  console.log(
    `Demo logins (password from SEED_PASSWORD): ${summary.users.map((user) => user.email).join(', ')}`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
