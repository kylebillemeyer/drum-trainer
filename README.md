# Drum Trainer

A browser-based visual drum trainer for electronic drum kits. Displays a Rock Band-style 3D scrolling note highway connected to a real MIDI drum kit, with per-hit timing and velocity feedback for analytical practice — no scores, no gamification.

See [SPEC.md](./SPEC.md) for the full product specification and [docs/vision.md](./docs/vision.md) for the project vision and design decisions.

---

## Requirements

- **Node.js** v18 or later
- **npm** v9 or later
- **Chrome or Edge** — required for Web MIDI API support (Firefox and Safari are not supported)

---

## Development

```bash
cd frontend
npm install
npm run dev
```

The app is served at `http://localhost:3000`.

### Project structure

```
drum-trainer/
├── frontend/          # Next.js app (React + TypeScript + Tailwind + PixiJS)
│   └── src/
│       ├── app/           # Next.js App Router pages and layout
│       ├── components/    # UI and canvas components
│       │   ├── DrumHighway/     # Flat 2D scrolling highway
│       │   └── DrumHighway3D/   # 3D perspective highway (primary view)
│       ├── lib/           # Shared logic (lane config, test track)
│       └── types/         # TypeScript types (DrumTrack, DrumNote, etc.)
├── SPEC.md            # Product specification
└── README.md
```

### Other commands

```bash
npm run build      # Production build
npm run lint       # ESLint
npx tsc --noEmit   # Type-check without building
```

---

## Usage

1. Open `http://localhost:3000` in **Chrome or Edge**
2. Use the **Flat / 3D** toggle in the header to switch highway views
3. Press **Play** to start the note highway scrolling
4. Press **Pause** to stop

> **MIDI input, audio backing, and hit detection are not yet implemented.** See the [open issues](https://github.com/kylebillemeyer/drum-trainer/issues) for the development roadmap.

---

## Content format

Songs and exercises share the same data model: a MIDI file (`.mid`) for the drum track plus an optional audio file (`.mp3` / `.wav`) for backing. MIDI files can be exported from any DAW or from [Soundslice](https://www.soundslice.com).

The currently displayed pattern is a hardcoded test beat defined in `src/lib/testTrack.ts`. MIDI file import is tracked in [#10](https://github.com/kylebillemeyer/drum-trainer/issues/10).

---

## Browser compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---|---|---|---|---|
| Note highway (WebGL) | ✅ | ✅ | ✅ | ✅ |
| Web MIDI (kit input) | ✅ | ✅ | ❌ | ❌ |

Chrome or Edge is required for kit connectivity.
