import { spawnSync } from 'node:child_process';

const runPnpm = (args, stdio) => {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm ${args.join(' ')}`], {
      stdio
    });
  }

  return spawnSync('pnpm', args, {
    stdio
  });
};

const runRequired = (label, args, retries = 0) => {
  const attempts = retries + 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    console.log(`\n[local:audit] ${label}${attempt > 1 ? ` (retry ${attempt}/${attempts})` : ''}`);

    const result = runPnpm(args, 'inherit');

    if (result.error) {
      console.error(`[local:audit] Failed to execute pnpm: ${result.error.message}`);
      process.exit(1);
    }

    if (result.status === 0) {
      return;
    }

    if (attempt === attempts) {
      process.exit(result.status ?? 1);
    }
  }
};

const runHint = (label, command, args) => {
  console.log(`\n[local:audit] Hint: ${label}`);

  const result = spawnSync(command, args, {
    encoding: 'utf8'
  });

  if (result.error) {
    console.log(`Skipped: ${result.error.message}`);
    return;
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();

  if (output.length === 0) {
    console.log('No matches.');
    return;
  }

  console.log(output);
};

runRequired('Running pnpm test', ['test']);
runRequired('Running pnpm health', ['health'], 1);
runRequired('Running pnpm ws:test', ['ws:test'], 1);

runHint(
  "LOCAL branches (search: storageMode === 'LOCAL')",
  'rg',
  ['-n', "storageMode\\s*===\\s*['\"]LOCAL['\"]", 'apps/api/src']
);
runHint(
  'Potential state-model Prisma access',
  'rg',
  ['-n', 'prisma\\.(token|roomSettings|asset|snapshot|event)\\.', 'apps/api/src']
);

console.log('\n[local:audit] Completed.');
