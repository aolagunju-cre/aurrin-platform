#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/patch-github-mcp-token-precedence.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

WORKFLOW="$TMPDIR/sample.lock.yml"
cat > "$WORKFLOW" <<'EOF'
jobs:
  sample:
    steps:
      - uses: actions/github-script@v8
        with:
          github-token: ${{ secrets.GH_AW_GITHUB_MCP_SERVER_TOKEN || secrets.GH_AW_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}
        env:
          GITHUB_MCP_SERVER_TOKEN: ${{ secrets.GH_AW_GITHUB_MCP_SERVER_TOKEN || secrets.GH_AW_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}
      - run: |
          cat > /tmp/config.toml <<'CFG'
          [mcp_servers.github]
          env = { "GITHUB_HOST" = "$GITHUB_SERVER_URL", "GITHUB_PERSONAL_ACCESS_TOKEN" = "$GH_AW_GITHUB_TOKEN", "GITHUB_READ_ONLY" = "1", "GITHUB_TOOLSETS" = "all" }
          CFG
EOF

bash "$SCRIPT" "$WORKFLOW" >/dev/null

NEW_EXPR='${{ secrets.GITHUB_TOKEN || secrets.GH_AW_GITHUB_MCP_SERVER_TOKEN || secrets.GH_AW_GITHUB_TOKEN }}'
OLD_EXPR='${{ secrets.GH_AW_GITHUB_MCP_SERVER_TOKEN || secrets.GH_AW_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}'
NEW_MAPPING='"GITHUB_PERSONAL_ACCESS_TOKEN" = "$GITHUB_MCP_SERVER_TOKEN"'
OLD_MAPPING='"GITHUB_PERSONAL_ACCESS_TOKEN" = "$GH_AW_GITHUB_TOKEN"'

grep -F "$NEW_EXPR" "$WORKFLOW" >/dev/null || {
  echo "FAIL: patch script must prefer GITHUB_TOKEN before custom MCP tokens" >&2
  exit 1
}

if grep -Fq "$OLD_EXPR" "$WORKFLOW"; then
  echo "FAIL: patch script must remove stale MCP token precedence" >&2
  exit 1
fi

grep -F "$NEW_MAPPING" "$WORKFLOW" >/dev/null || {
  echo "FAIL: patch script must bind MCP personal access token to GITHUB_MCP_SERVER_TOKEN" >&2
  exit 1
}

if grep -Fq "$OLD_MAPPING" "$WORKFLOW"; then
  echo "FAIL: patch script must remove hardcoded GH_AW_GITHUB_TOKEN MCP bindings" >&2
  exit 1
fi

for workflow in \
  "$ROOT_DIR/.github/workflows/repo-assist.lock.yml" \
  "$ROOT_DIR/.github/workflows/prd-decomposer.lock.yml" \
  "$ROOT_DIR/.github/workflows/pr-review-agent.lock.yml" \
  "$ROOT_DIR/.github/workflows/frontend-agent.lock.yml" \
  "$ROOT_DIR/.github/workflows/pipeline-status.lock.yml" \
  "$ROOT_DIR/.github/workflows/security-compliance.lock.yml" \
  "$ROOT_DIR/.github/workflows/ci-doctor.lock.yml" \
  "$ROOT_DIR/.github/workflows/code-simplifier.lock.yml" \
  "$ROOT_DIR/.github/workflows/duplicate-code-detector.lock.yml" \
  "$ROOT_DIR/.github/workflows/prd-planner.lock.yml"
do
  grep -F "$NEW_EXPR" "$workflow" >/dev/null || {
    echo "FAIL: $(basename "$workflow") must prefer GITHUB_TOKEN for GitHub MCP access" >&2
    exit 1
  }

  if grep -Fq "$OLD_EXPR" "$workflow"; then
    echo "FAIL: $(basename "$workflow") still uses stale GitHub MCP token precedence" >&2
    exit 1
  fi

  grep -F "$NEW_MAPPING" "$workflow" >/dev/null || {
    echo "FAIL: $(basename "$workflow") must bind MCP auth to GITHUB_MCP_SERVER_TOKEN" >&2
    exit 1
  }

  if grep -Fq "$OLD_MAPPING" "$workflow"; then
    echo "FAIL: $(basename "$workflow") still hardcodes GH_AW_GITHUB_TOKEN in MCP config" >&2
    exit 1
  fi
done

echo "patch-github-mcp-token-precedence.sh tests passed"
