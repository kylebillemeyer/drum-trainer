#!/bin/bash
# Plane.so provider for drum-trainer daemon.
# Sourced by daemon.sh — do not execute directly.
# Required env: PLANE_API_KEY
# Optional env: PLANE_WORKSPACE_SLUG, PLANE_PROJECT_ID, PLANE_BASE_URL

PLANE_WORKSPACE_SLUG="${PLANE_WORKSPACE_SLUG:-kb-agent}"
PLANE_PROJECT_ID="${PLANE_PROJECT_ID:-f0f77d38-9069-444e-8770-229ade02c378}"
PLANE_BASE_URL="${PLANE_BASE_URL:-https://api.plane.so}"

# ── state IDs ─────────────────────────────────────────────────────────────────
_STATE_BACKLOG="7be4fceb-21c0-4eba-941c-8c5103c0b3f3"
_STATE_IN_PROGRESS="5957ff5b-e438-4b62-bd83-d573a2c81037"
_STATE_IN_REVIEW="f43ddaed-bd8c-41f2-86d4-a761417e7694"

# ── label IDs ─────────────────────────────────────────────────────────────────
_LABEL_SPEC_APPROVED="0c4454a3-7b12-474c-bc80-0fc882681599"
_LABEL_NEEDS_INPUT="d90dcac2-76c7-4502-9c57-615ec0ec7945"

# ── helpers ───────────────────────────────────────────────────────────────────

_plane_api() {
  local method=$1
  local path=$2
  shift 2
  curl -s -X "$method" \
    -H "x-api-key: ${PLANE_API_KEY}" \
    -H "Content-Type: application/json" \
    "${PLANE_BASE_URL}/api/v1/workspaces/${PLANE_WORKSPACE_SLUG}${path}" \
    "$@"
}

_get_issue() {
  _plane_api GET "/projects/${PLANE_PROJECT_ID}/issues/${1}/"
}

_current_labels() {
  local id=$1
  _get_issue "$id" | python3 -c "
import json, sys
print(json.dumps(json.load(sys.stdin).get('label_ids', []) or []))
" 2>/dev/null || echo "[]"
}

_patch_issue() {
  local id=$1
  local body=$2
  _plane_api PATCH "/projects/${PLANE_PROJECT_ID}/issues/${id}/" -d "$body" >/dev/null 2>&1 || true
}

# ── provider interface ────────────────────────────────────────────────────────

provider_find_next() {
  _plane_api GET "/projects/${PLANE_PROJECT_ID}/issues/?per_page=100" | python3 -c "
import json, sys
results = json.load(sys.stdin).get('results', [])
spec_approved = '${_LABEL_SPEC_APPROVED}'
priority_order = {'urgent': 0, 'high': 1, 'medium': 2, 'low': 3, 'none': 99}
eligible = [
  i for i in results
  if spec_approved in (i.get('label_ids') or [])
  and i.get('priority', 'none') != 'none'
]
if not eligible:
    sys.exit(0)
eligible.sort(key=lambda i: (priority_order.get(i.get('priority', 'none'), 99), i.get('created_at', '')))
print(eligible[0]['id'])
" 2>/dev/null || true
}

