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
MAX_TURNS=50        # per session; assessor handles continuations

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
  if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    CLAUDE_CODE_OAUTH_TOKEN=$(security find-generic-password -a "drum-trainer-agent" -s "CLAUDE_CODE_OAUTH_TOKEN" -w 2>/dev/null | tr -d '\n\r' || true)
  fi
  if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
    echo "Error: CLAUDE_CODE_OAUTH_TOKEN not found in environment or Keychain." >&2
    echo "Generate one with: claude setup-token" >&2
    echo "Store it with: security add-generic-password -a drum-trainer-agent -s CLAUDE_CODE_OAUTH_TOKEN -w <token>" >&2
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
    git -C "$REPO_PATH" worktree add "$path" -B "feat/issue-${issue}" >> "$LOG_FILE" 2>&1
    log "Created worktree: $path" >&2
  else
    log "Reusing existing worktree: $path" >&2
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

docker_claude() {
  local worktree=$1
  shift  # remaining args passed to claude
  docker run --rm -t \
    --volume "$(dirname "$REPO_PATH"):$(dirname "$REPO_PATH")" \
    --env GITHUB_TOKEN="$GITHUB_TOKEN" \
    --env CLAUDE_CODE_OAUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN" \
    --workdir "$worktree" \
    "$DOCKER_IMAGE" \
    claude "$@" \
    2>&1
}

invoke_claude() {
  local issue=$1
  local mode=$2   # "fresh" | "needs-input" | "continuing"
  local worktree=$3

  local preamble
  local plan_instructions
  case "$mode" in
    needs-input)
      preamble="Issue #${issue} was blocked waiting for input. The human has replied in the comments — read them and continue implementing."
      plan_instructions="Read AGENT_PLAN.md to see what was completed before the block. Check off tasks as you complete them and commit the updates."
      ;;
    continuing)
      preamble="Issue #${issue} hit its turn limit. The assessor determined work was progressing. Read AGENT_PLAN.md — it has a continuation note explaining what was done and what remains. Pick up from the first unchecked task."
      plan_instructions="Read AGENT_PLAN.md first. Check off tasks ([x]) as you complete them and commit the updates immediately after each task."
      ;;
    *)  # fresh
      preamble="Implement issue #${issue} for the drum-trainer project."
      plan_instructions="Before writing any code:
1. Create AGENT_PLAN.md at the worktree root with a task breakdown derived from the issue spec. Use this format:
   ## Goal
   One sentence description.
   ## Tasks
   - [ ] Task one
   - [ ] Task two
   ## Decisions / blockers
   (fill in as you go)
2. Commit AGENT_PLAN.md immediately before any implementation work.
3. Check off tasks ([x]) as you complete them and commit the updates."
      ;;
  esac

  docker_claude "$worktree" -p "
${preamble}

Working directory: ${worktree}
Read CLAUDE.md and frontend/CLAUDE.md first, then: gh issue view ${issue} --repo ${REPO}

${plan_instructions}

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
    --max-turns "$MAX_TURNS"
}

# Spawns a lightweight assessor session after a turn-limit exit.
# The assessor reads the issue spec, plan, and diff, then either:
#   - appends a continuation note to AGENT_PLAN.md and resets to spec-approved, or
#   - posts a needs-input comment explaining the blockage.
invoke_assessor() {
  local issue=$1
  local worktree=$2

  log "Running assessor for #${issue}…"

  docker_claude "$worktree" -p "
You are assessing an autonomous coding agent that hit its turn limit while implementing a GitHub issue.

Step 1 — understand the goal:
  gh issue view ${issue} --repo ${REPO}

Step 2 — read the agent's plan and the current diff:
  cat ${worktree}/AGENT_PLAN.md   (if it exists)
  git -C ${worktree} diff HEAD

Step 3 — decide: is the agent making meaningful progress toward completing the spec, or is it stuck (looping, confused, or blocked on something it cannot resolve without human input)?

If PROGRESS — the remaining work is clear and completable:
  a. Append this section to AGENT_PLAN.md (create the file if missing):
       ## Assessor Continuation Note
       <2-3 sentences: what is done, what remains, where the next session should start>
  b. Commit the update: git add AGENT_PLAN.md && git commit -m 'Assessor continuation note for #${issue}'
  c. Reset labels: gh issue edit ${issue} --repo ${REPO} --remove-label in-progress --add-label spec-approved

If STUCK — the agent appears blocked and needs human input:
  a. Post a comment: gh issue comment ${issue} --repo ${REPO} --body '<explain what the agent tried, what it changed, and what appears to be blocking it>'
  b. Update labels: gh issue edit ${issue} --repo ${REPO} --remove-label in-progress --add-label needs-input
" \
    --permission-mode bypassPermissions \
    --max-turns 10
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
  needs_input=false

  if issue=$(find_resumable_issue "$REPO") && [ -n "$issue" ]; then
    log "Resuming #${issue} (human replied to needs-input)"
    needs_input=true
  elif issue=$(find_next_issue "$REPO") && [ -n "$issue" ]; then
    log "Picked up #${issue}"
  else
    log "Queue empty — sleeping ${SLEEP_NO_WORK}s."
    sleep "$SLEEP_NO_WORK"
    continue
  fi

  worktree=$(setup_worktree "$issue")

  # Determine session mode from state of the worktree and issue
  mode="fresh"
  if [ "$needs_input" = "true" ]; then
    mode="needs-input"
  elif [ -f "$worktree/AGENT_PLAN.md" ]; then
    mode="continuing"
  fi

  tmpfile=$(mktemp)
  invoke_claude "$issue" "$mode" "$worktree" | tee -a "$LOG_FILE" > "$tmpfile"
  exit_code=${PIPESTATUS[0]}
  output=$(cat "$tmpfile")
  rm -f "$tmpfile"

  cleanup_worktree "$issue" "$REPO"

  if echo "$output" | grep -qi "session limit"; then
    sleep_until_reset "$output"
  elif echo "$output" | grep -qi "reached max turns"; then
    log "Turn limit hit for #${issue} — spawning assessor."
    invoke_assessor "$issue" "$worktree" | tee -a "$LOG_FILE"
    # No sleep — check for more work immediately
  elif [ "$exit_code" -eq 0 ]; then
    log "Session complete — checking for more work."
  else
    log "Unexpected error (exit ${exit_code}) — sleeping ${SLEEP_ERROR}s."
    sleep "$SLEEP_ERROR"
  fi
done
