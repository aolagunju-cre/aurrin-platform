#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/resolve-dependency-cycles.sh"

AUTO_FIXABLE=$(cat <<'JSON'
[
  {
    "number": 39,
    "title": "[Pipeline] Public Founder Directory (Search, Filter, Share)",
    "body": "## Dependencies\n\nDepends on #40.\n\n## Description\n\nBuild the public directory page and founder profile page."
  },
  {
    "number": 40,
    "title": "[Pipeline] Social Asset Generation (Satori/OG Images)",
    "body": "## Dependencies\n\nDepends on #39.\n\n## Description\n\nBuild reusable social asset generation, storage, and signed URL APIs."
  }
]
JSON
)

printf '%s' "$AUTO_FIXABLE" | bash "$SCRIPT" | jq -e '
  (.fixes | length) == 1 and
  .fixes[0].issues == [39,40] and
  .fixes[0].remove_dependency_from == 40 and
  .fixes[0].remove_dependency_to == 39 and
  .fixes[0].rationale == "issue #40 looks foundational/provider-oriented while issue #39 looks consumer/UI/docs-oriented" and
  .fixes[0].first_bias < 0 and
  .fixes[0].second_bias > 0 and
  .unresolved == []
' >/dev/null

AMBIGUOUS=$(cat <<'JSON'
[
  {
    "number": 10,
    "title": "[Pipeline] Core Services",
    "body": "## Dependencies\n\nDepends on #11.\n\n## Description\n\nBuild foundational services and APIs."
  },
  {
    "number": 11,
    "title": "[Pipeline] Shared Infrastructure",
    "body": "## Dependencies\n\nDepends on #10.\n\n## Description\n\nBuild shared infrastructure and services."
  }
]
JSON
)

printf '%s' "$AMBIGUOUS" | bash "$SCRIPT" | jq -e '
  .fixes == [] and
  (.unresolved | length) == 1 and
  .unresolved[0].issues == [10,11] and
  .unresolved[0].reason == "confidence_too_low_for_auto_fix" and
  .unresolved[0].first_bias > 0 and
  .unresolved[0].second_bias > 0
' >/dev/null

echo "resolve-dependency-cycles.sh tests passed"
