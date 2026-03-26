#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/auto-dispatch-requeue.yml"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F 'pull_request:' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must listen for merged pipeline pull requests" >&2
  exit 1
}

grep -F 'types: [closed]' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must trigger on pull_request closed events" >&2
  exit 1
}

grep -F "github.event_name == 'pull_request'" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must handle merged pull_request events in its gate" >&2
  exit 1
}

grep -F 'github.event.pull_request.merged == true' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must require pull_request merges before advancing the backlog" >&2
  exit 1
}

grep -F "startsWith(github.event.pull_request.title, '[Pipeline]')" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must scope merge-triggered backlog advances to pipeline PRs" >&2
  exit 1
}

grep -F 'workflow_run.name == '\''Pipeline Repo Assist'\''' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must scope transient retries to Pipeline Repo Assist" >&2
  exit 1
}

grep -F "<!-- provider-retry:v1" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must record provider retry markers" >&2
  exit 1
}

grep -F "Auto-retrying issue #\${ISSUE_NUMBER} after a transient provider failure" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must explain automatic transient retries" >&2
  exit 1
}

grep -F "<!-- code-push-retry:v1" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must record patch-apply retry markers" >&2
  exit 1
}

grep -F "Auto-retrying issue #\${ISSUE_NUMBER} after a patch-apply failure" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must explain automatic patch-apply retries" >&2
  exit 1
}

grep -F "failed to apply patch|could not build fake ancestor|sha1 information is lacking or useless" "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must detect patch-apply failure signatures before retrying" >&2
  exit 1
}

grep -F 'bash scripts/extract-issue-dependencies.sh' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must consult explicit issue dependencies before choosing backlog fallback" >&2
  exit 1
}

grep -F -- '--json number,title,createdAt,labels,body' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must read issue bodies for dependency-aware backlog fallback" >&2
  exit 1
}

grep -F 'gh workflow run "$WORKFLOW_FILE" \' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must dispatch the owning workflow" >&2
  exit 1
}

grep -F 'if [ "$SELECTED_WORKFLOW" = "repo-assist.lock.yml" ] || [ "$SELECTED_WORKFLOW" = "prd-decomposer.lock.yml" ]; then' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must pass issue_number to repo-assist and prd-decomposer re-dispatches" >&2
  exit 1
}

grep -F -- '-f issue_number="$ISSUE_NUMBER"' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must target the same issue when retrying repo-assist" >&2
  exit 1
}

if grep -Fq 'GH_TOKEN="$GH_AW_GITHUB_TOKEN" gh workflow run' "$WORKFLOW"; then
  echo "FAIL: auto-dispatch-requeue should use the workflow GITHUB_TOKEN for workflow_dispatch" >&2
  exit 1
fi

if grep -Fq 'GH_AW_GITHUB_TOKEN is unavailable; cannot re-dispatch via workflow_dispatch.' "$WORKFLOW"; then
  echo "FAIL: auto-dispatch-requeue should not depend on GH_AW_GITHUB_TOKEN for workflow_dispatch" >&2
  exit 1
fi

if grep -Fq 'GH_AW_GITHUB_TOKEN is unavailable; cannot retry transient provider failures.' "$WORKFLOW"; then
  echo "FAIL: auto-dispatch-requeue should not block transient retries on GH_AW_GITHUB_TOKEN" >&2
  exit 1
fi

grep -F 'Issue #${ISSUE_NUM}: skipping immediate re-dispatch of the just-completed issue.' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must avoid immediately re-dispatching the run that just completed" >&2
  exit 1
}

grep -F 'gh issue view "$issue_number" --repo "$REPO" --json state --jq '\''.state'\''' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must re-check live issue state before dispatching a selected issue" >&2
  exit 1
}

grep -F 'selected from a stale snapshot but current state is ${LIVE_STATE}; refreshing queue selection' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must refresh selection when a previously selected issue is now closed" >&2
  exit 1
}

grep -F 'aborting stale re-dispatch after refresh attempts' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must stop rather than dispatch a closed issue after repeated refreshes" >&2
  exit 1
}

grep -F 'SELECTED_REASON="requeue_backlog_fallback"' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must tag backlog fallback redispatches distinctly" >&2
  exit 1
}

grep -F '"dispatch_reason=${SELECTED_REASON}"' "$WORKFLOW" >/dev/null || {
  echo "FAIL: auto-dispatch-requeue must persist the selected dispatch reason in its marker comment" >&2
  exit 1
}

echo "auto-dispatch-requeue.yml tests passed"
