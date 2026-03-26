#!/usr/bin/env bash
set -euo pipefail

TMP_INPUT=$(mktemp)
trap 'rm -f "$TMP_INPUT"' EXIT
cat > "$TMP_INPUT"

node - "$TMP_INPUT" <<'NODE'
const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2];
const repoRoot = path.resolve(process.env.CONTRACT_REPO_ROOT || process.cwd());
const input = fs.readFileSync(inputPath, "utf8");

function existsInRepo(relPath) {
  if (!relPath || relPath.startsWith("/") || relPath.includes("\0")) {
    return false;
  }
  const resolved = path.resolve(repoRoot, relPath);
  if (!resolved.startsWith(repoRoot + path.sep) && resolved !== repoRoot) {
    return false;
  }
  return fs.existsSync(resolved);
}

const lines = input.split("\n");
const sectionHeader = "## Existing Contracts to Read";
const sectionStart = lines.findIndex((line) => line.trim() === sectionHeader);

if (sectionStart === -1) {
  process.stdout.write(JSON.stringify({
    changed: false,
    body: input,
    removed_paths: [],
  }));
  process.exit(0);
}

let sectionEnd = lines.length;
for (let i = sectionStart + 1; i < lines.length; i += 1) {
  if (/^##\s+/.test(lines[i])) {
    sectionEnd = i;
    break;
  }
}

const updated = [];
const removed = [];

for (let i = 0; i < lines.length; i += 1) {
  if (i <= sectionStart || i >= sectionEnd) {
    updated.push(lines[i]);
    continue;
  }

  const match = lines[i].match(/^\s*-\s+`([^`]+)`\s*$/);
  if (!match) {
    updated.push(lines[i]);
    continue;
  }

  const relPath = match[1];
  if (existsInRepo(relPath)) {
    updated.push(lines[i]);
    continue;
  }

  removed.push(relPath);
}

process.stdout.write(JSON.stringify({
  changed: removed.length > 0,
  body: removed.length > 0 ? updated.join("\n") : input,
  removed_paths: removed,
}));
NODE
