@AGENTS.md

# frontend

Next.js 16 app (App Router, TypeScript, Tailwind). The UI for the drum trainer.

## Stack

| Concern | Library |
|---|---|
| Framework | Next.js 16 + TypeScript |
| Styling | Tailwind CSS |
| 3D highway | Three.js — real `PerspectiveCamera`, `BoxGeometry`, `MeshStandardMaterial` |
| Flat highway | PixiJS v8 — 2D WebGL canvas |
| MIDI input | Web MIDI API (`navigator.requestMIDIAccess`) — not yet wired up |
| Audio | Web Audio API (`AudioContext`) — not yet wired up |

## Source layout

```
src/
├── app/
│   ├── page.tsx          # root page — play/pause state, flat/3D toggle
│   ├── layout.tsx        # Geist font, html/body setup
│   └── globals.css       # base styles, overflow:hidden
├── components/
│   ├── DrumHighway/      # flat 2D PixiJS highway
│   └── DrumHighway3D/    # primary 3D Three.js highway
├── lib/
│   ├── lanes.ts          # lane config: ID, label, color, order
│   └── testTrack.ts      # hardcoded test beat — replace with MIDI import (#10)
└── types/
    └── music.ts          # DrumNote, DrumTrack, LaneId, NoteZone
```

## Patterns and rules

**Canvas components must be dynamically imported with `ssr: false`.** Both PixiJS and Three.js touch the DOM on import and will crash during SSR.

```ts
const DrumHighway3D = dynamic(() => import('@/components/DrumHighway3D/DrumHighway3D'), { ssr: false });
```

**Never use PixiJS `resizeTo` init option.** It registers an internal resize handler that throws `this._cancelResize is not a function` on cleanup. Handle resizing manually with a `ResizeObserver` that calls `app.renderer.resize(w, h)`.

**Three.js cleanup on unmount**: cancel the animation frame, disconnect the ResizeObserver, call `renderer.dispose()`, and remove the canvas element from the DOM.

**Lane order (index 0 → 8, left to right):** crash2, crash1, ride, hihat, tom1, tom2, tom3, snare, kick. Defined in `lib/lanes.ts` — do not reorder without updating MIDI mappings.

## Playwright debugging

```js
// Headless screenshots require swiftshader to capture WebGL
const browser = await chromium.launch({ args: ['--use-gl=swiftshader'] });
```