provider_find_resumable() {
  local issues
  issues=$(_plane_api GET "/projects/${PLANE_PROJECT_ID}/issues/?per_page=100" | python3 -c "
import json, sys
results = json.load(sys.stdin).get('results', [])
needs_input = '${_LABEL_NEEDS_INPUT}'
for i in results:
    if needs_input in (i.get('label_ids') or []):
        print(i['id'])
" 2>/dev/null || true)

  for issue_id in $issues; do
    local count
    count=$(_plane_api GET "/projects/${PLANE_PROJECT_ID}/issues/${issue_id}/comments/?per_page=50" | \
      python3 -c "import json,sys; print(len(json.load(sys.stdin).get('results', [])))" 2>/dev/null || echo 0)
    if [ "${count:-0}" -ge 2 ]; then
      echo "$issue_id"
      return
    fi
  done
}

# Writes TICKET.md to the worktree. For needs-input mode, appends comments.
provider_fetch_ticket() {
  local id=$1
  local worktree=$2
  local mode=${3:-fresh}

  _get_issue "$id" | python3 -c "
import json, sys
i = json.load(sys.stdin)
seq = i.get('sequence_id', '')
gh_num = i.get('external_id', '')
print('# ' + i.get('name', ''))
print('Ticket ID: ' + i.get('id', ''))
print('Sequence: #' + str(seq))
if gh_num:
    print('GitHub Issue: #' + str(gh_num))
print('Priority: ' + i.get('priority', ''))
print()
print(i.get('description_stripped', '') or '(no description)')
" > "${worktree}/TICKET.md" 2>/dev/null || true

  if [ "$mode" = "needs-input" ]; then
    printf '\n\n---\n## Human replies\n' >> "${worktree}/TICKET.md"
    _plane_api GET "/projects/${PLANE_PROJECT_ID}/issues/${id}/comments/?per_page=50" | \
      python3 -c "
import json, sys
comments = json.load(sys.stdin).get('results', [])
for c in comments:
    text = c.get('comment_stripped', '') or ''
    print(text)
    print()
" 2>/dev/null >> "${worktree}/TICKET.md" || true
  fi
}

provider_mark_in_progress() {
  local id=$1
  local labels
  labels=$(_current_labels "$id" | python3 -c "
import json, sys
labels = json.load(sys.stdin)
remove = {'${_LABEL_SPEC_APPROVED}', '${_LABEL_NEEDS_INPUT}'}
print(json.dumps([l for l in labels if l not in remove]))
")
  _patch_issue "$id" "{\"state\": \"${_STATE_IN_PROGRESS}\", \"label_ids\": ${labels}}"
}

provider_mark_needs_input() {
  local id=$1
  local comment=$2
  # Escape comment for JSON
  local escaped
  escaped=$(echo "$comment" | python3 -c "import json,sys; print(json.dumps(sys.stdin.read().strip()))")
  _plane_api POST "/projects/${PLANE_PROJECT_ID}/issues/${id}/comments/" \
    -d "{\"comment_html\": \"<p>${comment}</p>\"}" >/dev/null 2>&1 || true
  local labels
  labels=$(_current_labels "$id" | python3 -c "
import json, sys
labels = json.load(sys.stdin)
needs_input = '${_LABEL_NEEDS_INPUT}'
if needs_input not in labels:
    labels.append(needs_input)
print(json.dumps(labels))
")
  _patch_issue "$id" "{\"state\": \"${_STATE_BACKLOG}\", \"label_ids\": ${labels}}"
}

provider_mark_needs_review() {
  local id=$1
  local labels
  labels=$(_current_labels "$id")
  _patch_issue "$id" "{\"state\": \"${_STATE_IN_REVIEW}\", \"label_ids\": ${labels}}"
}

provider_mark_spec_approved() {
  local id=$1
  local labels
  labels=$(_current_labels "$id" | python3 -c "
import json, sys
labels = json.load(sys.stdin)
spec_approved = '${_LABEL_SPEC_APPROVED}'
needs_input = '${_LABEL_NEEDS_INPUT}'
labels = [l for l in labels if l != needs_input]
if spec_approved not in labels:
    labels.append(spec_approved)
print(json.dumps(labels))
")
  _patch_issue "$id" "{\"state\": \"${_STATE_BACKLOG}\", \"label_ids\": ${labels}}"
}

provider_is_complete() {
  local id=$1
  local state
  state=$(_get_issue "$id" | python3 -c "import json,sys; print(json.load(sys.stdin).get('state', ''))" 2>/dev/null || echo "")
  [ "$state" = "${_STATE_IN_REVIEW}" ] && echo true || echo false
}

provider_worktree_name() {
  # Use the Plane sequence_id for readable worktree names
  local id=$1
  local seq
  seq=$(_get_issue "$id" | python3 -c "import json,sys; print(json.load(sys.stdin).get('sequence_id', ''))" 2>/dev/null || echo "")
  [ -n "$seq" ] && echo "$seq" || echo "$id"
}

provider_check_deps() {
  if [ -z "${PLANE_API_KEY:-}" ]; then
    PLANE_API_KEY=$(security find-generic-password -a "drum-trainer-agent" -s "PLANE_API_KEY" -w 2>/dev/null || true)
  fi
  if [ -z "${PLANE_API_KEY:-}" ]; then
    echo "Error: PLANE_API_KEY not found in environment or Keychain." >&2
    echo "Store it with: security add-generic-password -a drum-trainer-agent -s PLANE_API_KEY -w <key>" >&2
    exit 1
  fi
}
