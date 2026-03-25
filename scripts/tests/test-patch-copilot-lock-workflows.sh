#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/patch-copilot-lock-workflows.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

WORKFLOW="$TMPDIR/test.lock.yml"

cat > "$WORKFLOW" <<'YAML'
name: test
jobs:
  agent:
    outputs:
      output_types: ${{ steps.collect_output.outputs.output_types }}
    steps:
      - name: Execute GitHub Copilot CLI
        id: agentic_execution
        # Copilot CLI tool arguments (sorted):
        timeout-minutes: 60
        run: |
          set -o pipefail
          touch /tmp/gh-aw/agent-step-summary.md
          # shellcheck disable=SC1003
          sudo -E awf --env-all \
            -- /bin/bash -c '/usr/local/bin/copilot --prompt "main"' 2>&1 | tee -a /tmp/gh-aw/agent-stdio.log
        env:
          COPILOT_GITHUB_TOKEN: token
      - name: Ingest agent output
        id: collect_output
        if: always()
        uses: actions/github-script@v8
      - name: Parse MCP Gateway logs for step summary
        if: always()
        uses: actions/github-script@v8
      - name: Print firewall logs
        if: always()
        continue-on-error: true
        run: echo ok
      - name: Execute GitHub Copilot CLI
        if: always() && steps.detection_guard.outputs.run_detection == 'true'
        id: detection_agentic_execution
        # Copilot CLI tool arguments (sorted):
        timeout-minutes: 20
        run: |
          set -o pipefail
          touch /tmp/gh-aw/agent-step-summary.md
          # shellcheck disable=SC1003
          sudo -E awf --env-all \
            -- /bin/bash -c '/usr/local/bin/copilot --prompt "detection"' 2>&1 | tee -a /tmp/gh-aw/threat-detection/detection.log
        env:
          COPILOT_GITHUB_TOKEN: token
  conclusion:
    steps:
      - name: Handle Agent Failure
        env:
          GH_AW_AGENT_CONCLUSION: ${{ needs.agent.result }}
          GH_AW_WORKFLOW_ID: "repo-assist"
      - name: Update reaction comment with completion status
        env:
          GH_AW_AGENT_CONCLUSION: ${{ needs.agent.result }}
          GH_AW_DETECTION_CONCLUSION: ${{ needs.agent.outputs.detection_conclusion }}
YAML

hash_file() {
  ruby -e 'require "digest"; print Digest::SHA256.file(ARGV[0]).hexdigest' "$1"
}

bash "$SCRIPT" "$WORKFLOW" >/dev/null
FIRST_HASH=$(hash_file "$WORKFLOW")

bash "$SCRIPT" "$WORKFLOW" >/dev/null
SECOND_HASH=$(hash_file "$WORKFLOW")

[ "$FIRST_HASH" = "$SECOND_HASH" ]

grep -F "continue-on-error: true" "$WORKFLOW" >/dev/null
grep -F "GH_AW_COPILOT_OUTPUT_PATH=/tmp/gh-aw/agent_output.json \\" "$WORKFLOW" >/dev/null
grep -F "bash scripts/run-copilot-with-retry.sh \\" "$WORKFLOW" >/dev/null
grep -F "if: always() && steps.agentic_execution.outputs.output_present == 'true'" "$WORKFLOW" >/dev/null
grep -F "Fail for upstream Copilot transient error without agent output" "$WORKFLOW" >/dev/null
grep -F 'GH_AW_AGENT_EXECUTION_STATUS: ${{ needs.agent.outputs.agent_execution_status }}' "$WORKFLOW" >/dev/null

echo "patch-copilot-lock-workflows.sh tests passed"
