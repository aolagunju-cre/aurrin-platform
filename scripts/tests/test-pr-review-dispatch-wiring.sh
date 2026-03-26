#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
REPO_ASSIST_MD="$ROOT_DIR/.github/workflows/repo-assist.md"
FRONTEND_MD="$ROOT_DIR/.github/workflows/frontend-agent.md"
REVIEW_MD="$ROOT_DIR/.github/workflows/pr-review-agent.md"
REPO_ASSIST_LOCK="$ROOT_DIR/.github/workflows/repo-assist.lock.yml"
FRONTEND_LOCK="$ROOT_DIR/.github/workflows/frontend-agent.lock.yml"
REVIEW_LOCK="$ROOT_DIR/.github/workflows/pr-review-agent.lock.yml"

for workflow in "$REPO_ASSIST_MD" "$FRONTEND_MD" "$REVIEW_MD"; do
  ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$workflow" >/dev/null
done

grep -F 'dispatch-workflow:' "$REPO_ASSIST_MD" >/dev/null
grep -F 'workflows: [pr-review-agent]' "$REPO_ASSIST_MD" >/dev/null
grep -F 'use `dispatch_workflow` to dispatch `pr-review-agent` with the exact `pr_number` returned by the PR creation result' "$REPO_ASSIST_MD" >/dev/null
grep -F "If \`\${{ vars.PIPELINE_MVP_MODE }}\` is \`true\`, do **not** dispatch \`pr-review-agent\` after PR creation." "$REPO_ASSIST_MD" >/dev/null

grep -F 'dispatch-workflow:' "$FRONTEND_MD" >/dev/null
grep -F 'workflows: [pr-review-agent]' "$FRONTEND_MD" >/dev/null
grep -F 'use `dispatch_workflow` to dispatch `pr-review-agent` with the exact `pr_number` returned by the PR creation result' "$FRONTEND_MD" >/dev/null
grep -F "If \`\${{ vars.PIPELINE_MVP_MODE }}\` is \`true\`, do not dispatch \`pr-review-agent\` after PR creation" "$FRONTEND_MD" >/dev/null

if grep -Fq 'gh workflow run pr-review-agent.lock.yml' "$REPO_ASSIST_MD"; then
  echo "FAIL: repo-assist.md still uses gh workflow run for pr-review-agent dispatch" >&2
  exit 1
fi

if grep -Fq 'gh workflow run pr-review-agent.lock.yml' "$FRONTEND_MD"; then
  echo "FAIL: frontend-agent.md still uses gh workflow run for pr-review-agent dispatch" >&2
  exit 1
fi

grep -F 'pr_number:' "$REVIEW_MD" >/dev/null
grep -F 'type: number' "$REVIEW_MD" >/dev/null
grep -F 'If triggered by `workflow_dispatch` and `${{ github.event.inputs.pr_number }}` is non-empty' "$REVIEW_MD" >/dev/null

grep -F 'dispatch_workflow' "$REPO_ASSIST_LOCK" >/dev/null
grep -F 'aw_context_workflows\":[\"pr-review-agent\"]' "$REPO_ASSIST_LOCK" >/dev/null
grep -F '\"max\":4,\"workflow_files\":{\"pr-review-agent\":\".lock.yml\"}' "$REPO_ASSIST_LOCK" >/dev/null
grep -F '"pr_number": {' "$REPO_ASSIST_LOCK" >/dev/null

grep -F 'dispatch_workflow' "$FRONTEND_LOCK" >/dev/null
grep -F 'aw_context_workflows\":[\"pr-review-agent\"]' "$FRONTEND_LOCK" >/dev/null
grep -F '\"max\":2,\"workflow_files\":{\"pr-review-agent\":\".lock.yml\"}' "$FRONTEND_LOCK" >/dev/null
grep -F '"pr_number": {' "$FRONTEND_LOCK" >/dev/null
grep -F 'description: PR number to review explicitly. Leave empty to fall back to the latest open [Pipeline] PR.' "$REVIEW_LOCK" >/dev/null
grep -F 'type: number' "$REVIEW_LOCK" >/dev/null

echo "pr-review dispatch wiring tests passed"
