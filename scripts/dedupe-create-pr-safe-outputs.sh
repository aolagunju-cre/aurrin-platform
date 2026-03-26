#!/usr/bin/env bash
set -euo pipefail

node - "$@" <<'NODE'
const fs = require("fs");

const paths = process.argv.slice(2);
let removedTotal = 0;

function dedupeCreatePullRequests(items) {
  if (!Array.isArray(items)) {
    return { items, removed: 0 };
  }

  const seen = new Set();
  const deduped = [];
  let removed = 0;

  for (const item of items) {
    if (!item || item.type !== "create_pull_request") {
      deduped.push(item);
      continue;
    }

    const signature = JSON.stringify({
      type: item.type,
      branch: item.branch || item.head_branch || item.headRefName || "",
      base: item.base || item.base_branch || item.baseRefName || "",
      title: item.title || "",
      body: item.body || "",
      draft: Boolean(item.draft),
      patch_path: item.patch_path || "",
    });

    if (seen.has(signature)) {
      removed += 1;
      continue;
    }

    seen.add(signature);
    deduped.push(item);
  }

  return { items: deduped, removed };
}

for (const filePath of paths) {
  if (!filePath || !fs.existsSync(filePath)) {
    continue;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) {
    continue;
  }

  if (filePath.endsWith(".json")) {
    const data = JSON.parse(raw);
    const result = dedupeCreatePullRequests(data.items);
    if (result.removed > 0) {
      data.items = result.items;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      console.error(`Deduplicated ${result.removed} create_pull_request item(s) in ${filePath}`);
      removedTotal += result.removed;
    }
    continue;
  }

  if (filePath.endsWith(".jsonl")) {
    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    const items = lines.map((line) => JSON.parse(line));
    const result = dedupeCreatePullRequests(items);
    if (result.removed > 0) {
      const serialized = result.items.map((item) => JSON.stringify(item)).join("\n");
      fs.writeFileSync(filePath, serialized.length > 0 ? `${serialized}\n` : "");
      console.error(`Deduplicated ${result.removed} create_pull_request item(s) in ${filePath}`);
      removedTotal += result.removed;
    }
  }
}

if (removedTotal > 0) {
  console.log(`Removed ${removedTotal} duplicate create_pull_request output(s).`);
} else {
  console.log("No duplicate create_pull_request outputs found.");
}
NODE
