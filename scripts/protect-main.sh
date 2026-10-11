#!/usr/bin/env bash
# Documents the `main` ruleset. GitHub's merge queue is ruleset-only, so the legacy
# branch-protection API below is no longer used; configure it in the UI instead:
#
#   Settings → Rules → Rulesets → New branch ruleset
#     Name: main, Enforcement: Active, Target: Include default branch
#     [x] Restrict deletions
#     [x] Block force pushes
#     [x] Require status checks to pass
#           checks: ci   (the gate job in ci.yml; it needs every PR job, so never list jobs here)
#           (e2e-tests-* run on main only and are NOT required)
#           [ ] Require branches to be up to date before merging   (the queue does this)
#     (Require merge queue is only offered to organization-owned repos; not available here.)
#   Then delete the old classic protection rule under Settings → Branches so the
#   two don't fight (the classic rule's "up to date" requirement would still block).
#
# `.github/workflows/ci.yml` must keep the `merge_group:` trigger or queued PRs
# never get their checks and time out.
set -euo pipefail
echo "The main ruleset is managed in the GitHub UI; see the comments in this file." >&2
exit 1
