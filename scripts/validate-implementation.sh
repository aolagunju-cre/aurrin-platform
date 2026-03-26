#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

is_docs_file() {
  case "$1" in
    README.md|AGENTS.md|LICENSE|docs/*|showcase/*|*.md|*.mdx|*.txt)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_test_file() {
  case "$1" in
    studio/test/*|console/test/*|scripts/tests/*|*/__tests__/*|*.test.*|*.spec.*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

detect_changed_files() {
  if [ -n "${VALIDATION_CHANGED_FILES:-}" ]; then
    printf '%s\n' "$VALIDATION_CHANGED_FILES" | awk 'NF'
    return 0
  fi

  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 1
  fi

  WORKTREE_DIFF=$(
    {
      git diff --name-only --diff-filter=ACMR HEAD -- 2>/dev/null || true
      git ls-files --others --exclude-standard 2>/dev/null || true
    } | awk 'NF' | sort -u
  )
  if [ -n "$WORKTREE_DIFF" ]; then
    printf '%s\n' "$WORKTREE_DIFF"
    return 0
  fi

  BASE_REF="${VALIDATION_BASE_REF:-origin/main}"
  if git rev-parse --verify "$BASE_REF" >/dev/null 2>&1; then
    MERGE_BASE=$(git merge-base HEAD "$BASE_REF" 2>/dev/null || true)
    if [ -n "$MERGE_BASE" ]; then
      git diff --name-only --diff-filter=ACMR "$MERGE_BASE"...HEAD -- | awk 'NF'
      return 0
    fi
  fi

  if git rev-parse --verify HEAD^ >/dev/null 2>&1; then
    git diff --name-only --diff-filter=ACMR HEAD^...HEAD -- | awk 'NF'
    return 0
  fi

  return 1
}

classify_validation_scope() {
  local changed_files="$1"
  local saw_file=false
  local saw_test=false
  local non_docs_or_tests=false

  while IFS= read -r file; do
    [ -n "$file" ] || continue
    saw_file=true

    if is_docs_file "$file"; then
      continue
    fi

    if is_test_file "$file"; then
      saw_test=true
      continue
    fi

    non_docs_or_tests=true
    break
  done < <(printf '%s\n' "$changed_files")

  if [ "$saw_file" != "true" ]; then
    printf 'full\n'
    return 0
  fi

  if [ "$non_docs_or_tests" = "true" ]; then
    printf 'full\n'
    return 0
  fi

  if [ "$saw_test" = "true" ]; then
    printf 'test_only\n'
  else
    printf 'docs_only\n'
  fi
}

run_in_dir() {
  local dir="$1"
  shift
  echo "▸ ($dir) $*"
  (
    cd "$dir"
    "$@"
  )
}

PROFILE="$(tr -d '[:space:]' < "$ROOT_DIR/.deploy-profile" 2>/dev/null || true)"
[ -n "$PROFILE" ] || fail ".deploy-profile is missing or empty"

PROFILE_FILE="$ROOT_DIR/.github/deploy-profiles/$PROFILE.yml"
[ -f "$PROFILE_FILE" ] || fail "Deploy profile file not found: .github/deploy-profiles/$PROFILE.yml"

case "$PROFILE" in
  nextjs-vercel)
    ;;
  *)
    fail "Unsupported deploy profile '$PROFILE' in scripts/validate-implementation.sh"
    ;;
esac

APP_ROOT="$(bash "$ROOT_DIR/scripts/resolve-nextjs-app-root.sh" "$ROOT_DIR")"
APP_DIR="$ROOT_DIR"
if [ "$APP_ROOT" != "." ]; then
  APP_DIR="$ROOT_DIR/$APP_ROOT"
fi

[ -f "$APP_DIR/package.json" ] || fail "Resolved app root '$APP_ROOT' does not contain package.json"

CHANGED_FILES="$(detect_changed_files || true)"
VALIDATION_SCOPE="$(classify_validation_scope "$CHANGED_FILES")"

echo "Validation scope: $VALIDATION_SCOPE"
if [ -n "$CHANGED_FILES" ]; then
  echo "Detected changed files:"
  printf '  - %s\n' $CHANGED_FILES
fi

case "$VALIDATION_SCOPE" in
  docs_only)
    echo "Docs-only change set detected. Skipping app install/build/test."
    ;;
  test_only)
    APP_TEST_CHANGES=false
    CONSOLE_TEST_CHANGES=false
    while IFS= read -r file; do
      [ -n "$file" ] || continue
      case "$file" in
        console/*)
          CONSOLE_TEST_CHANGES=true
          ;;
        studio/*|src/*|test/*|tests/*|*test.*|*spec.*)
          APP_TEST_CHANGES=true
          ;;
      esac
    done < <(printf '%s\n' "$CHANGED_FILES")

    if [ "$APP_TEST_CHANGES" = "true" ]; then
      run_in_dir "$APP_DIR" npm ci
      run_in_dir "$APP_DIR" npm test
    else
      echo "No application test files changed. Skipping app npm commands."
    fi

    if [ -f "$ROOT_DIR/console/package.json" ] && [ "$CONSOLE_TEST_CHANGES" = "true" ]; then
      run_in_dir "$ROOT_DIR/console" npm ci
      run_in_dir "$ROOT_DIR/console" npm test
    fi
    ;;
  *)
    run_in_dir "$APP_DIR" npm ci
    run_in_dir "$APP_DIR" npm run build
    run_in_dir "$APP_DIR" npm test

    if [ -f "$ROOT_DIR/console/package.json" ]; then
      run_in_dir "$ROOT_DIR/console" npm ci
      run_in_dir "$ROOT_DIR/console" npm test
    fi
    ;;
esac

echo "Implementation validation passed for profile '$PROFILE'"
