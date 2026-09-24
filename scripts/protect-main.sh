#!/usr/bin/env bash
# Requires the CI jobs in .github/workflows/ci.yml to pass before merging into main.
# Needs repo admin rights: run with `gh auth login` as an admin, then `./scripts/protect-main.sh`.
set -euo pipefail

REPO="${REPO:-reedwilliams24/todo-tracker}"
BRANCH="${BRANCH:-main}"

gh api -X PUT "repos/$REPO/branches/$BRANCH/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["lint", "typecheck", "test", "build", "e2e"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "Branch protection applied to $REPO@$BRANCH"
