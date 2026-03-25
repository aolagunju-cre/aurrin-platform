#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 64
fi

LOG_PATH=${GH_AW_COPILOT_LOG_PATH:-/tmp/gh-aw/agent-stdio.log}
OUTPUT_PATH=${GH_AW_COPILOT_OUTPUT_PATH:-}
MAX_ATTEMPTS=${GH_AW_COPILOT_MAX_ATTEMPTS:-3}
RETRY_DELAY_SECONDS=${GH_AW_COPILOT_RETRY_DELAY_SECONDS:-15}
TRANSIENT_STATUS_REGEX="${GH_AW_COPILOT_TRANSIENT_STATUS_REGEX:-CAPIError: 5[0-9][0-9]}"

mkdir -p "$(dirname "$LOG_PATH")"

write_output() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$1" >> "$GITHUB_OUTPUT"
  fi
}

write_summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    echo "$1" >> "$GITHUB_STEP_SUMMARY"
  fi
}

output_present() {
  [ -n "$OUTPUT_PATH" ] && [ -f "$OUTPUT_PATH" ]
}

has_transient_signature() {
  grep -Fq "Request failed due to a transient API error. Retrying" "$LOG_PATH" ||
    grep -Eq "$TRANSIENT_STATUS_REGEX" "$LOG_PATH" ||
    grep -Fq "HTTP/2 GOAWAY connection terminated" "$LOG_PATH" ||
    grep -Fq "An internal server error occurred." "$LOG_PATH" ||
    grep -Fq "Sorry, you've hit a rate limit" "$LOG_PATH" ||
    grep -Fq "missing finish_reason for choice 0" "$LOG_PATH"
}

attempt=1
attempts_used=0
raw_exit_code=0
transient_error_detected=false
tolerated_failure=false

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  attempts_used=$attempt
  printf '\n[%s] Starting Copilot attempt %s/%s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$attempt" "$MAX_ATTEMPTS" | tee -a "$LOG_PATH"

  if "$@" 2>&1 | tee -a "$LOG_PATH"; then
    raw_exit_code=0
    break
  else
    raw_exit_code=$?
  fi

  if has_transient_signature; then
    transient_error_detected=true
  fi

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ] || [ "$transient_error_detected" != "true" ]; then
    break
  fi

  echo "Copilot attempt $attempt/$MAX_ATTEMPTS failed with a transient signature; retrying in ${RETRY_DELAY_SECONDS}s." | tee -a "$LOG_PATH"
  sleep "$RETRY_DELAY_SECONDS"
  attempt=$((attempt + 1))
done

final_output_present=false
if output_present; then
  final_output_present=true
fi

if [ "$raw_exit_code" -ne 0 ] && [ "$final_output_present" = "true" ]; then
  tolerated_failure=true
  write_summary "### GitHub Copilot non-zero exit tolerated"
  write_summary ""
  write_summary "- attempts: $attempts_used"
  write_summary "- exit code: $raw_exit_code"
  write_summary "- agent output: $OUTPUT_PATH"
fi

write_output "attempts=$attempts_used"
write_output "exit_code=$raw_exit_code"
write_output "output_present=$final_output_present"
write_output "tolerated_failure=$tolerated_failure"
write_output "transient_error_detected=$transient_error_detected"

if [ "$raw_exit_code" -ne 0 ] && [ "$tolerated_failure" != "true" ]; then
  exit "$raw_exit_code"
fi
