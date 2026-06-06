#!/bin/bash
# GitHub Issues provider for drum-trainer daemon.
# Sourced by daemon.sh — do not execute directly.
# Required env: GITHUB_TOKEN, REPO (set by daemon before sourcing)

provider_find_next() {
  gh issue list --repo "$REPO" --label "spec-approved" --state open \
    --json number,createdAt,labels --jq '
      [ .[] |
        . as $i | ($i.labels | map(.name)) as $l |
        if ($l | contains(["p4"])) then empty
        else . + { score: (
          if   ($l | contains(["p0"])) then 0
          elif ($l | contains(["p1"])) then 1
          elif ($l | contains(["p3"])) then 3
          else 2 end
        )} end
      ] | sort_by([.score, .createdAt]) | first | .number // empty
    ' 2>/dev/null || true
}

provider_find_resumable() {
  local issues
  issues=$(gh issue list --repo "$REPO" --label "needs-input" --state open \
    --json number -q '.[].number' 2>/dev/null || true)
  for num in $issues; do
    local count
    count=$(gh api "repos/$REPO/issues/$num/comments" --jq 'length' 2>/dev/null || echo 0)
    if [ "${count:-0}" -ge 2 ]; then
      echo "$num"
      return
    fi
  done
}

# Writes TICKET.md to the worktree. For needs-input mode, appends comments.
provider_fetch_ticket() {
  local id=$1
  local worktree=$2
  local mode=${3:-fresh}

  gh issue view "$id" --repo "$REPO" --json title,body,number,labels \
    --jq '"# " + .title + "\nGitHub Issue: #" + (.number|tostring) + "\nLabels: " + (.labels | map(.name) | join(", ")) + "\n\n" + .body' \
    2>/dev/null > "${worktree}/TICKET.md" || true

  if [ "$mode" = "needs-input" ]; then
    printf '\n\n---\n## Human replies\n' >> "${worktree}/TICKET.md"
    gh api "repos/$REPO/issues/$id/comments" \
      --jq '.[] | "**@" + .user.login + ":** " + .body + "\n"' \
      2>/dev/null >> "${worktree}/TICKET.md" || true
  fi
}

provider_mark_in_progress() {
  local id=$1
  gh issue edit "$id" --repo "$REPO" \
    --add-label "in-progress" \
    --remove-label "spec-approved" \
    --remove-label "needs-input" 2>/dev/null || true
}

provider_mark_needs_input() {
  local id=$1
  local comment=$2
  gh issue comment "$id" --repo "$REPO" --body "$comment" 2>/dev/null || true
  gh issue edit "$id" --repo "$REPO" \
    --add-label "needs-input" \
    --remove-label "in-progress" 2>/dev/null || true
}

provider_mark_needs_review() {
  local id=$1
  gh issue edit "$id" --repo "$REPO" \
    --add-label "needs-review" \
    --remove-label "in-progress" 2>/dev/null || true
}

provider_mark_spec_approved() {
  local id=$1
  gh issue edit "$id" --repo "$REPO" \
    --add-label "spec-approved" \
    --remove-label "in-progress" \
    --remove-label "needs-input" 2>/dev/null || true
}

provider_is_complete() {
  local id=$1
  gh issue view "$id" --repo "$REPO" --json labels \
    --jq '.labels | map(.name) | contains(["needs-review"])' 2>/dev/null || echo false
}

provider_worktree_name() {
  # Use the issue number as the worktree directory name
  echo "$1"
}

provider_check_deps() {
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    GITHUB_TOKEN=$(security find-generic-password -a "drum-trainer-agent" -s "GITHUB_TOKEN" -w 2>/dev/null || true)
  fi
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "Error: GITHUB_TOKEN not found in environment or Keychain." >&2
    echo "Store it with: security add-generic-password -a drum-trainer-agent -s GITHUB_TOKEN -w <token>" >&2
    exit 1
  fi
}
