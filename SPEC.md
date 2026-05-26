# Drum Trainer — Application Spec

## Overview
A browser-based visual drum trainer that connects to a Roland TD-27 electronic drum kit via Web MIDI. The interface uses a Rock Band/Guitar Hero-style scrolling note highway, enhanced with multi-zone and velocity-sensitive note representation. The goal is analytical improvement, not gamification.

---

## Content Model
Songs and exercises share a single unified model:

| Field | Type | Required |
|---|---|---|
| MIDI file | `.mid` | Yes |
| Audio backing | `.mp3` / `.wav` | No |
| Title, tags | string | Yes |
| Tempo (BPM) | number | Yes |
| Time signature | e.g. `4/4` | Yes |

**Songs** typically include audio backing. **Exercises** typically have only a MIDI pattern with an optional metronome click. Both are otherwise treated identically by the player.

### Content Entry
- Import MIDI files from a DAW or Soundslice (which exports `.mid` directly)
- MIDI encodes timing, note identity (pad), and velocity (dynamics)

---

## Kit Connectivity
- **Protocol**: Web MIDI API (`navigator.requestMIDIAccess`) — Chrome/Edge only
- **Default mapping**: General MIDI drum map (kick = 36, snare = 38, hi-hat = 42/46, etc.)
- **Settings screen**: Manual pad remapping — assign any incoming MIDI note number to a named pad/zone
- **Zone support**: TD-27 sends different MIDI notes per zone (e.g. snare center vs rimshot vs rim click, cymbal bow vs bell vs edge) — all captured and mapped

---

## Note Highway (Visual Design)
A horizontally scrolling lane system. Notes approach from the right; the hit zone is at the left edge.

### Lanes
- One lane per instrument: kick, snare, hi-hat, toms (×N), crash (×N), ride
- Layout mirrors the physical kit (kick at bottom, cymbals at top)

### Note Gems
- **Zone**: visual treatment TBD — to be decided during prototyping (candidates: gem shape, outline style, fill pattern)
- **Velocity**: encoded visually per gem (brightness, size, or opacity)
- **Color**: one color per instrument

### Tempo Control
- Pitch-corrected slow-down — 50%, 75%, 100% (and ideally continuous)
- Applied to both MIDI highway timing and audio backing track simultaneously

---

## Playback & Session Modes

### Audio Modes (user selects per session)
| Mode | What plays |
|---|---|
| Click-only | MIDI highway + metronome tick |
| Full-song | MIDI highway + synced audio backing |

### Practice Features
- **Count-in**: Metronome beats one bar of the time signature before playback begins (configurable on/off)
- **Section looping**: User selects a bar range (e.g. bars 9–16). That section plays on repeat, with count-in on every loop iteration.
- **Tempo control**: Adjustable playback speed with pitch correction

---

## Performance Feedback

### During playback
- Visual hit confirmation on the gem (hit / early / late / miss)
- Timing offset shown in ms (e.g. `+18ms`)

### Post-session review
The highway is replayed with two overlaid data layers:
- **Ghost layer**: target notes rendered as semi-transparent grey gems
- **Performance layer**: your actual hits rendered in full color on top

This makes timing offsets, misses, and extra hits immediately readable as a spatial diff. The review uses the same highway view as live play — no separate UI needed.

Additional review data:
- Per-note timing offset and velocity comparison accessible on hover/tap
- Problem area highlighting: bars with elevated miss rate or large timing deviation flagged
- **No score, no pass/fail** — purely analytical

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React + TypeScript |
| Highway rendering | PixiJS (WebGL canvas) |
| MIDI input | Web MIDI API |
| Audio playback | Web Audio API (AudioContext) |
| Build tool | Vite |
| Target browser | Chrome / Edge |

---

## Open Questions / Deferred Decisions
1. **Zone visualization** — exact gem treatment for rim vs center, bow vs bell — to be prototyped
2. **Latency calibration** — implement as needed; defer design decisions until we understand the actual latency characteristics in practice
3. **TD-27 MIDI note map** — user will download the TD-27 manual when we reach kit mapping implementation

## Resolved Decisions
- **Watch mode**: Yes — app works without a kit connected. Enables testing and pre-listening before attempting a track.
- **Post-session replay**: Ghost notes (semi-transparent grey) + actual hits overlaid in color — a spatial diff on the same highway view. No separate review UI needed.
