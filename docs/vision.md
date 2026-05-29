# Project Vision

## What we're building

A browser-based visual drum trainer that connects to an electronic drum kit (Roland TD-27) via Web MIDI. The interface is a Rock Band / Guitar Hero-style scrolling note highway — enhanced beyond those games to capture the full vocabulary of a real kit: zone differentiation, dynamics, and multi-pad layouts. The goal is analytical improvement, not entertainment.

This is a practice tool, not a game.

---

## The core idea

When you practice drums with a click track or a song, you know roughly how it went but you have almost no precise data. Were you rushing the hi-hat? Were your ghost notes too loud? Did the snare land on time?

The trainer answers those questions by:

1. Playing back a drum track as a visual note highway (notes scroll toward you, you hit them on the kit)
2. Recording exactly what you played — timing offset per hit, velocity per hit
3. Showing you the result afterward as a spatial diff: your hits overlaid on the target notes so you can see where you were early, late, or missing entirely

The aim is to make it obvious what needs work, without a score or pass/fail judgment getting in the way.

---

## What makes this different from Rock Band

Rock Band simplified drum input to four pads plus a kick pedal, coloured and gamified. This trainer is designed for a real drummer with a real kit:

- **More pads**: the TD-27 has 9+ surfaces — kick, snare, three toms, hi-hat, two crashes, ride — each with its own lane
- **Zone awareness**: a snare rimshot and a snare center hit are different sounds and should be different notes. Same for cymbal bow vs bell vs edge. The highway captures and represents this distinction (exact visual treatment to be decided during prototyping)
- **Velocity matters**: how hard you hit is part of what makes something sound right. Gem brightness/size encodes the target velocity, and the post-session review compares your dynamics against the original
- **No score**: a score encourages gaming the metric. This tool is for understanding your playing, not rating it

---

## Content model

Songs and exercises are treated identically — both are just:

| Field | Type | Notes |
|---|---|---|
| MIDI file | `.mid` | Required. Encodes timing, pad identity, and velocity. |
| Audio backing | `.mp3` / `.wav` | Optional. Plays in sync so you can practice against the real song. |
| Title, tags | string | Metadata |
| BPM, time signature | number | For the metronome, count-in, and bar grid |

The distinction between a "song" and an "exercise" is purely by convention — exercises tend to be short loops with no audio backing, songs have a full mix.

MIDI files are authored in a DAW or Soundslice (which exports `.mid` directly). The app parses the file and maps note numbers to the lane layout using a configurable pad map.

---

## The highway

Notes scroll from right to left (flat view) or toward the viewer from a vanishing point (3D view). The hit zone is where notes must be struck.

**Visual design decisions made:**
- **3D perspective view** is the primary view. Notes are real 3D box meshes lying flat on the track surface, shaded by a directional light so the top face is brighter than the sides — no manual color math needed. Billboard-style flat gems were prototyped and rejected.
- **Flat 2D view** is preserved as a toggle for comparison or accessibility.
- **Velocity** is encoded as emissive glow intensity on each note box — louder hits glow brighter.
- **Depth fading** is handled by Three.js exponential fog rather than manual per-note alpha calculations.
- **Zone visualization** (rim vs centre, bow vs bell vs edge) is deferred to a later prototyping stage.

---

## Practice session design

### Audio modes
The user chooses per session:
- **Click-only** — metronome tick, no backing audio. Good for exercises and isolated technique work.
- **Full song** — MIDI highway plus the backing audio file playing in sync.

### Features
- **Count-in**: one bar of metronome before playback starts, repeats at the top of every loop
- **Section looping**: user selects a bar range (e.g. bars 5–8), that region loops with count-in on every repeat
- **Tempo control**: pitch-corrected slowdown (e.g. 75%) applied to both MIDI and audio simultaneously

### Watch mode
The app functions without a kit connected — useful for previewing a track before playing it, or for testing without hardware. No hit detection runs in watch mode.

---

## Post-session review

After a run, the highway replays in review mode with two overlaid layers:

- **Ghost layer**: target notes as semi-transparent grey boxes
- **Performance layer**: your actual hits in full colour on top

Timing offset and velocity delta are available per note. Bars with elevated miss rate or large timing deviation are flagged as problem areas. There is no score or overall grade — just data.

---

## What we decided not to build (for now)

| Feature | Reason deferred |
|---|---|
| Free play mode | The kit itself covers this; no training value to add |
| Auto-loop on miss | Complex to implement well; manual section looping covers the need |
| Hands/feet isolation | Useful but not core to the first version |
| Gamification (scores, streaks, pass/fail) | Actively contrary to the analytical goal |

---

## Technology decisions

| Concern | Decision | Reason |
|---|---|---|
| Platform | Browser (Chrome/Edge only) | Web MIDI API availability; WebGL performance is sufficient |
| Framework | Next.js + TypeScript | User preference; SSR unused but not harmful |
| 3D highway rendering | Three.js | Real PerspectiveCamera and BoxGeometry — perspective, lighting, and fog handled natively |
| Flat highway rendering | PixiJS v8 (WebGL canvas) | Lightweight 2D canvas for the flat view |
| MIDI input | Web MIDI API | Direct USB MIDI access, sub-5ms latency in Chrome |
| Audio playback | Web Audio API (AudioContext) | Sample-accurate timing, pitch-corrected playback |
| Build tool | Vite (via Next.js) | Standard |

**Why Chrome only**: The Web MIDI API is not supported in Firefox or Safari without extensions. For a personal tool used at a desk with a specific drum kit, this is an acceptable constraint.

**Why Three.js for the 3D view**: We initially implemented the 3D highway by manually projecting a 2D PixiJS canvas using `1/z` perspective math. This produced correct results but required custom code for perspective, face shading, and depth fog — all things a 3D library handles natively. Switching to Three.js with a real `PerspectiveCamera` and `BoxGeometry` eliminated that code entirely and produced noticeably better visuals: proper face shading from a directional light, natural exponential fog, and correct perspective without any manual projection math.

**Why PixiJS for the flat view**: The flat 2D highway has no perspective requirements, so a lightweight 2D canvas library is the right fit there. PixiJS remains for that view.

---

## Hardware

The target kit is a **Roland TD-27** electronic drum module. It connects via USB and outputs standard MIDI. The default pad mapping uses the General MIDI drum map (kick = 36, snare = 38, etc.) with a settings screen for manual override. Zone variants (rimshot, bell, edge) are encoded as separate MIDI note numbers by the TD-27 hardware.

The TD-27 MIDI implementation chart will be consulted when implementing the pad mapping settings screen.
