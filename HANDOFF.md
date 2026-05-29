# Handoff — 2026-05-28

## Branch / PR
- Branch: `feat/3d-highway-prototype`
- PR #1 open: "3D perspective highway prototype" → `main`
- No uncommitted changes

## What was worked on
- Scaffolded Next.js 16 frontend in `frontend/` subdirectory (monorepo root leaves room for `backend/`, `utils/`)
- Built flat 2D highway using PixiJS v8 (`DrumHighway`)
- Built 3D highway — first with PixiJS faking perspective via manual `1/z` math, then replaced entirely with Three.js (`DrumHighway3D`)
- Added Flat/3D toggle in page header; both views preserved
- Wrote `SPEC.md`, `docs/vision.md`, `README.md`
- Created 10 GitHub issues (#2–#11) covering the full feature roadmap
- Added `/handoff` slash command
- Wrote root `CLAUDE.md` and expanded `frontend/CLAUDE.md` with persistent project context

## Current status
- 3D highway renders correctly: real perspective, directional lighting, exponential fog, velocity-encoded emissive glow
- Flat highway also working
- No MIDI input, no audio, no hit detection — app plays a hardcoded test beat only
- PR #1 is open but not yet merged

## Next task
**#2 MIDI input** — `navigator.requestMIDIAccess()`, expose hits via a hook/context, map note numbers to `LaneId` using `lib/lanes.ts`. Everything else (hit detection, feedback, review) is blocked on this.

## Session-specific decisions
- Switched from PixiJS to Three.js for the 3D view mid-session after realising manual perspective projection was more complex than just using a real 3D library. Rationale captured in `docs/vision.md`.
- Decided to keep PixiJS for the flat view — no perspective needed there so a 2D library is the right fit.
