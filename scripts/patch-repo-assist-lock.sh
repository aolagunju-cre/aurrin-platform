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
checkout_step_name = "      - name: Checkout repository for dependency-block handler\n"
dependency_step_name = "      - name: Handle dependency-blocked targeted issues\n"
insert_before = "      - name: Invalidate GitHub App token\n"
fallback_insert_after = "      - name: Update reaction comment with completion status\n"
dedupe_step_name = "      - name: Deduplicate repeated create_pull_request outputs\n"
detection_skip_message = "Detection skipped: PIPELINE_MVP_MODE=true"

checkout_step = <<'STEP'.chomp
      - name: Checkout repository for dependency-block handler
        if: always() && needs.agent.result == 'success' && needs.safe_outputs.result == 'success' && github.event_name == 'workflow_dispatch' && github.event.inputs.issue_number != '' && steps.setup-agent-output-env.outputs.GH_AW_AGENT_OUTPUT != ''
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          fetch-depth: 1
          persist-credentials: false
          token: ${{ steps.safe-outputs-app-token.outputs.token || secrets.GITHUB_TOKEN }}
STEP

dependency_step = <<'STEP'.chomp
      - name: Handle dependency-blocked targeted issues
        if: always() && needs.agent.result == 'success' && needs.safe_outputs.result == 'success' && github.event_name == 'workflow_dispatch' && github.event.inputs.issue_number != '' && steps.setup-agent-output-env.outputs.GH_AW_AGENT_OUTPUT != ''
        env:
          GH_TOKEN: ${{ steps.safe-outputs-app-token.outputs.token || secrets.GITHUB_TOKEN }}
          GH_AW_AGENT_OUTPUT: ${{ steps.setup-agent-output-env.outputs.GH_AW_AGENT_OUTPUT }}
          GH_AW_TARGET_ISSUE: ${{ github.event.inputs.issue_number }}
          REPO: ${{ github.repository }}
        run: |
          bash scripts/handle-dependency-blocked-issue.sh
STEP

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

legacy_dependency_step_pattern = /
^      -\ name:\ Handle\ dependency-blocked\ targeted\ issues\n
.*?
(?=^      -\ name:\ Fail\ targeted\ issue\ runs\ without\ actionable\ output\n)
/mx

legacy_checkout_step_pattern = /
^      -\ name:\ Checkout\ repository\ for\ dependency-block\ handler\n
.*?
(?=^      -\ name:\ Handle\ dependency-blocked\ targeted\ issues\n)
/mx

content.sub!(legacy_checkout_step_pattern, "#{checkout_step}\n")
content.sub!(legacy_dependency_step_pattern, "#{dependency_step}\n")

unless content.include?(checkout_step_name)
  if content.include?(dependency_step_name)
    content.sub!(dependency_step_name, "#{checkout_step}\n#{dependency_step_name}")
  elsif content.include?(step_name)
    content.sub!(step_name, "#{checkout_step}\n#{step_name}")
  elsif content.include?(insert_before)
    content.sub!(insert_before, "#{checkout_step}\n#{insert_before}")
  elsif content.include?(fallback_insert_after)
    anchor = <<'ANCHOR'
      - name: Update reaction comment with completion status
        id: conclusion
ANCHOR
    raise "Could not find insertion point for dependency-block checkout in #{path}" unless content.include?(anchor)
    content.sub!(anchor, "#{anchor}\n#{checkout_step}")
  else
    raise "Could not find insertion point for dependency-block checkout in #{path}"
  end
end

unless content.include?(dependency_step_name)
  if content.include?(step_name)
    content.sub!(step_name, "#{dependency_step}\n#{step_name}")
  elsif content.include?(insert_before)
    content.sub!(insert_before, "#{dependency_step}\n#{insert_before}")
  elsif content.include?(fallback_insert_after)
    anchor = <<'ANCHOR'
      - name: Update reaction comment with completion status
        id: conclusion
ANCHOR
    raise "Could not find insertion point for dependency-block handler in #{path}" unless content.include?(anchor)
    content.sub!(anchor, "#{anchor}\n#{dependency_step}")
  else
    raise "Could not find insertion point for dependency-block handler in #{path}"
  end
end

raise "Patched dependency-block checkout missing in #{path}" unless content.include?(checkout_step_name)
raise "Duplicate dependency-block checkout steps detected in #{path}" unless content.scan(checkout_step_name).length == 1
raise "Dependency-block checkout must use actions/checkout in #{path}" unless content.include?("uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2")
raise "Patched dependency-block handler missing in #{path}" unless content.include?(dependency_step_name)
raise "Duplicate dependency-block handlers detected in #{path}" unless content.scan(dependency_step_name).length == 1
raise "Dependency-block handler must invoke handle-dependency-blocked-issue.sh in #{path}" unless content.include?("bash scripts/handle-dependency-blocked-issue.sh")
raise "Patched targeted issue guard missing in #{path}" unless content.include?(step_name)
raise "Duplicate targeted issue guard detected in #{path}" unless content.scan(step_name).length == 1
raise "Targeted issue guard missing noop guidance in #{path}" unless content.include?("Use missing_data or missing_tool with the exact blocker and next step instead of noop")
raise "Targeted issue guard missing workflow_dispatch issue_number condition in #{path}" unless content.include?("github.event_name == 'workflow_dispatch' && github.event.inputs.issue_number != ''")
raise "Targeted issue guard missing numeric issue check in #{path}" unless content.match?(/if \(!\/\^\\d\+\$\/\.test\(issue \|\| ""\)\) \{/)
raise "Legacy heredoc-based targeted issue guard remains in #{path}" if content.include?("node <<'NODE'")

content.sub!(old_detection_guard, new_detection_guard) unless content.include?(detection_skip_message)
raise "Patched detection guard missing in #{path}" unless content.include?(detection_skip_message)
raise "Patched detection guard missing PIPELINE_MVP_MODE env in #{path}" unless content.include?('PIPELINE_MVP_MODE: ${{ vars.PIPELINE_MVP_MODE }}')

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
