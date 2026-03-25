#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
PROMPT="$ROOT_DIR/.github/workflows/repo-assist.md"

grep -F 'read every path listed under `## Existing Contracts to Read`' "$PROMPT" >/dev/null || {
  echo "FAIL: repo-assist must read every listed contract path before coding" >&2
  exit 1
}

grep -F 'run every command listed under `## Required Validation`' "$PROMPT" >/dev/null || {
  echo "FAIL: repo-assist must run all required validation commands" >&2
  exit 1
}

grep -F 'Never create a PR unless `bash scripts/validate-implementation.sh` passes' "$PROMPT" >/dev/null || {
  echo "FAIL: repo-assist must gate PR creation on the canonical validator" >&2
  exit 1
}

grep -F 'PR body must include a `## Validation` section' "$PROMPT" >/dev/null || {
  echo "FAIL: repo-assist must require a Validation section in the PR body" >&2
  exit 1
}

grep -F 'If a listed repo contract path is missing, stop and comment instead of improvising.' "$PROMPT" >/dev/null || {
  echo "FAIL: repo-assist must stop instead of guessing when a listed contract path is missing" >&2
  exit 1
}

grep -F 'Exception: if Targeted Issue Dispatch Mode is active, never use `noop` as the final outcome.' "$PROMPT" >/dev/null || {
  echo "FAIL: targeted issue mode must fail closed instead of ending with noop" >&2
  exit 1
}

echo "repo-assist validation gate tests passed"
