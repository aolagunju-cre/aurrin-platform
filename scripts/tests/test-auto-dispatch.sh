#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/auto-dispatch.yml"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F "contains(github.event.issue.labels.*.name, 'pipeline')" "$WORKFLOW" >/dev/null

if grep -F "contains(github.event.issue.labels.*.name, 'feature')" "$WORKFLOW" >/dev/null; then
  echo "FAIL: auto-dispatch gate should not require feature label in the workflow condition" >&2
  exit 1
fi

grep -F "scripts/classify-pipeline-issue.sh" "$WORKFLOW" >/dev/null
grep -F "steps.classify.outputs.actionable == 'true'" "$WORKFLOW" >/dev/null
grep -F 'steps.classify.outputs.route == '\''needs_human'\''' "$WORKFLOW" >/dev/null
grep -F 'steps.classify.outputs.route == '\''retry_with_backoff'\''' "$WORKFLOW" >/dev/null
grep -F 'steps.classify.outputs.workflow_file' "$WORKFLOW" >/dev/null
grep -F 'sleep "${{ steps.classify.outputs.backoff_seconds }}"' "$WORKFLOW" >/dev/null
grep -F 'blocking_repo_assist_run_id=${BLOCKING_RUN_ID}' "$WORKFLOW" >/dev/null
grep -F 'repo_assist_run_id=${AGENT_RUN_ID}' "$WORKFLOW" >/dev/null
grep -F 'if [ "$WORKFLOW_FILE" = "repo-assist.lock.yml" ] || [ "$WORKFLOW_FILE" = "prd-decomposer.lock.yml" ]; then' "$WORKFLOW" >/dev/null
grep -F -- '-f issue_number="$ISSUE_NUMBER"' "$WORKFLOW" >/dev/null

ruby -e '
  text = File.read(ARGV[0])
  abort("FAIL: auto-dispatch guard must use GITHUB_TOKEN") unless text.match?(/- name: Skip when owning agent already active\n(?:.*\n){0,8}?\s+GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
  abort("FAIL: auto-dispatch dispatch step must use GITHUB_TOKEN") unless text.match?(/- name: Dispatch owning agent\n(?:.*\n){0,8}?\s+GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
' "$WORKFLOW"

echo "auto-dispatch.yml tests passed"
