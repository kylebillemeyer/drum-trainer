# Handoff — drum-trainer

_Generated 2026-05-28. For use as context in a fresh Claude Code session._

## What this project is

A browser-based visual drum trainer for the Roland TD-27 electronic kit. The core loop: load a MIDI drum track, watch a Rock Band-style 3D note highway scroll toward you, hit the pads on the real kit, and review your timing + velocity accuracy afterward. The goal is analytical improvement — no scores, no gamification.

## Current state

- **Active branch**: `feat/3d-highway-prototype` (PR #1 open against `main`)
- **Working**: Next.js app renders two highway views — a flat 2D PixiJS highway and a 3D Three.js highway (the primary view). Both play back a hardcoded test beat with play/pause control. The 3D highway has real perspective, directional lighting, and exponential fog.
- **Not yet implemented**: MIDI input, hit detection, audio playback, MIDI file import, count-in, section looping, post-session review, pad mapping UI. The test track is hardcoded in `frontend/src/lib/testTrack.ts`.

## Key decisions made

- **Three.js for 3D, PixiJS for flat**: Started with PixiJS faking 3D via manual `1/z` projection math. Switched to Three.js for the 3D view — real `PerspectiveCamera` + `BoxGeometry` eliminates all the projection code and gives automatic face shading and fog. PixiJS stays for the flat 2D view.
- **Notes are 3D box meshes**: Tried billboard-style flat gems first; rejected. Notes are `BoxGeometry` lying on the track surface with `MeshStandardMaterial` — the directional key light naturally shades top vs. side faces.
- **Songs and exercises share one data model**: Both are `DrumTrack` — a MIDI file + optional audio backing + metadata. No separate type for each.
- **No gamification**: No scores, streaks, or pass/fail. Post-session review is a pure data overlay (ghost target notes + coloured actual hits).
- **Chrome/Edge only**: Web MIDI API isn't available in Firefox or Safari. Accepted constraint for a personal tool.
- **Soundslice as content source**: User authors drum tracks in Soundslice or a DAW and exports `.mid`. Soundslice exports MIDI directly.
- **Repo structure**: Monorepo root with `frontend/` (Next.js), `docs/`, `SPEC.md`. Room for `backend/` or `utils/` siblings later.
- **Playwright installed** in `frontend/` for debugging — headless screenshots require `--use-gl=swiftshader` to capture WebGL content.

## Open issues (GitHub)

- #2 MIDI input — Web MIDI API wiring, note→lane mapping
- #3 Hit detection — timing windows, per-hit classification
- #4 Real-time hit feedback — gem flash, ms offset display
- #5 Watch mode — playback without kit connected
- #6 Audio backing track — Web Audio API sync + pitch-corrected tempo
- #7 Count-in — metronome bar before playback, repeats each loop
- #8 Section looping — user-selected bar range, loop with count-in
- #9 Post-session review — ghost notes + actual hits overlaid
- #10 MIDI file import — parse `.mid` into `DrumTrack`
- #11 Pad mapping settings — GM defaults + manual override UI

## What to work on next

**#2 MIDI input** — everything else (hit detection, feedback, review) is blocked on receiving MIDI events from the kit. Start with `navigator.requestMIDIAccess()`, expose hits via a React context or hook, and wire up keyboard simulation so it can be tested without the TD-27.

## Critical files

| File | Purpose |
|---|---|
| `SPEC.md` | Full product specification |
| `docs/vision.md` | Design decisions and rationale |
| `frontend/src/types/music.ts` | `DrumNote`, `DrumTrack`, `LaneId` types |
| `frontend/src/lib/lanes.ts` | Lane config — MIDI→lane mapping, colors, order |
| `frontend/src/lib/testTrack.ts` | Hardcoded test beat (replace with MIDI import) |
| `frontend/src/components/DrumHighway3D/DrumHighway3D.tsx` | Primary 3D highway — Three.js scene, note mesh loop |
| `frontend/src/app/page.tsx` | Top-level page — play/pause state, flat/3D toggle |

## Gotchas

- **PixiJS v8 `resizeTo` crashes on cleanup** — `this._cancelResize is not a function`. Do not use the `resizeTo` init option; handle resizing manually with a `ResizeObserver` instead.
- **WebGL not captured by default Playwright screenshots** — must launch Chromium with `--use-gl=swiftshader` flag to get GPU-rendered canvas content in screenshots.
- **Next.js dynamic import required for canvas components** — both highway components must be loaded with `dynamic(..., { ssr: false })` since PixiJS and Three.js touch the DOM on import.
- **TD-27 MIDI note map not yet documented** — user will provide the hardware manual when pad mapping is implemented. Use GM defaults until then.
