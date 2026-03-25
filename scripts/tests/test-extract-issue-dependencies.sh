#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/extract-issue-dependencies.sh"

BODY_WITH_SECTION=$(cat <<'EOF'
## PRD Traceability

Source issue #28

## Dependencies

Depends on #30 (Files table) and #29 (ownership verification).
Depends on #33 for background jobs.

## Technical Notes

Something else.
EOF
)

EXPECTED=$'30\n29\n33'
ACTUAL=$(printf '%s' "$BODY_WITH_SECTION" | bash "$SCRIPT")
[ "$ACTUAL" = "$EXPECTED" ] || {
  echo "FAIL: expected dependencies from Dependencies section" >&2
  exit 1
}

BODY_WITH_INLINE_DEPENDS=$(cat <<'EOF'
Intro text.
Depends on #41 before rollout.
EOF
)

ACTUAL=$(printf '%s' "$BODY_WITH_INLINE_DEPENDS" | bash "$SCRIPT")
[ "$ACTUAL" = "41" ] || {
  echo "FAIL: expected inline dependency reference to be extracted" >&2
  exit 1
}

BODY_WITHOUT_DEPENDENCIES=$(cat <<'EOF'
## PRD Traceability

Source issue #28

## Description

No dependency section here.
EOF
)

ACTUAL=$(printf '%s' "$BODY_WITHOUT_DEPENDENCIES" | bash "$SCRIPT")
[ -z "$ACTUAL" ] || {
  echo "FAIL: should ignore non-dependency issue references" >&2
  exit 1
}

echo "extract-issue-dependencies.sh tests passed"
