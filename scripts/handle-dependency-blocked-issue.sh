#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

AGENT_OUTPUT="${GH_AW_AGENT_OUTPUT:-}"
TARGET_ISSUE="${GH_AW_TARGET_ISSUE:-}"
REPO="${REPO:-}"

if [ -z "$AGENT_OUTPUT" ] || [ -z "$TARGET_ISSUE" ] || [ -z "$REPO" ]; then
  exit 0
fi

if ! [[ "$TARGET_ISSUE" =~ ^[0-9]+$ ]]; then
  exit 0
fi

if [ ! -f "$AGENT_OUTPUT" ]; then
  exit 0
fi

BLOCKER_JSON=$(jq -c '.items[]? | select(.type == "missing_data")' "$AGENT_OUTPUT" | head -n 1)
if [ -z "$BLOCKER_JSON" ]; then
  exit 0
fi

ISSUE_JSON=$(gh issue view "$TARGET_ISSUE" --repo "$REPO" --json body,labels 2>/dev/null || echo '{}')
ISSUE_BODY=$(printf '%s' "$ISSUE_JSON" | jq -r '.body // ""')
BLOCKING_DEPENDENCIES=$(printf '%s' "$ISSUE_BODY" | bash "$SCRIPT_DIR/open-issue-dependencies.sh" 2>/dev/null || true)

if [ -z "$BLOCKING_DEPENDENCIES" ]; then
  exit 0
fi

LABELS_CSV=$(printf '%s' "$ISSUE_JSON" | jq -r '[.labels[]?.name // empty] | join(",")')
if ! printf '%s' "$LABELS_CSV" | grep -Eq '(^|,)blocked(,|$)'; then
  gh issue edit "$TARGET_ISSUE" --repo "$REPO" --add-label blocked >/dev/null 2>&1 || \
    echo "::warning::Could not add blocked label to issue #${TARGET_ISSUE}"
fi

BLOCKER_REASON=$(printf '%s' "$BLOCKER_JSON" | jq -r '.reason // ""')
BLOCKER_CONTEXT=$(printf '%s' "$BLOCKER_JSON" | jq -r '.context // ""')
BLOCKER_ALTERNATIVES=$(printf '%s' "$BLOCKER_JSON" | jq -r '.alternatives // ""')

DISPATCH_OUTPUT=$(gh workflow run auto-dispatch-requeue.yml --repo "$REPO" 2>&1 || true)
RUN_URL=$(printf '%s\n' "$DISPATCH_OUTPUT" | grep -Eo 'https://github\.com/[^[:space:]]+/actions/runs/[0-9]+' | tail -n 1 || true)

{
  echo "### Dependency-blocked issue auto-rerouted"
  echo
  echo "Issue #${TARGET_ISSUE} was labeled \`blocked\` because these dependencies are still open: ${BLOCKING_DEPENDENCIES}."
  if [ -n "$RUN_URL" ]; then
    echo "Triggered Auto-Dispatch Requeue: ${RUN_URL}"
  else
    echo "Triggered Auto-Dispatch Requeue without a confirmed run URL."
  fi
  if [ -n "$BLOCKER_REASON$BLOCKER_CONTEXT$BLOCKER_ALTERNATIVES" ]; then
    echo
    echo "Agent blocker summary: ${BLOCKER_REASON} ${BLOCKER_CONTEXT} ${BLOCKER_ALTERNATIVES}"
  fi
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
