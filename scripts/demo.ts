/**
 * `npm run demo` — one command to get the demo running with seed data.
 *
 *   npm run demo            check prerequisites, start PostgreSQL, migrate, seed, start API + web
 *   npm run demo -- reset   drop and recreate the dev database, re-seed (does not start servers)
 *   npm run demo -- seed    re-insert the seed fixtures (wipes demo decisions and audit events)
 *   npm run demo -- status  show what is running
 *   npm run demo -- down    stop the PostgreSQL container
 *
 * Flags: --no-start (with `up`) prepares everything but does not start the dev servers.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = resolve(ROOT, '.env');
const ENV_EXAMPLE = resolve(ROOT, '.env.example');
const CONTAINER = 'fintech-demo-postgres';
const API_WORKSPACE = '@fintech-demo/api';
const MIN_NODE_MAJOR = 20;
const DB_READY_TIMEOUT_MS = 60_000;

type Command = 'up' | 'reset' | 'seed' | 'status' | 'down' | 'help';

interface Options {
  command: Command;
  start: boolean;
}

const bold = (text: string): string => `\u001b[1m${text}\u001b[0m`;
const dim = (text: string): string => `\u001b[2m${text}\u001b[0m`;
const step = (text: string): void => {
  console.log(`\n${bold('▸')} ${text}`);
};
const ok = (text: string): void => {
  console.log(`  ✓ ${text}`);
};
function fail(text: string): never {
  console.error(`\n✗ ${text}`);
  process.exit(1);
}

function parseArgs(argv: readonly string[]): Options {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')));
  const raw = positional[0] ?? 'up';
  const commands: readonly Command[] = ['up', 'reset', 'seed', 'status', 'down', 'help'];
  const command = commands.find((candidate) => candidate === raw);
  if (!command) {
    fail(`Unknown command "${raw}". Try: npm run demo -- help`);
  }
  return { command, start: !flags.has('--no-start') };
}

function run(cmd: string, args: readonly string[], cwd = ROOT): void {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.error) {
    fail(`${cmd} ${args.join(' ')} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${cmd} ${args.join(' ')} exited with code ${result.status ?? 'unknown'}`);
  }
}

function capture(cmd: string, args: readonly string[]): string | null {
  const result = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function npmWorkspace(script: string): void {
  run('npm', ['run', script, '-w', API_WORKSPACE]);
}

function checkPrerequisites(): void {
  step('Checking prerequisites');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE_MAJOR) {
    fail(`Node.js ${MIN_NODE_MAJOR}+ is required (found ${process.versions.node}).`);
  }
  ok(`Node.js ${process.versions.node}`);

  const dockerVersion = capture('docker', ['--version']);
  if (!dockerVersion) {
    fail('Docker is required to run PostgreSQL. Install Docker Desktop or Docker Engine with the Compose plugin.');
  }
  ok(dockerVersion);

  if (capture('docker', ['compose', 'version']) === null) {
    fail('`docker compose` is not available. Install the Docker Compose plugin.');
  }
  if (capture('docker', ['info']) === null) {
    fail('Docker is installed but the daemon is not running. Start Docker and retry.');
  }
  ok('Docker daemon reachable');

  if (!existsSync(resolve(ROOT, 'node_modules'))) {
    fail('Dependencies are not installed. Run `npm install` first.');
  }
  ok('node_modules present');
}

function ensureEnvFile(): void {
  step('Environment file');
  if (existsSync(ENV_FILE)) {
    ok('.env exists');
    return;
  }
  copyFileSync(ENV_EXAMPLE, ENV_FILE);
  ok('.env created from .env.example (local-only defaults, nothing secret)');
}

function containerHealth(): string | null {
  return capture('docker', ['inspect', '--format', '{{.State.Health.Status}}', CONTAINER]);
}

async function startDatabase(): Promise<void> {
  step('PostgreSQL container');
  if (containerHealth() === 'healthy') {
    ok(`${CONTAINER} already running`);
    return;
  }
  run('docker', ['compose', 'up', '-d', 'postgres']);
  process.stdout.write('  waiting for PostgreSQL to accept connections');
  const deadline = Date.now() + DB_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (containerHealth() === 'healthy') {
      console.log();
      ok(`${CONTAINER} healthy`);
      return;
    }
    process.stdout.write('.');
    await sleep(1_000);
  }
  console.log();
  fail(`PostgreSQL did not become healthy within ${DB_READY_TIMEOUT_MS / 1000}s. Check: docker logs ${CONTAINER}`);
}

function migrate(): void {
  step('Applying committed migrations (prisma migrate deploy)');
  npmWorkspace('db:migrate');
}

function seed(): void {
  step('Loading deterministic seed data');
  npmWorkspace('db:seed');
  ok('3 demo identities, 9 refunds, 8 KYC cases, 5 feature flags');
}

function reset(): void {
  step('Dropping and recreating the dev database');
  npmWorkspace('db:reset');
  ok('Database reset and re-seeded');
}

function readEnv(name: string, fallback: string): string {
  if (existsSync(ENV_FILE)) {
    process.loadEnvFile(ENV_FILE);
  }
  return process.env[name] ?? fallback;
}

function portIsFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once('error', () => {
      resolvePort(false);
    });
    server.once('listening', () => {
      server.close(() => {
        resolvePort(true);
      });
    });
    server.listen(port, host);
  });
}

async function checkPorts(apiPort: number, apiHost: string): Promise<void> {
  const busy: string[] = [];
  if (!(await portIsFree(apiPort, apiHost))) busy.push(`${apiHost}:${apiPort} (API)`);
  if (!(await portIsFree(5173, '127.0.0.1'))) busy.push('localhost:5173 (web)');
  if (busy.length > 0) {
    fail(`Port already in use: ${busy.join(', ')}. Is another \`npm run dev\` running?`);
  }
}

function printBanner(webUrl: string): void {
  console.log(`
${bold('Demo ready.')}  Open ${bold(webUrl)}

  Sign in on the DEMO MODE screen as one of:
    ${bold('viewer')}   read-only everywhere
    ${bold('analyst')}  approve / reject refunds and KYC cases
    ${bold('admin')}    analyst + toggle feature flags

  Walkthrough: docs/demo.md      Reset data: npm run demo -- reset
  ${dim('Synthetic data · Demo identity · No live transactions')}
`);
}

async function up(options: Options): Promise<void> {
  checkPrerequisites();
  ensureEnvFile();

  const webUrl = readEnv('WEB_ORIGIN', 'http://localhost:5173');
  const apiPort = Number(readEnv('API_PORT', '3001'));
  const apiHost = readEnv('API_HOST', '127.0.0.1');
  if (options.start) {
    await checkPorts(apiPort, apiHost);
  }

  await startDatabase();
  migrate();
  seed();

  if (!options.start) {
    printBanner(webUrl);
    console.log('  Servers not started (--no-start). Run `npm run dev` when ready.\n');
    return;
  }

  step('Starting API and web dev servers (Ctrl+C to stop)');
  printBanner(webUrl);
  // Own process group so a signal reaches concurrently, tsx watch and vite, not just npm.
  const dev = spawn('npm', ['run', 'dev'], { cwd: ROOT, stdio: 'inherit', detached: true });
  const forward = (signal: NodeJS.Signals) => () => {
    if (dev.pid !== undefined) {
      process.kill(-dev.pid, signal);
    }
  };
  process.on('SIGINT', forward('SIGINT'));
  process.on('SIGTERM', forward('SIGTERM'));
  dev.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function httpOk(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function status(): Promise<void> {
  step('Status');
  const health = containerHealth();
  console.log(`  PostgreSQL container  ${health ?? 'not running'}`);
  console.log(`  .env                  ${existsSync(ENV_FILE) ? 'present' : 'missing (npm run demo creates it)'}`);
  const apiPort = readEnv('API_PORT', '3001');
  const apiHost = readEnv('API_HOST', '127.0.0.1');
  const webUrl = readEnv('WEB_ORIGIN', 'http://localhost:5173');
  const apiUp = await httpOk(`http://${apiHost}:${apiPort}/api/health`);
  const webUp = await httpOk(webUrl);
  console.log(`  API                   ${apiUp ? `up at http://${apiHost}:${apiPort}` : 'down'}`);
  console.log(`  Web                   ${webUp ? `up at ${webUrl}` : 'down'}`);
  console.log();
}

function down(): void {
  step('Stopping PostgreSQL container (data volume is kept)');
  run('docker', ['compose', 'stop', 'postgres']);
  ok('Stopped. `npm run demo` starts it again; `docker compose down -v` deletes the data.');
}

function help(): void {
  console.log(`
${bold('npm run demo')} [command] [--no-start]

  up (default)   check prerequisites, start PostgreSQL, migrate, seed, start API + web
  reset          drop and recreate the dev database with fresh seed data
  seed           re-insert seed data (removes demo decisions, sessions, audit events)
  status         show container / API / web state
  down           stop the PostgreSQL container (keeps data)
  help           this message

  --no-start     with \`up\`: prepare the database but do not start the dev servers
`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  switch (options.command) {
    case 'up':
      await up(options);
      break;
    case 'reset':
      checkPrerequisites();
      ensureEnvFile();
      await startDatabase();
      reset();
      break;
    case 'seed':
      checkPrerequisites();
      ensureEnvFile();
      await startDatabase();
      migrate();
      seed();
      break;
    case 'status':
      await status();
      break;
    case 'down':
      down();
      break;
    case 'help':
      help();
      break;
  }
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
