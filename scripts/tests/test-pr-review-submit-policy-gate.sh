#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/pr-review-submit.yml"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

grep -F "scripts/check-autonomy-policy.sh" "$WORKFLOW" >/dev/null
grep -F "scripts/classify-pipeline-pr.sh" "$WORKFLOW" >/dev/null
grep -F "scripts/extract-linked-issue-numbers.sh" "$WORKFLOW" >/dev/null
grep -F "autonomy-policy.yml" "$WORKFLOW" >/dev/null
grep -F "policy_artifact_change" "$WORKFLOW" >/dev/null
grep -F "workflow_file_change" "$WORKFLOW" >/dev/null
grep -F "deploy_policy_change" "$WORKFLOW" >/dev/null
grep -F "steps.policy.outputs.auto_merge_allowed == 'true'" "$WORKFLOW" >/dev/null
grep -F "AUTO_FOLLOW_UP_ALLOWED" "$WORKFLOW" >/dev/null
grep -F "Skipping autonomous merge for PR classification:" "$WORKFLOW" >/dev/null
grep -F "Autonomous merge blocked by autonomy policy." "$WORKFLOW" >/dev/null
grep -F "MVP fast-track merge (pipeline PRs regardless of verdict)" "$WORKFLOW" >/dev/null
grep -F "vars.PIPELINE_MVP_MODE == 'true'" "$WORKFLOW" >/dev/null
grep -F 'gh pr view "$PR_NUMBER" --repo "$REPO" --json title,state,isDraft,headRefName,baseRefName,author' "$WORKFLOW" >/dev/null
grep -F "continue-on-error: \${{ vars.PIPELINE_MVP_MODE == 'true' }}" "$WORKFLOW" >/dev/null
grep -F "PRIMARY_MERGE_TOKEN" "$WORKFLOW" >/dev/null
grep -F "FALLBACK_MERGE_TOKEN" "$WORKFLOW" >/dev/null
grep -F 'Primary merge token failed for PR #${PR_NUMBER}; retrying with fallback token.' "$WORKFLOW" >/dev/null
grep -F "Dispatch requeue after MVP merge" "$WORKFLOW" >/dev/null
grep -F 'gh workflow run auto-dispatch-requeue.yml --repo "$REPO"' "$WORKFLOW" >/dev/null
grep -F 'Dispatched and verified auto-dispatch-requeue after MVP merge of PR #${PR_NUMBER}.' "$WORKFLOW" >/dev/null
grep -F "PRIMARY_DISPATCH_TOKEN" "$WORKFLOW" >/dev/null
grep -F "FALLBACK_DISPATCH_TOKEN" "$WORKFLOW" >/dev/null
grep -F 'GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}' "$WORKFLOW" >/dev/null
grep -F 'Confirmed auto-dispatch-requeue run ${run_id} after ${label} dispatch.' "$WORKFLOW" >/dev/null
grep -F 'Primary dispatch token did not produce a verified requeue run for PR #${PR_NUMBER}; retrying with fallback token.' "$WORKFLOW" >/dev/null
grep -F 'Dispatch requeue after MVP merge reported success path but no auto-dispatch-requeue run was created for PR #${PR_NUMBER}.' "$WORKFLOW" >/dev/null
grep -F 'gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --admin --delete-branch' "$WORKFLOW" >/dev/null
grep -F "merged via MVP fast-track mode" "$WORKFLOW" >/dev/null
grep -F "bug\" or . == \"docs\" or . == \"test\"" "$WORKFLOW" >/dev/null
grep -F "startsWith(github.event.comment.body, '/approve_sensitive')" "$WORKFLOW" >/dev/null
grep -F 'gh api repos/${{ github.repository }}/collaborators/${{ github.event.comment.user.login }}/permission' "$WORKFLOW" >/dev/null
grep -F "Resolve review actor login" "$WORKFLOW" >/dev/null
grep -F "gh api user --jq '.login'" "$WORKFLOW" >/dev/null
grep -F 'User ${{ github.event.comment.user.login }} does not have write access' "$WORKFLOW" >/dev/null
grep -F 'COMMENT_URL=$(gh api "/repos/${REPO}/issues/comments/${COMMENT_ID}"' "$WORKFLOW" >/dev/null
grep -F 'See the full Pipeline Review Agent verdict in [the linked comment]' "$WORKFLOW" >/dev/null
grep -F 'Cannot use \`/approve-sensitive\` here.' "$WORKFLOW" >/dev/null
grep -F 'no active \`sensitive_app_change\` policy match' "$WORKFLOW" >/dev/null
grep -F 'BLOCKING_ACTION="$ACTION"' "$WORKFLOW" >/dev/null
grep -F 'awaiting /approve-sensitive from a maintainer' "$WORKFLOW" >/dev/null
grep -F 'Submitted by PR Review Submit.' "$WORKFLOW" >/dev/null
grep -F '2>/dev/null || echo "0"' "$WORKFLOW" >/dev/null

