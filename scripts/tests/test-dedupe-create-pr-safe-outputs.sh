#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/dedupe-create-pr-safe-outputs.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

cat > "$TMPDIR/agent_output.json" <<'JSON'
{
  "items": [
    {
      "type": "create_pull_request",
      "branch": "repo-assist/issue-64-dedupe",
      "title": "[Pipeline] Fix duplicate PRs",
      "body": "Closes #64",
      "draft": true,
      "patch_path": "/tmp/gh-aw/issue-64.patch"
    },
    {
      "type": "create_pull_request",
      "branch": "repo-assist/issue-64-dedupe",
      "title": "[Pipeline] Fix duplicate PRs",
      "body": "Closes #64",
      "draft": true,
      "patch_path": "/tmp/gh-aw/issue-64.patch"
    },
    {
      "type": "dispatch_workflow",
      "workflow": "pr-review-agent"
    }
  ]
}
JSON

cat > "$TMPDIR/safeoutputs.jsonl" <<'JSONL'
{"type":"create_pull_request","branch":"repo-assist/issue-64-dedupe","title":"[Pipeline] Fix duplicate PRs","body":"Closes #64","draft":true,"patch_path":"/tmp/gh-aw/issue-64.patch"}
{"type":"create_pull_request","branch":"repo-assist/issue-64-dedupe","title":"[Pipeline] Fix duplicate PRs","body":"Closes #64","draft":true,"patch_path":"/tmp/gh-aw/issue-64.patch"}
{"type":"dispatch_workflow","workflow":"pr-review-agent"}
JSONL

OUTPUT=$(bash "$SCRIPT" "$TMPDIR/agent_output.json" "$TMPDIR/safeoutputs.jsonl")
printf '%s\n' "$OUTPUT" | grep -F "Removed 2 duplicate create_pull_request output(s)." >/dev/null

python3 - <<'PY' "$TMPDIR/agent_output.json" "$TMPDIR/safeoutputs.jsonl"
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as fh:
    data = json.load(fh)
assert len(data["items"]) == 2, data
assert sum(1 for item in data["items"] if item["type"] == "create_pull_request") == 1, data

with open(sys.argv[2], "r", encoding="utf-8") as fh:
    lines = [json.loads(line) for line in fh if line.strip()]
assert len(lines) == 2, lines
assert sum(1 for item in lines if item["type"] == "create_pull_request") == 1, lines
PY

echo "dedupe-create-pr-safe-outputs.sh tests passed"
