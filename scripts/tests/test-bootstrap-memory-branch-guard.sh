#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
BOOTSTRAP_SCRIPT="$ROOT_DIR/scripts/bootstrap.sh"

grep -F 'cat > "$TEMP_DIR/vercel.json"' "$BOOTSTRAP_SCRIPT" >/dev/null || {
  echo "FAIL: bootstrap.sh must seed vercel.json onto memory/repo-assist" >&2
  exit 1
}

grep -F '"deploymentEnabled": false' "$BOOTSTRAP_SCRIPT" >/dev/null || {
  echo "FAIL: bootstrap.sh must disable Vercel auto-deploys on the seeded memory branch" >&2
  exit 1
}

grep -F 'git add state.json vercel.json' "$BOOTSTRAP_SCRIPT" >/dev/null || {
  echo "FAIL: bootstrap.sh must commit the seeded Vercel guard with repo memory state" >&2
  exit 1
}

echo "bootstrap memory branch guard tests passed"
