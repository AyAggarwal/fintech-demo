/**
 * Local PostgreSQL for the demo, no Docker and no system install.
 *
 * The `embedded-postgres` dev dependency ships PostgreSQL 16 binaries for the current OS/CPU.
 * This module drives them with `initdb` / `pg_ctl`: the cluster lives in `.postgres/` at the repo
 * root (gitignored) and runs as an ordinary background process that survives this script exiting.
 *
 *   npm run db:up      start (initialising the cluster on first run)
 *   npm run db:down    stop
 *   npm run db:status  running / stopped
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arch, platform } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PG_HOME = resolve(ROOT, '.postgres');
const DATA_DIR = resolve(PG_HOME, 'data');
const LOG_FILE = resolve(PG_HOME, 'postgres.log');
export const PG_USER = 'fintech';
export const PG_PASSWORD = 'fintech';
export const PG_DEFAULT_PORT = 54329;

interface Binaries {
  initdb: string;
  pg_ctl: string;
}

function binaries(): Binaries {
  const os = platform() === 'win32' ? 'windows' : platform();
  const pkg = `@embedded-postgres/${os}-${arch()}`;
  let entry: string;
  try {
    // The package exports only dist/index.js; its native/ dir sits next to dist/.
    entry = createRequire(import.meta.url).resolve(pkg);
  } catch {
    throw new Error(
      `PostgreSQL binaries for ${os}-${arch()} are not installed (${pkg}). Run \`npm install\`; ` +
        'if the platform is unsupported, install PostgreSQL 16 yourself and point DATABASE_URL at it.',
    );
  }
  const bin = resolve(dirname(entry), '..', 'native', 'bin');
  const ext = os === 'windows' ? '.exe' : '';
  const paths = { initdb: resolve(bin, `initdb${ext}`), pg_ctl: resolve(bin, `pg_ctl${ext}`) };
  for (const file of [paths.initdb, paths.pg_ctl, resolve(bin, `postgres${ext}`)]) {
    const mode = statSync(file).mode;
    if ((mode & 0o111) !== 0o111) chmodSync(file, mode | 0o555);
  }
  return paths;
}

function pgCtl(args: readonly string[]): { status: number | null; output: string } {
  const result = spawnSync(binaries().pg_ctl, ['-D', DATA_DIR, ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

export function portFromUrl(databaseUrl: string | undefined): number {
  if (!databaseUrl) return PG_DEFAULT_PORT;
  try {
    const port = new URL(databaseUrl).port;
    return port === '' ? 5432 : Number(port);
  } catch {
    return PG_DEFAULT_PORT;
  }
}

export function isInitialised(): boolean {
  return existsSync(resolve(DATA_DIR, 'PG_VERSION'));
}

export function isRunning(): boolean {
  return isInitialised() && pgCtl(['status']).status === 0;
}

export function initialise(): void {
  mkdirSync(PG_HOME, { recursive: true });
  const pwfile = resolve(PG_HOME, 'pwfile');
  writeFileSync(pwfile, `${PG_PASSWORD}\n`, { mode: 0o600 });
  try {
    const result = spawnSync(
      binaries().initdb,
      ['-D', DATA_DIR, '-U', PG_USER, '--pwfile', pwfile, '--auth', 'scram-sha-256', '-E', 'UTF8', '--no-locale'],
      { encoding: 'utf8' },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`initdb failed:\n${result.stdout}${result.stderr}`);
    }
  } finally {
    rmSync(pwfile, { force: true });
  }
}

/** Starts the cluster on `port`, bound to localhost only. Returns once it accepts connections. */
export function start(port: number): void {
  const options = `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories='${PG_HOME}'`;
  const result = pgCtl(['-l', LOG_FILE, '-o', options, '-w', '-t', '60', 'start']);
  if (result.status !== 0) {
    throw new Error(`PostgreSQL failed to start on port ${port}:\n${result.output}\nLog: ${LOG_FILE}`);
  }
}

export function stop(): void {
  const result = pgCtl(['-m', 'fast', '-w', 'stop']);
  if (result.status !== 0) {
    throw new Error(`pg_ctl stop failed:\n${result.output}`);
  }
}

/** Deletes the cluster entirely (all databases). */
export function destroy(): void {
  if (isRunning()) stop();
  rmSync(PG_HOME, { recursive: true, force: true });
}

function main(): void {
  const command = process.argv[2] ?? 'status';
  const envFile = resolve(ROOT, '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const port = portFromUrl(process.env.DATABASE_URL);
  switch (command) {
    case 'start':
    case 'up':
      if (isRunning()) {
        console.log(`PostgreSQL already running (${DATA_DIR})`);
        return;
      }
      if (!isInitialised()) initialise();
      start(port);
      console.log(`PostgreSQL listening on 127.0.0.1:${port} (${DATA_DIR})`);
      return;
    case 'stop':
    case 'down':
      if (!isRunning()) {
        console.log('PostgreSQL is not running');
        return;
      }
      stop();
      console.log('PostgreSQL stopped');
      return;
    case 'status':
      console.log(isRunning() ? `running (${DATA_DIR})` : isInitialised() ? 'stopped' : 'not initialised');
      return;
    case 'destroy':
      destroy();
      console.log(`Removed ${PG_HOME}`);
      return;
    default:
      console.error(`Unknown command "${command}". Use: start | stop | status | destroy`);
      process.exit(1);
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
