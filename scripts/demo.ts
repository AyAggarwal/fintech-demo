/**
 * `npm run demo` — one command to get the demo running with seed data.
 *
 *   npm run demo            check prerequisites, start PostgreSQL, migrate, seed, start API + web
 *   npm run demo -- reset   drop and recreate the dev database, re-seed (does not start servers)
 *   npm run demo -- seed    re-insert the seed fixtures (wipes demo decisions and audit events)
 *   npm run demo -- status  show what is running
 *   npm run demo -- down    stop PostgreSQL
 *
 * Flags: --no-start (with `up`) prepares everything but does not start the dev servers.
 *
 * PostgreSQL runs from binaries installed by npm (see scripts/postgres.ts); no Docker, no system install.
 */
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

import { resolveLocalDevEndpoints } from '@fintech-demo/contracts';
import type { LocalDevEndpoints } from '@fintech-demo/contracts';

import * as postgres from './postgres.js';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_FILE = postgres.ENV_FILE;
const ENV_EXAMPLE = resolve(ROOT, '.env.example');
const API_WORKSPACE = '@fintech-demo/api';
const MIN_NODE_MAJOR = 20;

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

let envLoaded = false;
/** Reads `.env` (once) so this process and every child it spawns see the repo settings, not the shell's. */
function loadEnv(): void {
  if (envLoaded) return;
  envLoaded = true;
  const overridden = postgres.loadRepoEnv();
  if (overridden.length > 0) {
    ok(`.env takes precedence over shell variables: ${overridden.join(', ')}`);
  }
}

function databasePort(): number {
  return postgres.portFromUrl(readEnv('DATABASE_URL', ''));
}

async function startDatabase(): Promise<void> {
  step('PostgreSQL (local, from npm-installed binaries)');
  const port = databasePort();
  const current = postgres.runningPort();
  if (current === port) {
    ok('already running');
    return;
  }
  if (current !== null) {
    postgres.stop();
    ok(`stopped the cluster running on port ${current}; DATABASE_URL now says ${port}`);
  }
  if (!(await portIsFree(port, '127.0.0.1'))) {
    fail(
      `Port ${port} is already in use by something else (another PostgreSQL?). ` +
        'Change the port in DATABASE_URL and TEST_DATABASE_URL in .env, then retry.',
    );
  }
  if (!postgres.isInitialised()) {
    postgres.initialise();
    ok(`cluster created in ${postgres.PG_HOME}`);
  }
  postgres.start(port);
  ok(`listening on 127.0.0.1:${port}`);
}

function generatePrismaClient(): void {
  step('Generating Prisma client');
  npmWorkspace('prisma:generate');
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
  loadEnv();
  return process.env[name] ?? fallback;
}

function localDevEndpoints(): LocalDevEndpoints {
  loadEnv();
  return resolveLocalDevEndpoints(process.env);
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

async function checkPorts({ apiHost, apiPort, webPort }: LocalDevEndpoints): Promise<void> {
  const busy: string[] = [];
  if (!(await portIsFree(apiPort, apiHost))) busy.push(`${apiHost}:${apiPort} (API)`);
  if (!(await portIsFree(webPort, '127.0.0.1'))) busy.push(`localhost:${webPort} (web)`);
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

  Walkthrough: docs/demo.md   Reset data: npm run demo -- reset   Stop PostgreSQL: npm run demo -- down
  ${dim('Synthetic data · Demo identity · No live transactions')}
`);
}

async function up(options: Options): Promise<void> {
  checkPrerequisites();
  ensureEnvFile();

  const endpoints = localDevEndpoints();
  const webUrl = endpoints.webOrigin;
  if (options.start) {
    await checkPorts(endpoints);
  }

  await startDatabase();
  generatePrismaClient();
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
  const runningPort = postgres.runningPort();
  const pgState = runningPort !== null
    ? `running on 127.0.0.1:${runningPort}`
    : postgres.isInitialised()
      ? 'stopped'
      : 'not created yet (npm run demo creates it)';
  console.log(`  PostgreSQL            ${pgState}`);
  console.log(`  .env                  ${existsSync(ENV_FILE) ? 'present' : 'missing (npm run demo creates it)'}`);
  const { apiUrl, webOrigin } = localDevEndpoints();
  const apiUp = await httpOk(`${apiUrl}/api/health`);
  const webUp = await httpOk(webOrigin);
  console.log(`  API                   ${apiUp ? `up at ${apiUrl}` : 'down'}`);
  console.log(`  Web                   ${webUp ? `up at ${webOrigin}` : 'down'}`);
  console.log();
}

function down(): void {
  step('Stopping PostgreSQL (data is kept)');
  if (!postgres.isRunning()) {
    ok('already stopped');
    return;
  }
  postgres.stop();
  ok(`Stopped. \`npm run demo\` starts it again; delete ${postgres.PG_HOME} to wipe all data.`);
}

function help(): void {
  console.log(`
${bold('npm run demo')} [command] [--no-start]

  up (default)   check prerequisites, start PostgreSQL, migrate, seed, start API + web
  reset          drop and recreate the dev database with fresh seed data
  seed           re-insert seed data (removes demo decisions, sessions, audit events)
  status         show PostgreSQL / API / web state
  down           stop PostgreSQL (keeps data)
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
      generatePrismaClient();
      reset();
      break;
    case 'seed':
      checkPrerequisites();
      ensureEnvFile();
      await startDatabase();
      generatePrismaClient();
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
