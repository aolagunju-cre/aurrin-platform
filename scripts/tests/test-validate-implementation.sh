#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/validate-implementation.sh"

[ -x "$SCRIPT" ] || {
  echo "FAIL: validate-implementation.sh must exist and be executable" >&2
  exit 1
}

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

mkdir -p "$TMPDIR/scripts" "$TMPDIR/.github/deploy-profiles" "$TMPDIR/studio" "$TMPDIR/console" "$TMPDIR/bin"
cp "$ROOT_DIR/scripts/validate-implementation.sh" "$TMPDIR/scripts/"
cp "$ROOT_DIR/scripts/resolve-nextjs-app-root.sh" "$TMPDIR/scripts/"
chmod +x "$TMPDIR/scripts/validate-implementation.sh" "$TMPDIR/scripts/resolve-nextjs-app-root.sh"

printf 'nextjs-vercel\n' > "$TMPDIR/.deploy-profile"
cat > "$TMPDIR/.github/deploy-profiles/nextjs-vercel.yml" <<'YAML'
name: Next.js on Vercel
build:
  install: npm ci
  build: npm run build
  test: npm test
YAML
cat > "$TMPDIR/studio/package.json" <<'JSON'
{"name":"studio","private":true}
JSON
cat > "$TMPDIR/studio/next.config.ts" <<'TS'
export default {};
TS
cat > "$TMPDIR/console/package.json" <<'JSON'
{"name":"console","private":true}
JSON

LOG_FILE="$TMPDIR/npm.log"
export LOG_FILE

cat > "$TMPDIR/bin/npm" <<'STUB'
#!/usr/bin/env bash
printf '%s|%s\n' "$PWD" "$*" >> "$LOG_FILE"
if [ "${VALIDATE_FAIL_MATCH:-}" = "$PWD|$*" ]; then
  exit 1
fi
exit 0
STUB

chmod +x "$TMPDIR/bin/npm"

(
  cd "$TMPDIR"
  PATH="$TMPDIR/bin:$PATH" bash scripts/validate-implementation.sh >/dev/null
)

grep -F "$TMPDIR/studio|ci" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm ci in the app root" >&2
  exit 1
}

grep -F "$TMPDIR/studio|run build" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm run build in the app root" >&2
  exit 1
}

grep -F "$TMPDIR/studio|test" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm test in the app root" >&2
  exit 1
}

grep -F "$TMPDIR/console|ci" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm ci in console when present" >&2
  exit 1
}

grep -F "$TMPDIR/console|test" "$LOG_FILE" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm test in console when present" >&2
  exit 1
}

DOCS_ONLY_LOG="$TMPDIR/docs-only.log"
export LOG_FILE="$DOCS_ONLY_LOG"
: > "$DOCS_ONLY_LOG"
(
  cd "$TMPDIR"
  VALIDATION_CHANGED_FILES=$'README.md\ndocs/guide.md' PATH="$TMPDIR/bin:$PATH" bash scripts/validate-implementation.sh >/dev/null
)

if [ -s "$DOCS_ONLY_LOG" ]; then
  echo "FAIL: validate-implementation.sh must skip npm commands for docs-only changes" >&2
  exit 1
fi

TEST_ONLY_LOG="$TMPDIR/test-only.log"
export LOG_FILE="$TEST_ONLY_LOG"
: > "$TEST_ONLY_LOG"
(
  cd "$TMPDIR"
  VALIDATION_CHANGED_FILES=$'studio/test/admin-events-route.test.ts\ndocs/guide.md' PATH="$TMPDIR/bin:$PATH" bash scripts/validate-implementation.sh >/dev/null
)

grep -F "$TMPDIR/studio|ci" "$TEST_ONLY_LOG" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm ci for app test-only changes" >&2
  exit 1
}

grep -F "$TMPDIR/studio|test" "$TEST_ONLY_LOG" >/dev/null || {
  echo "FAIL: validate-implementation.sh must run npm test for app test-only changes" >&2
  exit 1
}

if grep -Fq "$TMPDIR/studio|run build" "$TEST_ONLY_LOG"; then
  echo "FAIL: validate-implementation.sh must skip npm run build for test-only changes" >&2
  exit 1
fi

if grep -Fq "$TMPDIR/console|" "$TEST_ONLY_LOG"; then
  echo "FAIL: validate-implementation.sh must not run console commands when only studio tests changed" >&2
  exit 1
fi

printf 'unsupported-profile\n' > "$TMPDIR/.deploy-profile"
if (
  cd "$TMPDIR"
  PATH="$TMPDIR/bin:$PATH" bash scripts/validate-implementation.sh >/dev/null 2>&1
); then
  echo "FAIL: validate-implementation.sh must fail for unsupported profiles" >&2
  exit 1
fi

printf 'nextjs-vercel\n' > "$TMPDIR/.deploy-profile"
rm -f "$TMPDIR/console/package.json"
: > "$LOG_FILE"
(
  cd "$TMPDIR"
  PATH="$TMPDIR/bin:$PATH" bash scripts/validate-implementation.sh >/dev/null
)

if grep -F "$TMPDIR/console|" "$LOG_FILE" >/dev/null; then
  echo "FAIL: validate-implementation.sh must skip console commands when console/package.json is absent" >&2
  exit 1
fi

echo "validate-implementation tests passed"
