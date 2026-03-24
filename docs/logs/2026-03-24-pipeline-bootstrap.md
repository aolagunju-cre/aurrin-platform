# Pipeline Bootstrap Log — 2026-03-24

## Context

Abdul approved the Aurrin Ventures PRD. This session set up the autonomous delivery pipeline and ran the first PRD decomposition.

## What was done

### Secrets & auth
- Verified `COPILOT_GITHUB_TOKEN` and `GH_AW_GITHUB_TOKEN` already set (Mar 22)
- Installed the `prd-to-prod-pipeline` GitHub App on the Aurrin-Ventures org
- Set `PIPELINE_APP_ID` (variable) and `PIPELINE_APP_PRIVATE_KEY` (secret)
- Verified Vercel secrets (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`) in place

### Workflows
- Enabled all 27 GitHub Actions workflows (all were `disabled_manually`)
- Later disabled 15 non-essential workflows to reduce Copilot rate limit burn (see "Cost control" below)

### PRD synthesis
- Pulled content from the prd-to-prod case study pages (partnership overview + technical architecture with 10 ADRs)
- Synthesized into a single PRD issue covering: 12 modules, 6 roles, 17 entities, 3 phases, 10 ADRs, role access matrix, system boundaries, operational foundation

### Decomposition attempts

| Attempt | Issue | Run ID | Outcome |
|---------|-------|--------|---------|
| 1 | #5 | 23440152574 | 17/19 issues created. 2 failed: `aw_db` and `aw_og` temp IDs too short (gh-aw requires 3+ chars after `aw_`). |
| 2 | #5 | 23469838991 | Closed all issues, re-dispatched. Agent read repo-memory from attempt 1, no-oped. |
| 3 | #5 | 23470232443 | Deleted `memory/prd-decomposer` branch, re-dispatched. Agent read stale summary comment on #5, produced `missing_tool` output only. |
| 4 | #28 | 23470641103 | Fresh issue (same body, no comments), all memory branches deleted. **Success: 20/20 issues created.** |

### Repo-assist implementation attempt

| Run | ID | Outcome |
|-----|-----|---------|
| 1 | 23470879820 | Picked up #30 (Database Schema). Agent implemented fully but PR fell back to review issue #49 due to protected `package.json`. Run failed on `create_project_status_update` (hardcoded personal project board URL). |
| 2 | 23471722115 | Picked up #30 again via `/repo-assist` comment. Agent created all migration files, RLS policies, tests, docs. Build and tests passed. **Hit Copilot rate limit before pushing branch.** Work lost. |

### Workflow fixes committed

| Commit | Fix |
|--------|-----|
| `be77a10` | Patched `prd-decomposer.md` to warn against short temp IDs |
| `1d1e28b` | Removed hardcoded `create-project-status-update` (personal project board) from `repo-assist.md` |
| `8aa0137` | Removed `working-directory` from `deploy-vercel.yml` to fix doubled `studio/studio` path |
| `4731d48` | Restored `working-directory` but nullified `rootDirectory` in pulled Vercel config |

### Deploy issue (unresolved)

The Vercel project has `rootDirectory=studio` set in the dashboard. The deploy workflow also `cd`s into `studio/`. This causes `vercel deploy` to look for `studio/studio/`. Attempted two fixes in the workflow — neither fully works because Vercel's server-side config overrides local settings.

**Resolution needed**: Abdul must clear the Root Directory in the Vercel dashboard (https://vercel.com/aurrin-ventures/aurrin-platform/settings), or grant dashboard access. Deploy workflows disabled until then.

### Cost control

Hit Copilot rate limit after ~4 decomposer runs + 2 repo-assist runs + multiple CI Failure Doctor and status report runs. Disabled 15 non-essential workflows to reduce burn.

**Kept active (7 workflows):**
- Auto-Dispatch Pipeline Issues + Auto-Dispatch Requeue (routing)
- Node CI (deterministic, no Copilot cost)
- Close Linked Issues (deterministic)
- Pipeline Repo Assist (implementation, on-demand only via `/repo-assist`)
- Pipeline Review Agent + PR Review Submit (PR review)
- PRD Decomposer (already done)

**Disabled (15 workflows):**
- Agentic Maintenance, Architecture Approval Gate, CI Failure Doctor, CI Failure Router, CI Failure Resolver, Pipeline Scripts CI, Code Simplifier, Copilot Setup Steps, Duplicate Code Detector, Frontend Agent, Pipeline Status Report, Pipeline Watchdog, PRD Architecture Planner, Security Compliance Campaign, Validate Deployment

**Recommendation**: Also disable the repo-assist daily cron (`30 21 * * *`) — it fires every night even with no work, burning requests on a no-op. Use `/repo-assist` comments for on-demand dispatch instead.

### Findings drafted (in prd-to-prod repo)

Three findings written to `prd-to-prod/docs/findings/`:

1. **`gh-aw-temp-id-min-length.md`** — safe-outputs rejects temp IDs where the part after `aw_` is < 3 chars. Agent naturally picks short IDs for short concepts. Prompt workaround applied. Status: won't file upstream (intentional design decision).

2. **`gh-aw-repo-memory-overrides-dispatch-input.md`** — prior-run state (repo-memory + issue comments) can block re-runs even with explicit `workflow_dispatch` input. Related upstream: gh-aw#21501, gh-aw#21784. Revised per Codex review to avoid overclaiming causation.

3. **`gh-aw-stale-comments-poison-reruns.md`** — reruns against the original PRD issue remain sensitive to prior issue context after memory cleanup. A fresh issue with no prior comments was required for a clean rerun.

## Final state

- **PRD issue**: #28 (open)
- **Pipeline issues**: #29–#48 (20 issues, all phases covered)
- **#30** (Database Schema): `in-progress`, agent implemented but hit rate limit before push
- **#49, #54**: Fallback review issues for #30 (protected files)
- **Deploy**: disabled until Vercel dashboard root directory is fixed
- **Active workflows**: 7 (see cost control above)
- **Copilot rate limit**: resets ~2 hours from last hit (~5:40 AM UTC)
- **Closed issues**: #5–#27 (stale), #26/#50/#51/#52 (deploy CI incidents), #53 (CI doctor), #55 (rate limit failure)

## Next steps

1. Wait for Copilot rate limit reset (~2 hours)
2. `/repo-assist` on #30 to retry Database Schema implementation
3. Ask Abdul to clear Vercel project Root Directory, then re-enable deploy workflows
4. Consider disabling repo-assist cron to save Copilot requests

## Lessons learned

- gh-aw re-runs after partial failure require clearing **both** the `memory/<workflow>` branch and using a fresh issue (no stale comments). The safest path is a new issue with the same body.
- The `aw_` temp ID minimum length (3 chars) is not intuitive and agents will hit it. Explicit prompt warnings help.
- The decomposer takes 5–10 minutes for a large PRD. Issues appear toward the end of the run, not incrementally.
- Copilot rate limits can be hit quickly during bootstrap when multiple agent workflows fire in sequence. Disable non-essential workflows during setup to conserve quota.
- The `create-project-status-update` safe-output in repo-assist was hardcoded to a personal project board from the prd-to-prod repo. It was already fixed in the template but the aurrin-platform repo was provisioned before that fix landed.
- Vercel's `rootDirectory` project setting is server-side and cannot be overridden from the workflow. Fixing it requires dashboard access.
