#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
WORKFLOW="$ROOT_DIR/.github/workflows/architecture-approve.yml"

ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); puts "yaml-ok"' "$WORKFLOW" >/dev/null

ruby -e '
  text = File.read(ARGV[0])
  abort("FAIL: architecture-approve dispatch must use GITHUB_TOKEN") unless text.match?(/- name: Dispatch prd-decomposer\n(?:.*\n){0,6}?\s+GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/)
' "$WORKFLOW"

grep -F 'gh workflow run prd-decomposer.lock.yml' "$WORKFLOW" >/dev/null || {
  echo "FAIL: architecture-approve must dispatch prd-decomposer" >&2
  exit 1
}

echo "architecture-approve.yml tests passed"
