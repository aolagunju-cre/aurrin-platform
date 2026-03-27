#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/remove-issue-dependency.sh"

BODY=$(cat <<'EOF_BODY'
## Description

Example.

## Dependencies

Depends on #30 (Files table), #33 (outbox), #31 (storage), #39 (profile page integration).

## Technical Notes

None.
EOF_BODY
)

printf '%s' "$BODY" | bash "$SCRIPT" 39 | jq -e '
  .changed == true and
  (.body | contains("Depends on #30 (Files table), #33 (outbox), #31 (storage).")) and
  (.body | contains("#39") | not)
' >/dev/null

ONLY_DEP=$(cat <<'EOF_BODY'
## Dependencies

Depends on #40.
EOF_BODY
)

printf '%s' "$ONLY_DEP" | bash "$SCRIPT" 40 | jq -e '
  .changed == true and
  (.body | contains("Depends on None."))
' >/dev/null

UNCHANGED=$(cat <<'EOF_BODY'
## Dependencies

Depends on #40.
EOF_BODY
)

printf '%s' "$UNCHANGED" | bash "$SCRIPT" 39 | jq -e '.changed == false' >/dev/null

echo "remove-issue-dependency.sh tests passed"
