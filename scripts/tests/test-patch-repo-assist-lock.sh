#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/patch-repo-assist-lock.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

WORKFLOW="$TMPDIR/repo-assist.lock.yml"

cat > "$WORKFLOW" <<'YAML'
name: test
jobs:
  conclusion:
    needs:
      - activation
      - agent
      - push_repo_memory
      - safe_outputs
    if: always()
    runs-on: ubuntu-slim
    outputs:
      noop_message: ${{ steps.noop.outputs.noop_message }}
      tools_reported: ${{ steps.missing_tool.outputs.tools_reported }}
      total_count: ${{ steps.missing_tool.outputs.total_count }}
    steps:
      - name: Setup agent output environment variable
        id: setup-agent-output-env
        run: |
          echo "GH_AW_AGENT_OUTPUT=/tmp/gh-aw/agent_output.json" >> "$GITHUB_OUTPUT"
      - name: Update reaction comment with completion status
        id: conclusion
        uses: actions/github-script@v8
        with:
          script: |
            core.info('ok')
      - name: Invalidate GitHub App token
        if: always()
        run: echo "done"
YAML

hash_file() {
  ruby -e 'require "digest"; print Digest::SHA256.file(ARGV[0]).hexdigest' "$1"
}

bash "$SCRIPT" "$WORKFLOW" >/dev/null
FIRST_HASH=$(hash_file "$WORKFLOW")

bash "$SCRIPT" "$WORKFLOW" >/dev/null
SECOND_HASH=$(hash_file "$WORKFLOW")

[ "$FIRST_HASH" = "$SECOND_HASH" ]

grep -F "      - name: Fail targeted issue runs without actionable output" "$WORKFLOW" >/dev/null
grep -F "needs.agent.result == 'success' && needs.safe_outputs.result == 'success' && github.event_name == 'workflow_dispatch' && github.event.inputs.issue_number != ''" "$WORKFLOW" >/dev/null
grep -F "Targeted issue #\${issue} ended with noop. Use missing_data or missing_tool with the exact blocker and next step instead of noop." "$WORKFLOW" >/dev/null
grep -F "Targeted issue dispatch failed closed" "$WORKFLOW" >/dev/null
grep -F "MESSAGE=\$(node -e '" "$WORKFLOW" >/dev/null

[ "$(grep -c "^      - name: Fail targeted issue runs without actionable output$" "$WORKFLOW")" -eq 1 ]

python3 - "$WORKFLOW" > "$TMPDIR/targeted-guard.sh" <<'PY'
import sys
import yaml

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    data = yaml.safe_load(fh)

steps = data["jobs"]["conclusion"]["steps"]
script = next(step["run"] for step in steps if step.get("name") == "Fail targeted issue runs without actionable output")
print(script)
PY

bash -n "$TMPDIR/targeted-guard.sh"

echo "patch-repo-assist-lock.sh tests passed"
