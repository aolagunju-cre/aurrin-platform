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
dedupe_step_name = "      - name: Deduplicate repeated create_pull_request outputs\n"

fail_step = <<'STEP'.chomp
      - name: Fail targeted issue runs without actionable output
        if: always() && needs.agent.result == 'success' && needs.safe_outputs.result == 'success' && github.event_name == 'workflow_dispatch' && github.event.inputs.issue_number != '' && steps.setup-agent-output-env.outputs.GH_AW_AGENT_OUTPUT != ''
        env:
          GH_AW_AGENT_OUTPUT: ${{ steps.setup-agent-output-env.outputs.GH_AW_AGENT_OUTPUT }}
          GH_AW_TARGET_ISSUE: ${{ github.event.inputs.issue_number }}
        run: |
          set +e
          MESSAGE=$(node -e '
          const fs = require("fs");

          const path = process.env.GH_AW_AGENT_OUTPUT;
          const issue = process.env.GH_AW_TARGET_ISSUE;
          const successTypes = new Set(["create_pull_request", "push_to_pull_request_branch"]);
          const blockerTypes = new Set(["missing_data", "missing_tool"]);

          if (!/^\d+$/.test(issue || "")) {
            process.exit(0);
          }

          const data = JSON.parse(fs.readFileSync(path, "utf8"));
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
              `${blocker.type} reported${details.length ? `: ${details.join(" ")}` : "."}`,
            ].join(" ");
            console.log(message);
            process.exit(2);
          }

          const noop = items.find(item => item && item.type === "noop");
          const noopMessage = noop && noop.message ? noop.message : "Agent produced no actionable or blocker safe outputs.";
          console.log(
            `Targeted issue #${issue} ended with noop. Use missing_data or missing_tool with the exact blocker and next step instead of noop. Details: ${noopMessage}`,
          );
          process.exit(3);
          ')
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

dedupe_step = <<'STEP'.chomp
      - name: Deduplicate repeated create_pull_request outputs
        if: (!cancelled()) && needs.agent.result != 'skipped' && contains(needs.agent.outputs.output_types, 'create_pull_request')
        run: |
          bash scripts/dedupe-create-pr-safe-outputs.sh \
            /tmp/gh-aw/agent_output.json \
            /tmp/gh-aw/safeoutputs.jsonl
STEP

legacy_step_pattern = /
^      -\ name:\ Fail\ targeted\ issue\ runs\ without\ actionable\ output\n
.*?
(?=^      -\ name:\ Invalidate\ GitHub\ App\ token\n)
/mx

content.sub!(legacy_step_pattern, "#{fail_step}\n")

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
raise "Targeted issue guard missing numeric issue check in #{path}" unless content.match?(/if \(!\/\^\\d\+\$\/\.test\(issue \|\| ""\)\) \{/)
raise "Legacy heredoc-based targeted issue guard remains in #{path}" if content.include?("node <<'NODE'")

process_safe_outputs_step = "      - name: Process Safe Outputs\n"
raise "Could not find Process Safe Outputs step in #{path}" unless content.include?(process_safe_outputs_step)

legacy_dedupe_pattern = /
^      -\ name:\ Deduplicate\ repeated\ create_pull_request\ outputs\n
.*?
(?=^      -\ name:\ Process\ Safe\ Outputs\n)
/mx

content.sub!(legacy_dedupe_pattern, "#{dedupe_step}\n")

unless content.include?(dedupe_step_name)
  content.sub!(process_safe_outputs_step, "#{dedupe_step}\n#{process_safe_outputs_step}")
end

raise "Patched duplicate create_pull_request dedupe step missing in #{path}" unless content.include?(dedupe_step_name)
raise "Duplicate create_pull_request dedupe steps detected in #{path}" unless content.scan(dedupe_step_name).length == 1
raise "Dedupe step must invoke dedupe-create-pr-safe-outputs.sh in #{path}" unless content.include?("bash scripts/dedupe-create-pr-safe-outputs.sh")

File.write(path, content) if content != original
RUBY

echo "repo-assist lock patch verified: $WORKFLOW_PATH"
