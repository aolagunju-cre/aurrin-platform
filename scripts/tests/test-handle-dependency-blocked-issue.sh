#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/handle-dependency-blocked-issue.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/bin"
LOG_FILE="$TMPDIR/gh.log"
SUMMARY_FILE="$TMPDIR/summary.md"
AGENT_OUTPUT="$TMPDIR/agent-output.json"

cat > "$AGENT_OUTPUT" <<'JSON'
{
  "items": [
    {
      "type": "missing_data",
      "reason": "Dependencies are still open.",
      "context": "Issue depends on unfinished work.",
      "alternatives": "Close dependencies first."
    }
  ]
}
JSON

cat > "$TMPDIR/bin/gh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "\$*" >> "$LOG_FILE"
case "\$1 \$2" in
  "issue view")
    cat <<'JSON'
{"body":"## Dependencies\n\nDepends on #30 through #46.\n","labels":[{"name":"pipeline"}]}
JSON
    ;;
  "issue list")
    cat <<'JSON'
[{"number":34},{"number":38},{"number":46}]
JSON
    ;;
  "issue edit")
    exit 0
    ;;
  "workflow run")
    echo "https://github.com/samuelkahessay/aurrin-platform/actions/runs/12345"
    ;;
  *)
    exit 1
    ;;
esac
EOF

chmod +x "$TMPDIR/bin/gh"

PATH="$TMPDIR/bin:$PATH" \
GH_TOKEN="token" \
GH_AW_AGENT_OUTPUT="$AGENT_OUTPUT" \
GH_AW_TARGET_ISSUE="143" \
REPO="samuelkahessay/aurrin-platform" \
GITHUB_STEP_SUMMARY="$SUMMARY_FILE" \
bash "$SCRIPT"

grep -F 'issue view 143 --repo samuelkahessay/aurrin-platform --json body,labels' "$LOG_FILE" >/dev/null
grep -F 'issue edit 143 --repo samuelkahessay/aurrin-platform --add-label blocked' "$LOG_FILE" >/dev/null
grep -F 'workflow run auto-dispatch-requeue.yml --repo samuelkahessay/aurrin-platform' "$LOG_FILE" >/dev/null
grep -F 'Issue #143 was labeled `blocked` because these dependencies are still open: #34 #38 #46.' "$SUMMARY_FILE" >/dev/null
grep -F 'Triggered Auto-Dispatch Requeue: https://github.com/samuelkahessay/aurrin-platform/actions/runs/12345' "$SUMMARY_FILE" >/dev/null

echo "handle-dependency-blocked-issue.sh tests passed"
