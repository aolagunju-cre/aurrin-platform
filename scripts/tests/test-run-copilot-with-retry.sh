#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
SCRIPT="$ROOT_DIR/scripts/run-copilot-with-retry.sh"

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

run_case() {
  local name=$1
  shift
  local output_file="$TMPDIR/$name.out"
  local log_file="$TMPDIR/$name.log"
  local summary_file="$TMPDIR/$name.summary"
  local agent_output="$TMPDIR/$name.agent_output.json"

  GITHUB_OUTPUT="$output_file" \
  GITHUB_STEP_SUMMARY="$summary_file" \
  GH_AW_COPILOT_LOG_PATH="$log_file" \
  GH_AW_COPILOT_OUTPUT_PATH="$agent_output" \
  GH_AW_COPILOT_RETRY_DELAY_SECONDS=0 \
  "$@"
}

ATTEMPT_FILE="$TMPDIR/transient-then-success.attempt"
ATTEMPT_FILE="$ATTEMPT_FILE" run_case transient-then-success \
  bash "$SCRIPT" bash -lc '
    attempt=$(cat "$ATTEMPT_FILE" 2>/dev/null || echo 0)
    attempt=$((attempt + 1))
    echo "$attempt" > "$ATTEMPT_FILE"
    if [ "$attempt" -lt 2 ]; then
      echo "Request failed due to a transient API error. Retrying..."
      exit 1
    fi
    echo "{\"ok\":true}" > "$GH_AW_COPILOT_OUTPUT_PATH"
  '

grep -F "attempts=2" "$TMPDIR/transient-then-success.out" >/dev/null
grep -F "output_present=true" "$TMPDIR/transient-then-success.out" >/dev/null
grep -F "tolerated_failure=false" "$TMPDIR/transient-then-success.out" >/dev/null

run_case tolerate-output-on-failure \
  bash "$SCRIPT" bash -lc '
    echo "Request failed due to a transient API error. Retrying..."
    echo "{\"ok\":true}" > "$GH_AW_COPILOT_OUTPUT_PATH"
    exit 1
  '

grep -F "attempts=3" "$TMPDIR/tolerate-output-on-failure.out" >/dev/null
grep -F "tolerated_failure=true" "$TMPDIR/tolerate-output-on-failure.out" >/dev/null
grep -F "transient_error_detected=true" "$TMPDIR/tolerate-output-on-failure.out" >/dev/null

if run_case fail-without-output bash "$SCRIPT" bash -lc 'echo "fatal"; exit 9'; then
  echo "FAIL: wrapper should fail when no output file is produced" >&2
  exit 1
fi

grep -F "output_present=false" "$TMPDIR/fail-without-output.out" >/dev/null
grep -F "tolerated_failure=false" "$TMPDIR/fail-without-output.out" >/dev/null

echo "run-copilot-with-retry.sh tests passed"
