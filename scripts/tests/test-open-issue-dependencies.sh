#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/open-issue-dependencies.sh"

BODY_WITH_BLOCKERS=$'## Dependencies\n\nDepends on #34 and #38 and #99.\n'
OPEN_ISSUES_JSON='[{"number":34},{"number":38},{"number":41}]'
OUTPUT=$(printf '%s' "$BODY_WITH_BLOCKERS" | OPEN_ISSUES_JSON="$OPEN_ISSUES_JSON" bash "$SCRIPT")
[ "$OUTPUT" = "#34 #38" ]

BODY_WITHOUT_BLOCKERS=$'## Dependencies\n\nDepends on #34 and #38.\n'
OPEN_ISSUES_JSON='[{"number":41}]'
OUTPUT=$(printf '%s' "$BODY_WITHOUT_BLOCKERS" | OPEN_ISSUES_JSON="$OPEN_ISSUES_JSON" bash "$SCRIPT")
[ -z "$OUTPUT" ]

echo "open-issue-dependencies.sh tests passed"
