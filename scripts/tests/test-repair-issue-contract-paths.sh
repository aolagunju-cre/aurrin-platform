#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/repair-issue-contract-paths.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/studio/docs"
touch "$TMPDIR/AGENTS.md" "$TMPDIR/.deploy-profile" "$TMPDIR/README.md" "$TMPDIR/studio/docs/FOUNDER_APPLICATION.md"

BODY=$(cat <<'EOF'
## PRD Traceability

- example

## Existing Contracts to Read

- `AGENTS.md`
- `.deploy-profile`
- `studio/README.md`
- `README.md`
- `studio/docs/FOUNDER_APPLICATION.md`

## Acceptance Criteria

- [ ] Example
EOF
)

REPAIRED=$(printf '%s' "$BODY" | CONTRACT_REPO_ROOT="$TMPDIR" "$SCRIPT")
printf '%s' "$REPAIRED" | jq -e '.changed == true' >/dev/null
printf '%s' "$REPAIRED" | jq -e '.removed_paths == ["studio/README.md"]' >/dev/null
printf '%s' "$REPAIRED" | jq -r '.body' | grep -F '`README.md`' >/dev/null
if printf '%s' "$REPAIRED" | jq -r '.body' | grep -F '`studio/README.md`' >/dev/null; then
  echo "FAIL: repair script should remove missing Existing Contracts paths" >&2
  exit 1
fi

UNCHANGED=$(printf '%s' '## Description

No contract section here.
' | CONTRACT_REPO_ROOT="$TMPDIR" "$SCRIPT")
printf '%s' "$UNCHANGED" | jq -e '.changed == false and .removed_paths == []' >/dev/null

echo "repair-issue-contract-paths.sh tests passed"
