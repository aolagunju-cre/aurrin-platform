#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
WORKFLOW_PATH="${1:-$ROOT_DIR/.github/workflows/pr-review-agent.lock.yml}"

ruby - "$WORKFLOW_PATH" <<'RUBY'
path = ARGV.fetch(0)
content = File.read(path)
original = content.dup

bypass_step = <<'STEP'.chomp
      - name: Activate same-repo pull request without membership gate
        id: activate_pull_request
        if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.id == github.repository_id
        run: |
          echo "Same-repository pull request event detected; bypassing membership gate."
          echo "activated=true" >> "$GITHUB_OUTPUT"
STEP

malformed_bypass_step = <<'STEP'.chomp
- name: Activate same-repo pull request without membership gate
  id: activate_pull_request
  if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.id == github.repository_id
  run: |
    echo "Same-repository pull request event detected; bypassing membership gate."
    echo "activated=true" >> "$GITHUB_OUTPUT"
STEP

old_activated_output = "      activated: ${{ steps.check_membership.outputs.is_team_member == 'true' }}"
new_activated_output = "      activated: ${{ steps.activate_pull_request.outputs.activated == 'true' || steps.check_membership.outputs.is_team_member == 'true' }}"
old_github_token_expr = "github-token: ${{ secrets.GH_AW_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}"
new_github_token_expr = "github-token: ${{ secrets.GITHUB_TOKEN || secrets.GH_AW_GITHUB_TOKEN }}"
dispatch_step = <<'STEP'.chomp
      - name: Dispatch pr-review-submit for posted verdict
        if: steps.process_safe_outputs.outputs.comment_id != ''
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          REPO: ${{ github.repository }}
          COMMENT_ID: ${{ steps.process_safe_outputs.outputs.comment_id }}
          PR_NUMBER: ${{ github.event.pull_request.number || github.event.inputs.pr_number }}
        run: |
          if [ -z "$PR_NUMBER" ]; then
            PR_NUMBER=$(gh api "/repos/${REPO}/issues/comments/${COMMENT_ID}" --jq '.issue_url | capture("/issues/(?<n>[0-9]+)$").n' 2>/dev/null || true)
          fi
          if [ -z "$PR_NUMBER" ]; then
            echo "::warning::Unable to resolve PR number for pr-review-submit dispatch."
            exit 0
          fi

          COMMENT_BODY=$(gh api "/repos/${REPO}/issues/comments/${COMMENT_ID}" --jq '.body')
          VERDICT=$(printf '%s\n' "$COMMENT_BODY" | grep -oE '\*\*VERDICT:\s*(APPROVE|REQUEST_CHANGES)' | sed -E 's/.*(APPROVE|REQUEST_CHANGES)/\1/' | head -1 || true)
          if [ -z "$VERDICT" ]; then
            echo "::warning::Unable to extract verdict from review comment ${COMMENT_ID}."
            exit 0
          fi

          SUMMARY="Submitted automatically from pr-review-agent run ${{ github.run_id }} after posting verdict comment ${COMMENT_ID}."
          gh workflow run pr-review-submit.yml --repo "$REPO" -f pr_number="$PR_NUMBER" -f verdict="$VERDICT" -f summary="$SUMMARY"
STEP
dispatch_step_name = "      - name: Dispatch pr-review-submit for posted verdict\n"
safe_outputs_header = "\n  safe_outputs:\n"
safe_outputs_end_marker = "\n  conclusion:\n"
safe_outputs_pull_requests_line = "      pull-requests: write\n"
safe_outputs_actions_line = "      actions: write\n"
detection_skip_message = "Detection skipped: PIPELINE_MVP_MODE=true"

old_detection_guard = <<'STEP'.chomp
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
STEP

new_detection_guard = <<'STEP'.chomp
      - name: Check if detection needed
        id: detection_guard
        if: always()
        env:
          OUTPUT_TYPES: ${{ steps.collect_output.outputs.output_types }}
          HAS_PATCH: ${{ steps.collect_output.outputs.has_patch }}
          PIPELINE_MVP_MODE: ${{ vars.PIPELINE_MVP_MODE }}
        run: |
          if [[ "${PIPELINE_MVP_MODE:-false}" == "true" ]]; then
            echo "run_detection=false" >> "$GITHUB_OUTPUT"
            echo "Detection skipped: PIPELINE_MVP_MODE=true"
          elif [[ -n "$OUTPUT_TYPES" || "$HAS_PATCH" == "true" ]]; then
            echo "run_detection=true" >> "$GITHUB_OUTPUT"
            echo "Detection will run: output_types=$OUTPUT_TYPES, has_patch=$HAS_PATCH"
          else
            echo "run_detection=false" >> "$GITHUB_OUTPUT"
            echo "Detection skipped: no agent outputs or patches to analyze"
          fi
