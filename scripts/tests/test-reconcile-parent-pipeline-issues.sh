#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/reconcile-parent-pipeline-issues.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
LOG_FILE="$TMPDIR/gh.log"
mkdir -p "$TMPDIR/bin"

cat > "$TMPDIR/bin/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${LOG_FILE:?}"
ARGS="$*"

if [[ "$ARGS" == issue\ list\ --repo\ test/repo* ]] && [[ "$ARGS" == *"--label pipeline"* ]]; then
  cat <<'JSON'
[
  {
    "number": 45,
    "title": "[Pipeline] Analytics Dashboard",
    "labels": [{"name":"pipeline"},{"name":"blocked"},{"name":"feature"}],
    "body": "Depends on #29"
  },
  {
    "number": 42,
    "title": "[Pipeline] Stripe Integration",
    "labels": [{"name":"pipeline"},{"name":"blocked"},{"name":"feature"}],
    "body": "## Dependencies\n\nDepends on #29\n"
  },
  {
    "number": 36,
    "title": "[Pipeline] Admin Dashboard",
    "labels": [{"name":"pipeline"},{"name":"blocked"},{"name":"feature"}],
    "body": "Depends on #29\n"
  }
]
JSON
  exit 0
fi

if [[ "$ARGS" == issue\ list\ --repo\ test/repo* ]] && [[ "$ARGS" == *"--jq .[].number"* ]]; then
  printf '45\n42\n36\n72\n'
  exit 0
fi

if [[ "$ARGS" == "api /repos/test/repo/issues/45/comments?per_page=100" ]]; then
  cat <<'JSON'
[
  {
    "body": "## Pipeline Tasks Created\n\n| # | Title | Type | Depends On |\n|---|-------|------|------------|\n| #84 | Query foundation | infra | — |\n| #85 | Metrics APIs | feature | #84 |\n"
  }
]
JSON
  exit 0
fi

if [[ "$ARGS" == "api /repos/test/repo/issues/42/comments?per_page=100" ]]; then
  echo '[]'
  exit 0
fi

if [[ "$ARGS" == "api /repos/test/repo/issues/36/comments?per_page=100" ]]; then
  cat <<'JSON'
[
  {
    "body": "## Pipeline Tasks Created\n\n| # | Title | Type | Depends On |\n|---|-------|------|------------|\n| #71 | Admin shell | infra | — |\n| #72 | Events management | feature | #71 |\n"
  }
]
JSON
  exit 0
fi

if [ "$1" = "issue" ] && [ "$2" = "close" ]; then
  printf 'close %s\n' "$3" >> "$LOG_FILE"
  exit 0
fi

if [ "$1" = "issue" ] && [ "$2" = "edit" ]; then
  printf 'edit %s %s\n' "$3" "$*" >> "$LOG_FILE"
  exit 0
fi

if [ "$1" = "issue" ] && [ "$2" = "comment" ]; then
  printf 'comment %s\n' "$3" >> "$LOG_FILE"
  exit 0
fi

echo "Unexpected gh invocation: $*" >&2
exit 1
EOF

chmod +x "$TMPDIR/bin/gh"

OUTPUT=$(PATH="$TMPDIR/bin:$PATH" LOG_FILE="$LOG_FILE" REPO="test/repo" bash "$SCRIPT")

printf '%s' "$OUTPUT" | jq -e '.actions_taken == 2' >/dev/null
printf '%s' "$OUTPUT" | jq -e '.closed_parents == ["45"]' >/dev/null
printf '%s' "$OUTPUT" | jq -e '.unblocked_issues == ["42"]' >/dev/null

grep -F 'close 45' "$LOG_FILE" >/dev/null
grep -F 'edit 42' "$LOG_FILE" >/dev/null
grep -F 'comment 42' "$LOG_FILE" >/dev/null
if grep -Fq 'close 36' "$LOG_FILE"; then
  echo "FAIL: reconcile helper should not close parents with open child issues" >&2
  exit 1
fi

echo "reconcile-parent-pipeline-issues.sh tests passed"
