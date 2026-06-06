#!/bin/bash
# drum-trainer implementation daemon
# Polls a ticket system for ready issues, spawns a Docker container to implement them.
#
# Usage:
#   TICKET_PROVIDER=plane bash scripts/daemon.sh   # use Plane.so
#   TICKET_PROVIDER=github bash scripts/daemon.sh  # use GitHub Issues (default)
#
# Logs: tail -f ~/Library/Logs/drum-trainer-daemon.log

set -u

REPO_PATH="/Users/kyle/Documents/git/drum-trainer"
WORKTREES_DIR="$(dirname "$REPO_PATH")/drum-trainer-worktrees"
DOCKER_IMAGE="drum-trainer-agent"
LOG_FILE="$HOME/Library/Logs/drum-trainer-daemon.log"
TICKET_PROVIDER="${TICKET_PROVIDER:-github}"
SLEEP_NO_WORK=1800  # 30 min when queue is empty
SLEEP_ERROR=300     # 5 min on unexpected error
MAX_TURNS=50        # per session; assessor handles continuations

# ── provider ──────────────────────────────────────────────────────────────────

PROVIDER_FILE="$(dirname "$0")/providers/${TICKET_PROVIDER}.sh"
if [ ! -f "$PROVIDER_FILE" ]; then
  echo "Error: Unknown TICKET_PROVIDER '${TICKET_PROVIDER}'. No file: ${PROVIDER_FILE}" >&2
  exit 1
fi
# shellcheck source=/dev/null
source "$PROVIDER_FILE"

# ── helpers ───────────────────────────────────────────────────────────────────

log() {
  local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

check_deps() {
  # GITHUB_TOKEN always needed — PRs live on GitHub regardless of ticket provider
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

  # Provider-specific credential check
  provider_check_deps

  if ! docker image inspect "$DOCKER_IMAGE" &>/dev/null; then
    echo "Error: Docker image '$DOCKER_IMAGE' not found." >&2
    echo "Build it with: docker build -t $DOCKER_IMAGE scripts/" >&2
    exit 1
  fi
}

# ── worktree management ───────────────────────────────────────────────────────

setup_worktree() {
  local ticket_id=$1
  local name
  name=$(provider_worktree_name "$ticket_id")
  local path="${WORKTREES_DIR}/ticket-${name}"
  mkdir -p "$WORKTREES_DIR"
  if [ ! -d "$path" ]; then
    git -C "$REPO_PATH" worktree add "$path" -B "feat/ticket-${name}" >> "$LOG_FILE" 2>&1
    log "Created worktree: $path" >&2
  else
    log "Reusing existing worktree: $path" >&2
  fi
  echo "$path"
}

cleanup_worktree() {
  local ticket_id=$1
  local worktree=$2

  [ ! -d "$worktree" ] && return

  local done
  done=$(provider_is_complete "$ticket_id")

  if [ "$done" = "true" ]; then
    git -C "$REPO_PATH" worktree remove "$worktree" --force
    log "Removed worktree: $worktree"
  else
    log "Leaving worktree: $worktree (session did not complete)"
  fi
}

# ── status file ───────────────────────────────────────────────────────────────

# Reads AGENT_STATUS.md written by the agent/assessor.
# First line: status keyword (needs-review | needs-input | spec-approved)
# Remaining lines: comment body (for needs-input)
read_agent_status() {
  local worktree=$1
  local status_file="${worktree}/AGENT_STATUS.md"
  [ -f "$status_file" ] && cat "$status_file" || echo ""
}

apply_agent_status() {
  local ticket_id=$1
  local worktree=$2
  local raw
  raw=$(read_agent_status "$worktree")
  local status
  status=$(echo "$raw" | head -1 | tr -d '[:space:]')
  local comment
  comment=$(echo "$raw" | tail -n +2)

  case "$status" in
    needs-review)
      log "Agent completed — marking needs-review."
      provider_mark_needs_review "$ticket_id"
      ;;
    needs-input)
      log "Agent blocked — marking needs-input."
      provider_mark_needs_input "$ticket_id" "$comment"
      ;;
    spec-approved)
      log "Assessor: progress — resetting to spec-approved."
      provider_mark_spec_approved "$ticket_id"
      ;;
    *)
      log "Warning: missing or unrecognised AGENT_STATUS.md ('${status}') — leaving ticket state unchanged."
      ;;
  esac
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
  shift
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
  local ticket_id=$1
  local mode=$2   # "fresh" | "needs-input" | "continuing"
  local worktree=$3

  local preamble
  local plan_instructions
  case "$mode" in
    needs-input)
      preamble="A ticket was blocked waiting for human input. The human has replied — read TICKET.md (which includes the replies at the bottom) and continue implementing."
      plan_instructions="Read AGENT_PLAN.md to see what was completed before the block. Check off tasks as you complete them and commit the updates."
      ;;
    continuing)
      preamble="A ticket hit its turn limit. The assessor determined work was progressing. Read AGENT_PLAN.md — it has a continuation note. Pick up from the first unchecked task."
      plan_instructions="Read AGENT_PLAN.md first. Check off tasks ([x]) as you complete them and commit the updates immediately after each task."
      ;;
    *)  # fresh
      preamble="Implement the ticket described in TICKET.md for the drum-trainer project."
      plan_instructions="Before writing any code:
