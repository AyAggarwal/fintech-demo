#!/usr/bin/env bash
# One-command demo bootstrap for macOS / Linux:
#   ./demo.sh            install dependencies (if needed) and run `npm run demo`
#   ./demo.sh reset      any argument is passed through to `npm run demo -- <args>`
#
# Only Node.js is required: PostgreSQL binaries are installed by npm and run locally (see scripts/postgres.ts).
# Handles the common first-run failures so nobody has to debug npm:
#   - Node too old / missing                                  -> clear message with the fix
#   - npm cache owned by root (EACCES from an old `sudo npm`)  -> retry with a throwaway cache, no sudo
set -euo pipefail

cd "$(dirname "$0")"

MIN_NODE_MAJOR=20
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

bold "▸ Checking prerequisites"
command -v node >/dev/null 2>&1 || die "Node.js is not installed. Install Node ${MIN_NODE_MAJOR}+ from https://nodejs.org (or: brew install node)."
node_major="$(node -p 'process.versions.node.split(".")[0]')"
[ "$node_major" -ge "$MIN_NODE_MAJOR" ] || die "Node.js ${MIN_NODE_MAJOR}+ is required (found $(node --version)). Upgrade via https://nodejs.org or nvm."
echo "  ✓ Node $(node --version), npm $(npm --version)"

bold "▸ Installing dependencies"
if [ -d node_modules ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
  echo "  ✓ node_modules up to date"
else
  install_log="$(mktemp)"
  if npm install 2>&1 | tee "$install_log"; then
    :
  elif grep -q 'EACCES' "$install_log"; then
    echo
    echo "  npm's cache in ~/.npm is not writable (root-owned files from an old 'sudo npm')."
    echo "  Retrying with a temporary cache. Permanent fix: sudo chown -R \$(id -u):\$(id -g) ~/.npm"
    npm install --cache "$(mktemp -d)" || die "npm install failed. See output above."
  else
    die "npm install failed. See output above."
  fi
  rm -f "$install_log"
  echo "  ✓ dependencies installed"
fi

exec npm run demo -- "$@"
