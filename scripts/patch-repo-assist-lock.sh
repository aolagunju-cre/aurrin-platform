#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)
WORKFLOW_PATH="${1:-$ROOT_DIR/.github/workflows/repo-assist.lock.yml}"

ruby - "$WORKFLOW_PATH" <<'RUBY'
path = ARGV.fetch(0)
content = File.read(path)
original = content.dup

step_name = "      - name: Fail targeted issue runs without actionable output\n"
insert_before = "      - name: Invalidate GitHub App token\n"
fallback_insert_after = "      - name: Update reaction comment with completion status\n"

fail_step = <<'STEP'.chomp
      - name: Fail targeted issue runs without actionable output
        if: always() && needs.agent.result == 'success' && needs.safe_outputs.result == 'success' && github.event_name == 'workflow_dispatch' && github.event.inputs.issue_number != '' && steps.setup-agent-output-env.outputs.GH_AW_AGENT_OUTPUT != ''
        env:
          GH_AW_AGENT_OUTPUT: ${{ steps.setup-agent-output-env.outputs.GH_AW_AGENT_OUTPUT }}
          GH_AW_TARGET_ISSUE: ${{ github.event.inputs.issue_number }}
        run: |
          set +e
          MESSAGE=$(
            node <<'NODE'
            const fs = require('fs');

            const path = process.env.GH_AW_AGENT_OUTPUT;
            const issue = process.env.GH_AW_TARGET_ISSUE;
            const successTypes = new Set(['create_pull_request', 'push_to_pull_request_branch']);
            const blockerTypes = new Set(['missing_data', 'missing_tool']);

            const data = JSON.parse(fs.readFileSync(path, 'utf8'));
            const items = Array.isArray(data.items) ? data.items : [];
            const types = items.map(item => item && item.type).filter(Boolean);

            if (types.some(type => successTypes.has(type))) {
              process.exit(0);
            }

            const blocker = items.find(item => item && blockerTypes.has(item.type));
            if (blocker) {
              const details = [];
              if (blocker.reason) details.push(blocker.reason);
              if (blocker.context) details.push(`Context: ${blocker.context}`);
              if (blocker.alternatives) details.push(`Next step: ${blocker.alternatives}`);
              if (blocker.tool) details.push(`Tool: ${blocker.tool}`);
              if (blocker.data_type) details.push(`Data: ${blocker.data_type}`);

              const message = [
                `Targeted issue #${issue} did not create or update a PR.`,
                `${blocker.type} reported${details.length ? `: ${details.join(' ')}` : '.'}`,
              ].join(' ');
              console.log(message);
              process.exit(2);
            }

            const noop = items.find(item => item && item.type === 'noop');
            const noopMessage = noop && noop.message ? noop.message : 'Agent produced no actionable or blocker safe outputs.';
            console.log(
              `Targeted issue #${issue} ended with noop. Use missing_data or missing_tool with the exact blocker and next step instead of noop. Details: ${noopMessage}`,
            );
            process.exit(3);
            NODE
          )
          STATUS=$?
          set -e

          if [ "$STATUS" -ne 0 ]; then
            echo "::error title=Targeted issue run produced no actionable output::$MESSAGE"
            {
              echo "### Targeted issue dispatch failed closed"
              echo
              echo "$MESSAGE"
            } >> "$GITHUB_STEP_SUMMARY"
            exit 1
          fi
STEP

unless content.include?(step_name)
  if content.include?(insert_before)
    content.sub!(insert_before, "#{fail_step}\n#{insert_before}")
  elsif content.include?(fallback_insert_after)
    anchor = <<'ANCHOR'
      - name: Update reaction comment with completion status
        id: conclusion
ANCHOR
    raise "Could not find insertion point for targeted issue guard in #{path}" unless content.include?(anchor)
    content.sub!(anchor, "#{anchor}\n#{fail_step}")
  else
    raise "Could not find insertion point for targeted issue guard in #{path}"
  end
end

raise "Patched targeted issue guard missing in #{path}" unless content.include?(step_name)
raise "Duplicate targeted issue guard detected in #{path}" unless content.scan(step_name).length == 1
raise "Targeted issue guard missing noop guidance in #{path}" unless content.include?("Use missing_data or missing_tool with the exact blocker and next step instead of noop")
raise "Targeted issue guard missing workflow_dispatch issue_number condition in #{path}" unless content.include?("github.event_name == 'workflow_dispatch' && github.event.inputs.issue_number != ''")

File.write(path, content) if content != original
RUBY

echo "repo-assist lock patch verified: $WORKFLOW_PATH"