STEP

unless content.include?(new_activated_output)
  raise "Could not find pre_activation activated output in #{path}" unless content.sub!(old_activated_output, new_activated_output)
end

content.gsub!(malformed_bypass_step, bypass_step)

unless content.include?(bypass_step)
  membership_step = "      - name: Check team membership for workflow\n"
  raise "Could not find membership step in #{path}" unless content.sub!(membership_step, "#{bypass_step}\n#{membership_step}")
end

membership_guard = "        if: steps.activate_pull_request.outputs.activated != 'true'\n"
unless content.include?(membership_guard)
  old_membership_step = "      - name: Check team membership for workflow\n        id: check_membership\n"
  new_membership_step = "      - name: Check team membership for workflow\n#{membership_guard}        id: check_membership\n"
  raise "Could not add membership guard in #{path}" unless content.sub!(old_membership_step, new_membership_step)
end

raise "Patched activated output missing in #{path}" unless content.include?(new_activated_output)
raise "Patched bypass step missing in #{path}" unless content.include?(bypass_step)
raise "Patched membership guard missing in #{path}" unless content.include?(membership_guard)
raise "Duplicate bypass step detected in #{path}" unless content.scan(bypass_step).length == 1
raise "Duplicate membership guard detected in #{path}" unless content.scan(membership_guard).length == 1

content.gsub!(old_github_token_expr, new_github_token_expr)

raise "Patched github-token precedence missing in #{path}" unless content.include?(new_github_token_expr)
raise "Unpatched github-token precedence remains in #{path}" if content.include?(old_github_token_expr)

content.sub!(old_detection_guard, new_detection_guard) unless content.include?(detection_skip_message)
raise "Patched detection guard missing in #{path}" unless content.include?(detection_skip_message)
raise "Patched detection guard missing PIPELINE_MVP_MODE env in #{path}" unless content.include?('PIPELINE_MVP_MODE: ${{ vars.PIPELINE_MVP_MODE }}')

safe_outputs_start = content.index(safe_outputs_header)
raise "Could not find safe_outputs job in #{path}" unless safe_outputs_start
safe_outputs_end = content.index(safe_outputs_end_marker, safe_outputs_start) || content.length
safe_outputs_block = content[safe_outputs_start...safe_outputs_end]

unless safe_outputs_block.include?(safe_outputs_actions_line)
  pull_requests_index = safe_outputs_block.index(safe_outputs_pull_requests_line)
  raise "Could not add actions: write to safe_outputs permissions in #{path}" unless pull_requests_index
  insert_at = safe_outputs_start + pull_requests_index + safe_outputs_pull_requests_line.length
  content.insert(insert_at, safe_outputs_actions_line)
end

safe_outputs_block = content[safe_outputs_start...(content.index(safe_outputs_end_marker, safe_outputs_start) || content.length)]
raise "Patched safe_outputs actions permission missing in #{path}" unless safe_outputs_block.include?(safe_outputs_actions_line)

unless content.include?(dispatch_step_name)
  upload_step = "      - name: Upload safe output items\n"
  if content.include?(upload_step)
    content.sub!(upload_step) { "#{dispatch_step}\n#{upload_step}" }
  else
    process_safe_outputs_step = "      - name: Process Safe Outputs\n"
    raise "Could not find safe output processing step in #{path}" unless content.include?(process_safe_outputs_step)
    content << "\n#{dispatch_step}\n"
  end
end

raise "Patched pr-review-submit dispatch step missing in #{path}" unless content.include?(dispatch_step_name)
raise "Patched pr-review-submit dispatch command missing in #{path}" unless content.include?('gh workflow run pr-review-submit.yml --repo "$REPO" -f pr_number="$PR_NUMBER" -f verdict="$VERDICT" -f summary="$SUMMARY"')
raise "Duplicate pr-review-submit dispatch step detected in #{path}" unless content.scan(dispatch_step_name).length == 1

File.write(path, content) if content != original
RUBY

echo "pr-review-agent lock patch verified: $WORKFLOW_PATH"