1. Create AGENT_PLAN.md at the worktree root with a task breakdown derived from the spec. Use this format:
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

  # Extract GitHub issue number from TICKET.md for PR creation
  local gh_issue
  gh_issue=$(grep -m1 "^GitHub Issue:" "${worktree}/TICKET.md" 2>/dev/null | sed 's/GitHub Issue: #//' | tr -d '[:space:]' || true)
  local closes_ref=""
  [ -n "$gh_issue" ] && closes_ref="Closes #${gh_issue}"

  docker_claude "$worktree" -p "
${preamble}

Working directory: ${worktree}
Read CLAUDE.md and frontend/CLAUDE.md first, then read TICKET.md for the full spec.

${plan_instructions}

- Implement exactly what the spec says, nothing more
- Run \`cd frontend && npx tsc --noEmit\` — do not open a PR if it fails
- If you hit an architectural decision not covered by the spec or CLAUDE.md:
  Write AGENT_STATUS.md with exactly:
    needs-input
    <explain the decision, the options, and why you cannot proceed without input>
  Then stop without opening a PR.
- When done: open a PR with '${closes_ref}' in the body. PR description must
  include: what changed, which files, what to manually test.
  Then write AGENT_STATUS.md with exactly:
    needs-review
" \
    --permission-mode bypassPermissions \
    --max-turns "$MAX_TURNS"
}

invoke_assessor() {
  local ticket_id=$1
  local worktree=$2

  log "Running assessor for ticket ${ticket_id}…"

  docker_claude "$worktree" -p "
You are assessing an autonomous coding agent that hit its turn limit.

Step 1 — understand the goal:
  Read TICKET.md in the working directory.

Step 2 — review what the agent did:
  cat ${worktree}/AGENT_PLAN.md   (if it exists)
  git -C ${worktree} diff HEAD

Step 3 — decide: is the agent making meaningful progress toward completing the spec,
or is it stuck (looping, confused, or blocked on something it cannot resolve alone)?

If PROGRESS — the remaining work is clear and completable:
  a. Append to AGENT_PLAN.md (create if missing):
       ## Assessor Continuation Note
       <2-3 sentences: what is done, what remains, where to start next>
  b. Commit: git add AGENT_PLAN.md && git commit -m 'Assessor continuation note'
  c. Write AGENT_STATUS.md with exactly:
       spec-approved

If STUCK — the agent needs human input:
  a. Write AGENT_STATUS.md with exactly:
       needs-input
       <explain what the agent tried, what it changed, and what is blocking it>
" \
    --permission-mode bypassPermissions \
    --max-turns 10
}

# ── main loop ─────────────────────────────────────────────────────────────────

check_deps
mkdir -p "$(dirname "$LOG_FILE")"
cd "$REPO_PATH"

REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
log "Daemon started — provider: ${TICKET_PROVIDER}, repo: ${REPO}"
log "Worktrees: ${WORKTREES_DIR}"

while true; do
  ticket_id=""
  needs_input=false

  if ticket_id=$(provider_find_resumable) && [ -n "$ticket_id" ]; then
    log "Resuming ticket ${ticket_id} (human replied to needs-input)"
    needs_input=true
  elif ticket_id=$(provider_find_next) && [ -n "$ticket_id" ]; then
    log "Picked up ticket ${ticket_id}"
  else
    log "Queue empty — sleeping ${SLEEP_NO_WORK}s."
    sleep "$SLEEP_NO_WORK"
    continue
  fi

  worktree=$(setup_worktree "$ticket_id")

  # Determine session mode
  mode="fresh"
  if [ "$needs_input" = "true" ]; then
    mode="needs-input"
  elif [ -f "${worktree}/AGENT_PLAN.md" ]; then
    mode="continuing"
  fi

  # Daemon owns ticket state — mark in-progress and write spec before spawning
  provider_mark_in_progress "$ticket_id"
  provider_fetch_ticket "$ticket_id" "$worktree" "$mode"
  rm -f "${worktree}/AGENT_STATUS.md"  # clear any stale status from previous run

  tmpfile=$(mktemp)
  invoke_claude "$ticket_id" "$mode" "$worktree" | tee -a "$LOG_FILE" > "$tmpfile"
  exit_code=${PIPESTATUS[0]}
  output=$(cat "$tmpfile")
  rm -f "$tmpfile"

  if echo "$output" | grep -qi "session limit"; then
    sleep_until_reset "$output"
  elif echo "$output" | grep -qi "reached max turns"; then
    log "Turn limit hit for ticket ${ticket_id} — spawning assessor."
    invoke_assessor "$ticket_id" "$worktree" | tee -a "$LOG_FILE"
    apply_agent_status "$ticket_id" "$worktree"
  elif [ "$exit_code" -eq 0 ]; then
    apply_agent_status "$ticket_id" "$worktree"
    log "Session complete — checking for more work."
  else
    log "Unexpected error (exit ${exit_code}) — sleeping ${SLEEP_ERROR}s."
    sleep "$SLEEP_ERROR"
  fi

  cleanup_worktree "$ticket_id" "$worktree"
done
