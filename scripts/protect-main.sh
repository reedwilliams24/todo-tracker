#!/usr/bin/env bash
# Documents the `main` ruleset. GitHub's merge queue is ruleset-only, so the legacy
# branch-protection API below is no longer used; configure it in the UI instead:
#
#   Settings → Rules → Rulesets → New branch ruleset
#     Name: main, Enforcement: Active, Target: Include default branch
#     [x] Restrict deletions
#     [x] Block force pushes
#     [x] Require status checks to pass
#           checks: lint, typecheck, test, spec, build, e2e, android, ios
#           [ ] Require branches to be up to date before merging   (the queue does this)
#     [x] Require merge queue
#           Merge method: Squash
#           Build concurrency: 5
#           Minimum / maximum group size: 1 / 5, wait 1 minute
#           Status check timeout: 60 minutes
#           [ ] Require all queue entries to pass required checks  (only the merge group's run)
#   Then delete the old classic protection rule under Settings → Branches so the
#   two don't fight (the classic rule's "up to date" requirement would still block).
#
# `.github/workflows/ci.yml` must keep the `merge_group:` trigger or queued PRs
# never get their checks and time out.
set -euo pipefail
echo "The main ruleset is managed in the GitHub UI; see the comments in this file." >&2
exit 1
