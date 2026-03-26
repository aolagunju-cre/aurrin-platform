#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO="${REPO:-}"

ISSUE_BODY=$(cat)

if [ -n "${OPEN_ISSUES_JSON:-}" ]; then
  OPEN_ISSUES="$OPEN_ISSUES_JSON"
elif [ -n "$REPO" ]; then
  OPEN_ISSUES=$(gh issue list --repo "$REPO" --state open --limit 500 --json number 2>/dev/null || echo '[]')
else
  echo "OPEN_ISSUES_JSON or REPO must be set" >&2
  exit 2
fi

OPEN_NUMBERS=$(printf '%s' "$OPEN_ISSUES" | jq -r '.[].number')
BLOCKED=()

while IFS= read -r DEP_NUM; do
  [ -n "$DEP_NUM" ] || continue
  if printf '%s\n' "$OPEN_NUMBERS" | grep -qx "$DEP_NUM"; then
    BLOCKED+=("#${DEP_NUM}")
  fi
done < <(printf '%s' "$ISSUE_BODY" | bash "$SCRIPT_DIR/extract-issue-dependencies.sh")

if [ "${#BLOCKED[@]}" -gt 0 ]; then
  printf '%s\n' "${BLOCKED[*]}"
fi
