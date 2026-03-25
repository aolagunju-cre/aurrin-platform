#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/repo-assist.md"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

COUNT=$(grep -c 'protected-files: allowed' "$WORKFLOW")
if [ "$COUNT" -lt 2 ]; then
  echo "FAIL: repo-assist.md must allow protected-file PR and PR-branch updates" >&2
  exit 1
fi

grep -F 'dispatch-workflow:' "$WORKFLOW" >/dev/null || {
  echo "FAIL: repo-assist.md lost dispatch-workflow safe output" >&2
  exit 1
}

echo "repo-assist.md tests passed"
