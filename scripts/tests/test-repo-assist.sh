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

grep -F "((github.event_name == 'workflow_dispatch' || github.event_name == 'schedule') && 'backlog')" "$WORKFLOW" >/dev/null || {
  echo "FAIL: repo-assist.md must use a stable backlog concurrency key for schedule/workflow_dispatch runs" >&2
  exit 1
}

grep -F 'do **not** use `noop`. Emit `missing_data` or `missing_tool` with the exact blocker' "$WORKFLOW" >/dev/null || {
  echo "FAIL: targeted issue mode must forbid noop-only completions" >&2
  exit 1
}

grep -F 'cancel-in-progress: true' "$WORKFLOW" >/dev/null || {
  echo "FAIL: repo-assist.md must continue cancelling superseded runs within the shared concurrency group" >&2
  exit 1
}

echo "repo-assist.md tests passed"
