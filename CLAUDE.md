# drum-trainer

Browser-based visual drum trainer for the Roland TD-27. A Rock Band-style 3D note highway connected to a real MIDI kit, focused on analytical practice (timing + velocity feedback) — no scores, no gamification.

Design decisions and rationale: `docs/vision.md`.

## Repo layout

```
drum-trainer/
├── frontend/      # Next.js app — see frontend/CLAUDE.md
├── docs/          # vision.md, TD-27 reference manual, future ADRs
├── scripts/       # daemon.sh, Dockerfile — autonomous agent infrastructure
├── SPEC.md        # product specification
└── HANDOFF.md     # session handoff (regenerate with /handoff)
```

Future siblings (`backend/`, `utils/`) may be added alongside `frontend/`.

## Hardware reference

The TD-27 reference manual is at `docs/TD-27_Reference_eng02_W.pdf`. Consult it for MIDI note mappings, pad/cymbal assignments, CC numbers, and kit configuration details.

## Key constraints

- **Chrome / Edge only** — Web MIDI API is not supported in Firefox or Safari. This is an accepted constraint.
- **No gamification** — no scores, streaks, or pass/fail anywhere in the product. All feedback is analytical.
- **Songs and exercises share one data model** — both are a `DrumTrack`: MIDI file + optional audio backing + metadata. Do not create separate types.

## GitHub issues = feature roadmap

All remaining work is tracked as GitHub issues. Check `gh issue list --state open` before starting new work. Don't implement features that don't have an issue; create one first.

Issues flow through these labels:

```
needs-spec → spec-written → spec-approved → in-progress → needs-review
                                                ↓
                                           needs-input  (agent blocked, see below)
```

**Priority labels** — agents pick up `spec-approved` issues in this order:

| Label | Meaning |
|-------|---------|
| `p0` | App broken, blocking usage — pick up immediately |
| `p1` | Feature actively needed soon |
| `p2` | Standard backlog (default if no priority set) |
| `p3` | Deprioritized — only when p0–p2 queue is empty |
| `p4` | Tracked idea — agent never implements automatically |

**Issue spec format** — every issue body must have two sections before it can be `spec-approved`:

```
## What
Plain description of the feature or bug.

## Spec
- Which files/components this touches
- Exact behavior or MIDI interaction
- Acceptance criteria (specific and testable)
- Any constraints relevant to this issue
```

**Needs-input protocol** — if you hit an architectural decision not covered by the spec or this file, do not guess. Instead:
1. Add a comment on the current issue describing the decision and your options
2. Add label `needs-input`, remove `in-progress`
3. Stop without opening a PR

The human will reply in the comment thread. The next agent session will read the reply and continue.

## Development

```bash
cd frontend && npm run dev   # http://localhost:3000
npx tsc --noEmit             # type-check
```

Playwright is installed in `frontend/` for browser debugging. Screenshots require `--use-gl=swiftshader` to capture WebGL canvas content.
