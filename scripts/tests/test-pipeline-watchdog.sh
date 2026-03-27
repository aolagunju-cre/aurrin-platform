#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/pipeline-watchdog.sh"
WORKFLOW="$ROOT_DIR/.github/workflows/pipeline-watchdog.yml"

bash -n "$SCRIPT"

grep -F 'cron: "*/20 * * * *"' "$WORKFLOW" >/dev/null
grep -F 'workflows: ["PR Review Submit", "Node CI"]' "$WORKFLOW" >/dev/null
grep -F 'types: [completed]' "$WORKFLOW" >/dev/null
grep -F "run: bash scripts/pipeline-watchdog.sh" "$WORKFLOW" >/dev/null
grep -F 'PIPELINE_MVP_MODE: ${{ vars.PIPELINE_MVP_MODE }}' "$WORKFLOW" >/dev/null
grep -F 'name: Create pipeline app token' "$WORKFLOW" >/dev/null
grep -F 'app-id: ${{ vars.PIPELINE_APP_ID }}' "$WORKFLOW" >/dev/null
grep -F 'private-key: ${{ secrets.PIPELINE_APP_PRIVATE_KEY }}' "$WORKFLOW" >/dev/null
grep -F 'PIPELINE_APP_TOKEN: ${{ steps.pipeline_app_token.outputs.token }}' "$WORKFLOW" >/dev/null
grep -F "MVP_MERGE_THRESHOLD_SECONDS:" "$WORKFLOW" >/dev/null
grep -F "MVP_FAST_MERGE_TARGET_PR:" "$WORKFLOW" >/dev/null
grep -F "workflow_active_runs()" "$SCRIPT" >/dev/null
grep -F "open_dependency_numbers()" "$SCRIPT" >/dev/null
grep -F "ensure_dependency_blocked_label()" "$SCRIPT" >/dev/null
grep -F "dispatch_issue_workflow()" "$SCRIPT" >/dev/null
grep -F "dispatch_requeue_workflow()" "$SCRIPT" >/dev/null
grep -F "workflow_for_branch()" "$SCRIPT" >/dev/null
grep -F "command_for_branch()" "$SCRIPT" >/dev/null
grep -F "find_marker_comments()" "$SCRIPT" >/dev/null
grep -F "sync_pr_repair_labels()" "$SCRIPT" >/dev/null
grep -F 'reconcile-parent-pipeline-issues.sh' "$SCRIPT" >/dev/null
grep -F 'open-issue-dependencies.sh' "$SCRIPT" >/dev/null
grep -F '=== Reconciling blocked parent pipeline issues ===' "$SCRIPT" >/dev/null
grep -F 'PIPELINE_MVP_MODE="${PIPELINE_MVP_MODE:-false}"' "$SCRIPT" >/dev/null
grep -F 'MVP_MERGE_THRESHOLD_SECONDS="${MVP_MERGE_THRESHOLD_SECONDS:-1200}"' "$SCRIPT" >/dev/null
grep -F 'MVP_FAST_MERGE_TARGET_PR="${MVP_FAST_MERGE_TARGET_PR:-}"' "$SCRIPT" >/dev/null
grep -F 'skipping because fast-track merge is targeting PR #' "$SCRIPT" >/dev/null
grep -F 'bash "$SCRIPT_DIR/classify-pipeline-pr.sh"' "$SCRIPT" >/dev/null
grep -F 'PRIMARY_MERGE_TOKEN="${PIPELINE_APP_TOKEN:-}"' "$SCRIPT" >/dev/null
grep -F 'SECONDARY_MERGE_TOKEN="${GH_TOKEN:-}"' "$SCRIPT" >/dev/null
grep -F 'READY_TOKEN="${PRIMARY_MERGE_TOKEN:-${SECONDARY_MERGE_TOKEN:-${FALLBACK_MERGE_TOKEN:-}}}"' "$SCRIPT" >/dev/null
grep -F 'merge_with_token "$SECONDARY_MERGE_TOKEN" "secondary" 1' "$SCRIPT" >/dev/null
grep -F 'gh pr merge "$PR_NUM" --repo "$REPO" --squash --admin' "$SCRIPT" >/dev/null
grep -F 'gh workflow run "auto-dispatch-requeue.yml" --repo "$REPO"' "$SCRIPT" >/dev/null
grep -F 'Open pipeline PRs exist (${OPEN_PIPELINE_PR_COUNT}). Skipping orphaned-issue dispatch to preserve one-PR-at-a-time flow.' "$SCRIPT" >/dev/null
grep -F 'excluded from actionable count until dependencies close' "$SCRIPT" >/dev/null
grep -F 'Skipping orphaned dispatch.' "$SCRIPT" >/dev/null
grep -F 'workflow_name=${workflow_name}' "$SCRIPT" >/dev/null
grep -F -- '--workflow-name "$FAILURE_WORKFLOW_NAME"' "$SCRIPT" >/dev/null
grep -F 'gh workflow run "$workflow_file" --repo "$REPO" -f issue_number="$issue_number"' "$SCRIPT" >/dev/null

if grep -F "Skipping watchdog actions." "$SCRIPT" >/dev/null; then
  echo "FAIL: watchdog should not short-circuit all work when any agent is active" >&2
  exit 1
fi

echo "pipeline-watchdog.sh tests passed"
