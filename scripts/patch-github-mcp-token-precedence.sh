#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

ruby - "$ROOT_DIR" "$@" <<'RUBY'
root_dir = ARGV.shift

workflow_paths =
  if ARGV.empty?
    Dir[File.join(root_dir, ".github/workflows/*.lock.yml")].select do |path|
      File.read(path).include?("${{ secrets.GH_AW_GITHUB_MCP_SERVER_TOKEN || secrets.GH_AW_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}")
    end
  else
    ARGV.map { |path| File.expand_path(path, root_dir) }
  end

if workflow_paths.empty?
  warn "No lock workflows found to patch."
  exit 0
end

old_expr = "${{ secrets.GH_AW_GITHUB_MCP_SERVER_TOKEN || secrets.GH_AW_GITHUB_TOKEN || secrets.GITHUB_TOKEN }}"
new_expr = "${{ secrets.GITHUB_TOKEN || secrets.GH_AW_GITHUB_MCP_SERVER_TOKEN || secrets.GH_AW_GITHUB_TOKEN }}"

patched = []

workflow_paths.each do |path|
  content = File.read(path)
  next unless content.include?(old_expr)

  updated = content.gsub(old_expr, new_expr)
  next if updated == content

  File.write(path, updated)
  patched << path
end

puts "Patched #{patched.length} workflow(s)"
patched.each { |path| puts "- #{path}" }
RUBY
