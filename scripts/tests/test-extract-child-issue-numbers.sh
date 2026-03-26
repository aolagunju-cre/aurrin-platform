#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/extract-child-issue-numbers.sh"

OUTPUT=$(cat <<'EOF' | "$SCRIPT"
## Pipeline Tasks Created

| # | Title | Type | Depends On |
|---|-------|------|------------|
| #84 | Query foundation | infra | — |
| #85 | Metrics APIs | feature | #84 |
| #86 | Export endpoint | feature | #84 |
EOF
)

EXPECTED=$'84\n85\n86'
if [ "$OUTPUT" != "$EXPECTED" ]; then
  echo "FAIL: child issue extractor did not return the table issue numbers in order" >&2
  printf 'Expected:\n%s\n\nGot:\n%s\n' "$EXPECTED" "$OUTPUT" >&2
  exit 1
fi

echo "extract-child-issue-numbers.sh tests passed"
