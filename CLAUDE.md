# drum-trainer

Browser-based visual drum trainer for the Roland TD-27. A Rock Band-style 3D note highway connected to a real MIDI kit, focused on analytical practice (timing + velocity feedback) — no scores, no gamification.

Design decisions and rationale: `docs/vision.md`.

## Repo layout

```
drum-trainer/
├── frontend/      # Next.js app — see frontend/CLAUDE.md
├── docs/          # vision.md, TD-27 reference manual, future ADRs
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

## Development

```bash
cd frontend && npm run dev   # http://localhost:3000
npx tsc --noEmit             # type-check
```

Playwright is installed in `frontend/` for browser debugging. Screenshots require `--use-gl=swiftshader` to capture WebGL canvas content.
