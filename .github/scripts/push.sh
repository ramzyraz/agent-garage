#!/usr/bin/env bash
# Rebase local commits onto origin/main and push.
# Conflicts in projects/investigator/BACKLOG.md (the Investigator adding briefs while the
# Builders change a status) are merged automatically. Any other conflict saves the work
# to a branch named "<prefix>-conflict-<run id>" and fails the step.
# Usage: bash .github/scripts/push.sh <prefix>
set -uo pipefail
prefix=${1:-run}
backlog=projects/investigator/BACKLOG.md
merge=.github/scripts/merge-backlog.mjs

if [ -z "$(git log origin/main..HEAD --oneline 2>/dev/null)" ] && git diff --quiet origin/main 2>/dev/null; then
  echo "Nothing to push."; exit 0
fi

if ! git pull -q --rebase origin main; then
  while [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; do
    conflicted=$(git diff --name-only --diff-filter=U)
    if [ "$conflicted" = "$backlog" ]; then
      tmp=$(mktemp -d)
      git show ":2:$backlog" > "$tmp/a.md"   # upstream version
      git show ":3:$backlog" > "$tmp/b.md"   # our commit's version
      node "$merge" "$tmp/a.md" "$tmp/b.md" > "$backlog"
      git add "$backlog"
      echo "Merged a backlog conflict automatically."
      GIT_EDITOR=true git rebase --continue > /dev/null 2>&1 || true
    else
      git rebase --abort
      branch="$prefix-conflict-${GITHUB_RUN_ID:-local}"
      git push -q origin HEAD:"$branch"
      echo "::error::Conflicted with a push to main ($conflicted). Work saved to branch $branch."
      exit 1
    fi
  done
fi
git push -q
