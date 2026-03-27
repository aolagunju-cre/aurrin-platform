#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/detect-dependency-cycles.sh"

NO_CYCLE=$(cat <<'JSON'
[
  {"number": 39, "title": "Directory", "body": "## Dependencies\n\nDepends on #30."},
  {"number": 40, "title": "Social assets", "body": "## Dependencies\n\nDepends on #31."}
]
JSON
)

printf '%s' "$NO_CYCLE" | bash "$SCRIPT" | jq -e '.cycles == [] and .issue_numbers == []' >/dev/null

TWO_NODE=$(cat <<'JSON'
[
  {"number": 39, "title": "Directory", "body": "## Dependencies\n\nDepends on #40."},
  {"number": 40, "title": "Social assets", "body": "## Dependencies\n\nDepends on #39."}
]
JSON
)

printf '%s' "$TWO_NODE" | bash "$SCRIPT" | jq -e '.cycles == [{"issues":[39,40],"titles":["Directory","Social assets"]}] and .issue_numbers == [39,40]' >/dev/null

THREE_NODE=$(cat <<'JSON'
[
  {"number": 143, "title": "Infra", "body": "## Dependencies\n\nDepends on #144."},
  {"number": 144, "title": "Unit", "body": "## Dependencies\n\nDepends on #145."},
  {"number": 145, "title": "API", "body": "## Dependencies\n\nDepends on #143."},
  {"number": 146, "title": "E2E", "body": "## Dependencies\n\nDepends on #143 through #145."}
]
JSON
)

printf '%s' "$THREE_NODE" | bash "$SCRIPT" | jq -e '.cycles == [{"issues":[143,144,145],"titles":["Infra","Unit","API"]}] and .issue_numbers == [143,144,145]' >/dev/null

echo "detect-dependency-cycles.sh tests passed"
