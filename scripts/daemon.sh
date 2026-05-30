#!/bin/bash
# drum-trainer implementation daemon
# Polls GitHub for ready issues, spawns a Docker container to implement them.
# Usage: GITHUB_TOKEN=ghp_xxx bash scripts/daemon.sh
# Logs:  tail -f ~/Library/Logs/drum-trainer-daemon.log

set -u

REPO_PATH="/Users/kyle/Documents/git/drum-trainer"
WORKTREES_DIR="$(dirname "$REPO_PATH")/drum-trainer-worktrees"
DOCKER_IMAGE="drum-trainer-agent"
LOG_FILE="$HOME/Library/Logs/drum-trainer-daemon.log"
SLEEP_NO_WORK=1800  # 30 min when queue is empty
SLEEP_ERROR=300     # 5 min on unexpected error

# ── helpers ───────────────────────────────────────────────────────────────────

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

check_deps() {
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    GITHUB_TOKEN=$(security find-generic-password -a "drum-trainer-agent" -s "GITHUB_TOKEN" -w 2>/dev/null || true)
  fi
  if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "Error: GITHUB_TOKEN not found in environment or Keychain." >&2
    echo "Store it with: security add-generic-password -a drum-trainer-agent -s GITHUB_TOKEN -w <token>" >&2
    exit 1
  fi
  if ! docker image inspect "$DOCKER_IMAGE" &>/dev/null; then
    echo "Error: Docker image '$DOCKER_IMAGE' not found." >&2
    echo "Build it with: docker build -t $DOCKER_IMAGE scripts/" >&2
    exit 1
  fi
}

# ── issue selection ───────────────────────────────────────────────────────────

# Returns issue number if a needs-input issue has a human reply
# (detected by comment count >= 2: agent question + at least one reply)
find_resumable_issue() {
  local repo=$1
  local issues
  issues=$(gh issue list --repo "$repo" --label "needs-input" --state open \
    --json number -q '.[].number' 2>/dev/null || true)
  for num in $issues; do
    local count
    count=$(gh api "repos/$repo/issues/$num/comments" --jq 'length' 2>/dev/null || echo 0)
    if [ "${count:-0}" -ge 2 ]; then
      echo "$num"
      return
    fi
  done
}

# Returns highest-priority spec-approved issue. Never picks p4.
find_next_issue() {
  local repo=$1
  gh issue list --repo "$repo" --label "spec-approved" --state open \
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

# ── worktree management ───────────────────────────────────────────────────────

# Creates a worktree for the issue if one doesn't already exist
setup_worktree() {
  local issue=$1
  local path="${WORKTREES_DIR}/issue-${issue}"
  mkdir -p "$WORKTREES_DIR"
  if [ ! -d "$path" ]; then
    git -C "$REPO_PATH" worktree add "$path" -b "feat/issue-${issue}"
    log "Created worktree: $path"
  else
    log "Reusing existing worktree: $path"
  fi
  echo "$path"
}

# Removes the worktree only if the issue was successfully moved to needs-review
cleanup_worktree() {
  local issue=$1
  local repo=$2
  local path="${WORKTREES_DIR}/issue-${issue}"

  [ ! -d "$path" ] && return

  local done
  done=$(gh issue view "$issue" --repo "$repo" --json labels \
    --jq '.labels | map(.name) | contains(["needs-review"])' 2>/dev/null || echo false)

  if [ "$done" = "true" ]; then
    git -C "$REPO_PATH" worktree remove "$path" --force
    log "Removed worktree for #${issue}"
  else
    log "Leaving worktree for #${issue} (session did not complete)"
  fi
}

# ── rate limit handling ───────────────────────────────────────────────────────

sleep_until_reset() {
  local output=$1
  local reset_str
  reset_str=$(echo "$output" | grep -oi "resets [0-9][0-9]*:[0-9][0-9] [ap]m" | head -1 | cut -d' ' -f2-)

  if [ -z "$reset_str" ]; then
    log "Could not parse reset time — sleeping 1 hour as fallback."
    sleep 3600
    return
  fi

  local reset_epoch now_epoch secs
  reset_epoch=$(date -j -f "%I:%M %p" "$reset_str" +%s 2>/dev/null || echo 0)
  now_epoch=$(date +%s)
  secs=$(( reset_epoch - now_epoch ))
  [ "$secs" -le 0 ] && secs=$(( secs + 86400 ))

  log "Rate limit hit — resuming at $reset_str (${secs}s)."
  sleep "$secs"
}

# ── claude invocation ─────────────────────────────────────────────────────────

invoke_claude() {
  local issue=$1
  local resuming=$2
  local worktree=$3

  local preamble="Implement issue #${issue} for the drum-trainer project."
  if [ "$resuming" = "true" ]; then
    preamble="Issue #${issue} was blocked waiting for input. The human has replied in the comments — read them and continue implementing."
  fi

  docker run --rm \
    --volume "$(dirname "$REPO_PATH"):$(dirname "$REPO_PATH")" \
    --volume "$HOME/.claude:/root/.claude:ro" \
    --volume "$HOME/.gitconfig:/root/.gitconfig:ro" \
    --env GITHUB_TOKEN="$GITHUB_TOKEN" \
    --workdir "$worktree" \
    "$DOCKER_IMAGE" \
    claude -p "
${preamble}

Working directory: ${worktree}
Read CLAUDE.md and frontend/CLAUDE.md first, then: gh issue view ${issue} --repo ${REPO}

- Add label 'in-progress' when you start; remove 'spec-approved' or 'needs-input'
- Implement exactly what the spec says, nothing more
- If you hit an architectural decision not covered by the spec or CLAUDE.md:
  comment on the issue describing the tradeoff and your options,
  add 'needs-input', remove 'in-progress', stop without opening a PR
- Run \`cd frontend && npx tsc --noEmit\` — do not open a PR if it fails
- Open a PR with 'Closes #${issue}' in the body
- PR description must include: what changed, which files, what to manually test
- Add 'needs-review', remove 'in-progress' when done
" \
    --permission-mode bypassPermissions \
    --max-turns 50 \
    2>&1
}

# ── main loop ─────────────────────────────────────────────────────────────────

check_deps
mkdir -p "$(dirname "$LOG_FILE")"
cd "$REPO_PATH"

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
log "Daemon started — repo: ${REPO}"
log "Worktrees: ${WORKTREES_DIR}"

while true; do
  issue=""
  resuming=false

  if issue=$(find_resumable_issue "$REPO") && [ -n "$issue" ]; then
    log "Resuming #${issue} (human replied to needs-input)"
    resuming=true
  elif issue=$(find_next_issue "$REPO") && [ -n "$issue" ]; then
    log "Picked up #${issue}"
  else
    log "Queue empty — sleeping ${SLEEP_NO_WORK}s."
    sleep "$SLEEP_NO_WORK"
    continue
  fi

  worktree=$(setup_worktree "$issue")

  tmpfile=$(mktemp)
  invoke_claude "$issue" "$resuming" "$worktree" | tee -a "$LOG_FILE" > "$tmpfile"
  exit_code=${PIPESTATUS[0]}
  output=$(cat "$tmpfile")
  rm -f "$tmpfile"

  cleanup_worktree "$issue" "$REPO"

  if echo "$output" | grep -qi "session limit"; then
    sleep_until_reset "$output"
  elif [ "$exit_code" -eq 0 ]; then
    log "Session complete — checking for more work."
  else
    log "Unexpected error (exit ${exit_code}) — sleeping ${SLEEP_ERROR}s."
    sleep "$SLEEP_ERROR"
  fi
done
