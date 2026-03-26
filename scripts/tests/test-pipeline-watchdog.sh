#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/pipeline-watchdog.sh"
WORKFLOW="$ROOT_DIR/.github/workflows/pipeline-watchdog.yml"

bash -n "$SCRIPT"

grep -F 'cron: "*/20 * * * *"' "$WORKFLOW" >/dev/null
grep -F "run: bash scripts/pipeline-watchdog.sh" "$WORKFLOW" >/dev/null
grep -F 'PIPELINE_MVP_MODE: ${{ vars.PIPELINE_MVP_MODE }}' "$WORKFLOW" >/dev/null
grep -F "workflow_active_runs()" "$SCRIPT" >/dev/null
grep -F "dispatch_issue_workflow()" "$SCRIPT" >/dev/null
grep -F "dispatch_requeue_workflow()" "$SCRIPT" >/dev/null
grep -F "workflow_for_branch()" "$SCRIPT" >/dev/null
grep -F "command_for_branch()" "$SCRIPT" >/dev/null
grep -F "find_marker_comments()" "$SCRIPT" >/dev/null
grep -F "sync_pr_repair_labels()" "$SCRIPT" >/dev/null
grep -F 'PIPELINE_MVP_MODE="${PIPELINE_MVP_MODE:-false}"' "$SCRIPT" >/dev/null
grep -F 'gh pr merge "$PR_NUM" --repo "$REPO" --squash --admin --delete-branch' "$SCRIPT" >/dev/null
grep -F 'gh workflow run "auto-dispatch-requeue.yml" --repo "$REPO"' "$SCRIPT" >/dev/null
grep -F 'workflow_name=${workflow_name}' "$SCRIPT" >/dev/null
grep -F -- '--workflow-name "$FAILURE_WORKFLOW_NAME"' "$SCRIPT" >/dev/null
grep -F 'gh workflow run "$workflow_file" --repo "$REPO" -f issue_number="$issue_number"' "$SCRIPT" >/dev/null

if grep -F "Skipping watchdog actions." "$SCRIPT" >/dev/null; then
  echo "FAIL: watchdog should not short-circuit all work when any agent is active" >&2
  exit 1
fi

echo "pipeline-watchdog.sh tests passed"
