#!/usr/bin/env bash
set -euo pipefail

ISSUE_JSON=$(cat)

TITLE=$(printf '%s' "$ISSUE_JSON" | jq -r '.title // ""')
BODY=$(printf '%s' "$ISSUE_JSON" | jq -r '.body // ""')
LABELS_JSON=$(printf '%s' "$ISSUE_JSON" | jq -c '[.labels[]?.name // empty | ascii_downcase]')

CHECKLIST_COUNT=$(printf '%s\n' "$BODY" | grep -Ec '^- \[ \]' || true)
API_GROUP_COUNT=$(printf '%s\n' "$BODY" | grep -Ec 'API routes for' || true)
FILE_TARGET_COUNT=$({ printf '%s\n' "$BODY" | grep -Eo '`[^`]+\.(ts|tsx|js|jsx|sql|md|yml|yaml)`' || true; } | wc -l | tr -d '[:space:]')

has_label() {
  local label="$1"
  printf '%s' "$LABELS_JSON" | jq -e --arg label "$label" 'index($label) != null' >/dev/null
}

issue_needs_split() {
  local missing_contract_sections=false

  if [[ "$BODY" != *"## Existing Contracts to Read"* ]] || [[ "$BODY" != *"## Required Validation"* ]]; then
    missing_contract_sections=true
  fi

  if [ "$missing_contract_sections" = true ] && [ "${CHECKLIST_COUNT:-0}" -ge 10 ]; then
    return 0
  fi

  if [ "${CHECKLIST_COUNT:-0}" -ge 14 ] || [ "${API_GROUP_COUNT:-0}" -ge 3 ] || [ "${FILE_TARGET_COUNT:-0}" -ge 12 ]; then
    return 0
  fi

  return 1
}

REASON="actionable"
ACTIONABLE=true
ROUTE="repo_assist"
WORKFLOW_FILE="repo-assist.lock.yml"
AGENT_COMMAND="/repo-assist"
BACKOFF_SECONDS=0

if ! has_label "pipeline"; then
  ACTIONABLE=false
  REASON="missing_pipeline_label"
elif [ "$TITLE" = "[Pipeline] Status" ]; then
  ACTIONABLE=false
  REASON="status_issue"
elif [[ "$TITLE" == PRD:* ]]; then
  # Root PRD issues are planning/tracking items. repo-assist should work the
  # decomposed implementation issues, not loop on the PRD itself.
  ACTIONABLE=false
  REASON="prd_tracking_issue"
elif has_label "report"; then
  ACTIONABLE=false
  REASON="report_issue"
elif has_label "blocked"; then
  ACTIONABLE=false
  REASON="blocked_issue"
elif issue_needs_split; then
  REASON="aggregate_issue_needs_split"
  ROUTE="prd_decomposer"
  WORKFLOW_FILE="prd-decomposer.lock.yml"
  AGENT_COMMAND="/decompose"
elif has_label "needs-human" || has_label "ci-auth"; then
  ACTIONABLE=false
  REASON="needs_human_route"
  ROUTE="needs_human"
elif has_label "frontend"; then
  ROUTE="frontend_agent"
  WORKFLOW_FILE="frontend-agent.lock.yml"
  AGENT_COMMAND="/frontend-agent"
elif has_label "ci-rate-limit" || has_label "ci-timeout" || has_label "ci-infrastructure"; then
  REASON="retryable_ci_issue"
  ROUTE="retry_with_backoff"
  BACKOFF_SECONDS=60
fi

jq -n \
  --arg title "$TITLE" \
  --arg reason "$REASON" \
  --arg route "$ROUTE" \
  --arg workflow_file "$WORKFLOW_FILE" \
  --arg agent_command "$AGENT_COMMAND" \
  --argjson actionable "$ACTIONABLE" \
  --argjson backoff_seconds "$BACKOFF_SECONDS" \
  --argjson labels "$LABELS_JSON" \
  '{
    actionable: $actionable,
    reason: $reason,
    route: $route,
    workflow_file: $workflow_file,
    agent_command: $agent_command,
    backoff_seconds: $backoff_seconds,
    title: $title,
    labels: $labels
  }'
