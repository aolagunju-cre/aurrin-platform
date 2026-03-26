#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
REPO="${REPO:?REPO environment variable is required}"

OPEN_PIPELINE_ISSUES=$(gh issue list --repo "$REPO" --label pipeline --state open --limit 500 --json number,title,labels,body 2>/dev/null || echo '[]')
OPEN_ISSUE_NUMBERS=$(gh issue list --repo "$REPO" --state open --limit 500 --json number --jq '.[].number' 2>/dev/null || true)

closed_parents=()
unblocked_issues=()

has_open_issue() {
  local issue_number=$1
  printf '%s\n' "$OPEN_ISSUE_NUMBERS" | grep -qx "$issue_number"
}

latest_pipeline_tasks_comment_body() {
  local issue_number=$1
  gh api "/repos/${REPO}/issues/${issue_number}/comments?per_page=100" 2>/dev/null \
    | jq -r '[.[] | select((.body // "") | contains("## Pipeline Tasks Created"))] | last | .body // ""'
}

while IFS= read -r ISSUE_ROW; do
  [ -z "$ISSUE_ROW" ] && continue
  ISSUE_NUM=$(printf '%s' "$ISSUE_ROW" | jq -r '.number')
  ISSUE_TITLE=$(printf '%s' "$ISSUE_ROW" | jq -r '.title // ""')
  ISSUE_BODY=$(printf '%s' "$ISSUE_ROW" | jq -r '.body // ""')
  LABELS=$(printf '%s' "$ISSUE_ROW" | jq -r '[.labels[]?.name // empty | ascii_downcase] | join(",")')

  if ! printf '%s' "$LABELS" | grep -Eq '(^|,)blocked(,|$)'; then
    continue
  fi

  TASKS_COMMENT_BODY=$(latest_pipeline_tasks_comment_body "$ISSUE_NUM")
  CHILD_ISSUES=$(printf '%s' "$TASKS_COMMENT_BODY" | bash "$SCRIPT_DIR/extract-child-issue-numbers.sh" || true)

  if [ -n "$CHILD_ISSUES" ]; then
    OPEN_CHILDREN=()
    while IFS= read -r CHILD_NUM; do
      [ -n "$CHILD_NUM" ] || continue
      if has_open_issue "$CHILD_NUM"; then
        OPEN_CHILDREN+=("#${CHILD_NUM}")
      fi
    done < <(printf '%s\n' "$CHILD_ISSUES")

    if [ "${#OPEN_CHILDREN[@]}" -eq 0 ]; then
      echo "Closing umbrella parent #${ISSUE_NUM}: all child issues are closed." >&2
      gh issue close "$ISSUE_NUM" --repo "$REPO" \
        -c "Closed automatically: all child pipeline issues are complete." >/dev/null || \
        echo "::warning::Could not close umbrella parent issue #${ISSUE_NUM}" >&2
      closed_parents+=("$ISSUE_NUM")
    else
      echo "Parent #${ISSUE_NUM} still waiting on child issues ${OPEN_CHILDREN[*]}." >&2
    fi
    continue
  fi

  DEPENDENCIES=$(printf '%s' "$ISSUE_BODY" | bash "$SCRIPT_DIR/extract-issue-dependencies.sh" || true)
  [ -n "$DEPENDENCIES" ] || continue

  OPEN_DEPENDENCIES=()
  while IFS= read -r DEP_NUM; do
    [ -n "$DEP_NUM" ] || continue
    if has_open_issue "$DEP_NUM"; then
      OPEN_DEPENDENCIES+=("#${DEP_NUM}")
    fi
  done < <(printf '%s\n' "$DEPENDENCIES")

  if [ "${#OPEN_DEPENDENCIES[@]}" -eq 0 ]; then
    echo "Unblocking issue #${ISSUE_NUM}: all dependencies are closed and no child umbrella set was found." >&2
    gh issue edit "$ISSUE_NUM" --repo "$REPO" --remove-label blocked >/dev/null || \
      echo "::warning::Could not remove blocked label from issue #${ISSUE_NUM}" >&2
    gh issue comment "$ISSUE_NUM" --repo "$REPO" \
      --body "Automatically removed the \`blocked\` label because all listed dependency issues are now closed." >/dev/null || \
      echo "::warning::Could not record unblock comment on issue #${ISSUE_NUM}" >&2
    unblocked_issues+=("$ISSUE_NUM")
  else
    echo "Blocked issue #${ISSUE_NUM} still waiting on dependencies ${OPEN_DEPENDENCIES[*]}." >&2
  fi
done < <(printf '%s' "$OPEN_PIPELINE_ISSUES" | jq -c '.[]')

closed_json=$(printf '%s\n' "${closed_parents[@]:-}" | jq -R . | jq -s 'map(select(length > 0))')
unblocked_json=$(printf '%s\n' "${unblocked_issues[@]:-}" | jq -R . | jq -s 'map(select(length > 0))')

jq -n \
  --argjson closed_parents "$closed_json" \
  --argjson unblocked_issues "$unblocked_json" \
  '{
    actions_taken: (($closed_parents | length) + ($unblocked_issues | length)),
    closed_parents: $closed_parents,
    unblocked_issues: $unblocked_issues
  }'