if grep -Fq "github.event.comment.user.login == github.repository_owner" "$WORKFLOW"; then
  echo "FAIL: pr-review-submit.yml still hardcodes github.repository_owner as the trusted commenter" >&2
  exit 1
fi

if grep -Fq 'Submitted by Pipeline Review Submit (github-actions[bot]).' "$WORKFLOW"; then
  echo "FAIL: pr-review-submit.yml still hardcodes github-actions[bot] as the review identity" >&2
  exit 1
fi

if grep -Fq 'repository owner must comment `/approve-sensitive`' "$WORKFLOW"; then
  echo "FAIL: pr-review-submit.yml still requires the repo owner for /approve-sensitive" >&2
  exit 1
fi

if grep -Fq 'awaiting /approve-sensitive from repo owner' "$WORKFLOW"; then
  echo "FAIL: pr-review-submit.yml still waits on the repo owner for sensitive approval" >&2
  exit 1
fi

ruby -e '
  text = File.read(ARGV[0])
  count = text.scan(/- name: Set review status check\n(?:.*\n){0,8}?\s+GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \|\| secrets\.GH_AW_GITHUB_TOKEN \}\}/).length
  abort("FAIL: expected both review status check steps to prefer GITHUB_TOKEN before GH_AW_GITHUB_TOKEN") unless count >= 2
' "$WORKFLOW"

ruby -e '
  text = File.read(ARGV[0])
  count = text.scan(/- name: Check idempotency \(skip if same verdict already reviewed at current HEAD\)\n(?:.*\n){0,8}?\s+GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \|\| secrets\.GH_AW_GITHUB_TOKEN \}\}/).length
  abort("FAIL: expected both idempotency steps to prefer GITHUB_TOKEN before GH_AW_GITHUB_TOKEN") unless count >= 2
' "$WORKFLOW"

ruby -e '
  text = File.read(ARGV[0])
  count = text.scan(/- name: Dispatch owning agent for next cycle\n(?:.*\n){0,8}?\s+GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/).length
  abort("FAIL: expected both follow-up dispatch steps to use GITHUB_TOKEN") unless count >= 2
' "$WORKFLOW"

FOLLOW_UP_COUNT=$(grep -c "name: Dispatch owning agent for next cycle" "$WORKFLOW")
if [ "$FOLLOW_UP_COUNT" -lt 2 ]; then
  echo "FAIL: expected both follow-up dispatch steps to exist" >&2
  exit 1
fi

MVP_SKIP_COUNT=$(grep -c "vars.PIPELINE_MVP_MODE != 'true'" "$WORKFLOW")
if [ "$MVP_SKIP_COUNT" -lt 2 ]; then
  echo "FAIL: expected follow-up/merge gates to skip when PIPELINE_MVP_MODE is enabled" >&2
  exit 1
fi

MVP_REQUEUE_COUNT=$(grep -c "name: Dispatch requeue after MVP merge" "$WORKFLOW")
if [ "$MVP_REQUEUE_COUNT" -lt 2 ]; then
  echo "FAIL: expected MVP requeue dispatch steps in both pr-review-submit jobs" >&2
  exit 1
fi

PRIMARY_DISPATCH_COUNT=$(grep -c "PRIMARY_DISPATCH_TOKEN" "$WORKFLOW")
if [ "$PRIMARY_DISPATCH_COUNT" -lt 2 ]; then
  echo "FAIL: expected both MVP requeue steps to use primary dispatch tokens" >&2
  exit 1
fi

CONFIRMED_REQUEUE_COUNT=$(grep -c "Confirmed auto-dispatch-requeue run" "$WORKFLOW")
if [ "$CONFIRMED_REQUEUE_COUNT" -lt 2 ]; then
  echo "FAIL: expected both MVP requeue steps to verify that a requeue run was actually created" >&2
  exit 1
fi

DISPATCH_GH_TOKEN_COUNT=$(ruby -e '
  text = File.read(ARGV[0])
  count = text.scan(/- name: Dispatch requeue after MVP merge\n(?:.*\n){0,10}?\s+GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/).length
  puts count
' "$WORKFLOW")
if [ "$DISPATCH_GH_TOKEN_COUNT" -lt 2 ]; then
  echo "FAIL: expected both MVP requeue steps to keep GH_TOKEN for GitHub CLI read operations" >&2
  exit 1
fi

POLICY_STEP_COUNT=$(grep -c "id: policy" "$WORKFLOW")
if [ "$POLICY_STEP_COUNT" -lt 2 ]; then
  echo "FAIL: expected autonomy policy gate in both pr-review-submit jobs" >&2
  exit 1
fi

APPROVE_HELPER_COUNT=$(grep -c "scripts/check-autonomy-policy.sh" "$WORKFLOW")
if [ "$APPROVE_HELPER_COUNT" -lt 3 ]; then
  echo "FAIL: expected /approve-sensitive handler to evaluate autonomy policy too" >&2
  exit 1
fi

echo "pr-review-submit.yml policy gate tests passed"
