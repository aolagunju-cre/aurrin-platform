#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/patch-pr-review-agent-lock.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

WORKFLOW="$TMPDIR/pr-review-agent.lock.yml"

cat > "$WORKFLOW" <<'YAML'
name: test
jobs:
  activation:
    needs: pre_activation
    if: >
      needs.pre_activation.outputs.activated == 'true' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.id == github.repository_id)
    runs-on: ubuntu-slim
  pre_activation:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.id == github.repository_id
    runs-on: ubuntu-slim
    outputs:
      activated: ${{ steps.check_membership.outputs.is_team_member == 'true' }}
      matched_command: ''
    steps:
      - name: Setup Scripts
        uses: github/gh-aw/actions/setup@v0.53.3
        with:
          destination: /opt/gh-aw/actions
      - name: Check team membership for workflow
        id: check_membership
        uses: actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8
        env:
          GH_AW_REQUIRED_ROLES: admin,maintainer,write
        with:
          github-token: ${{ secrets.GH_AW_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}
          script: |
            const { setupGlobals } = require('/opt/gh-aw/actions/setup_globals.cjs');
            setupGlobals(core, github, context, exec, io);
            const { main } = require('/opt/gh-aw/actions/check_membership.cjs');
            await main();
  safe_outputs:
    permissions:
      contents: read
      discussions: write
      issues: write
      pull-requests: write
    steps:
      - name: Process Safe Outputs
        id: process_safe_outputs
        uses: actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          script: |
            const { setupGlobals } = require('/opt/gh-aw/actions/setup_globals.cjs');
            setupGlobals(core, github, context, exec, io);
            const { main } = require('/opt/gh-aw/actions/check_membership.cjs');
            await main();
      - name: Upload safe output items
        if: always()
        uses: actions/upload-artifact@v4
  agent:
    steps:
      - name: Check if detection needed
        id: detection_guard
        if: always()
        env:
          OUTPUT_TYPES: ${{ steps.collect_output.outputs.output_types }}
          HAS_PATCH: ${{ steps.collect_output.outputs.has_patch }}
        run: |
          if [[ -n "$OUTPUT_TYPES" || "$HAS_PATCH" == "true" ]]; then
            echo "run_detection=true" >> "$GITHUB_OUTPUT"
            echo "Detection will run: output_types=$OUTPUT_TYPES, has_patch=$HAS_PATCH"
          else
            echo "run_detection=false" >> "$GITHUB_OUTPUT"
            echo "Detection skipped: no agent outputs or patches to analyze"
          fi
YAML

hash_file() {
  ruby -e 'require "digest"; print Digest::SHA256.file(ARGV[0]).hexdigest' "$1"
}

bash "$SCRIPT" "$WORKFLOW" >/dev/null
FIRST_HASH=$(hash_file "$WORKFLOW")

bash "$SCRIPT" "$WORKFLOW" >/dev/null
SECOND_HASH=$(hash_file "$WORKFLOW")

[ "$FIRST_HASH" = "$SECOND_HASH" ]

grep -F "      - name: Activate same-repo pull request without membership gate" "$WORKFLOW" >/dev/null
grep -F "steps.activate_pull_request.outputs.activated == 'true' || steps.check_membership.outputs.is_team_member == 'true'" "$WORKFLOW" >/dev/null
grep -F "vars.PIPELINE_MVP_MODE != 'true' || github.event_name != 'pull_request' || !startsWith(github.event.pull_request.title, '[Pipeline]')" "$WORKFLOW" >/dev/null
grep -F "if: steps.activate_pull_request.outputs.activated != 'true'" "$WORKFLOW" >/dev/null
grep -F 'github-token: ${{ secrets.GITHUB_TOKEN || secrets.GH_AW_GITHUB_TOKEN }}' "$WORKFLOW" >/dev/null
grep -F '      actions: write' "$WORKFLOW" >/dev/null
grep -F "      - name: Dispatch pr-review-submit for posted verdict" "$WORKFLOW" >/dev/null
grep -F "if: steps.process_safe_outputs.outputs.comment_id != ''" "$WORKFLOW" >/dev/null
grep -F 'gh workflow run pr-review-submit.yml --repo "$REPO" -f pr_number="$PR_NUMBER" -f verdict="$VERDICT" -f summary="$SUMMARY"' "$WORKFLOW" >/dev/null
grep -F 'PR_STATE=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json state --jq '\''.state'\'' 2>/dev/null || true)' "$WORKFLOW" >/dev/null
grep -F 'skipping pr-review-submit dispatch for async audit' "$WORKFLOW" >/dev/null
grep -F 'PIPELINE_MVP_MODE: ${{ vars.PIPELINE_MVP_MODE }}' "$WORKFLOW" >/dev/null
grep -F 'Detection skipped: PIPELINE_MVP_MODE=true' "$WORKFLOW" >/dev/null

[ "$(grep -c "^      - name: Activate same-repo pull request without membership gate$" "$WORKFLOW")" -eq 1 ]
[ "$(grep -c "^        if: steps.activate_pull_request.outputs.activated != 'true'$" "$WORKFLOW")" -eq 1 ]
[ "$(grep -c "^      - name: Dispatch pr-review-submit for posted verdict$" "$WORKFLOW")" -eq 1 ]

if grep -q "^- name: Activate same-repo pull request without membership gate$" "$WORKFLOW"; then
  echo "FAIL: bypass step was inserted without workflow indentation" >&2
  exit 1
fi

if grep -Fq 'github-token: ${{ secrets.GH_AW_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}' "$WORKFLOW"; then
  echo "FAIL: old github-token precedence remained in pr-review-agent lock patch output" >&2
  exit 1
fi

if ! ruby -e 'text = File.read(ARGV[0]); start = text.index("  safe_outputs:\n"); finish = text.index("\n  conclusion:\n", start || 0) || text.length; block = start ? text[start...finish] : nil; exit(block&.include?("      actions: write\n") ? 0 : 1)' "$WORKFLOW"; then
  echo "FAIL: safe_outputs permissions did not gain actions: write" >&2
  exit 1
fi

echo "patch-pr-review-agent-lock.sh tests passed"
