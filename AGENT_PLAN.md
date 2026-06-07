## Goal
Add pitch-preserving audio backing track playback synchronized to the MIDI highway and transport clock.

## Tasks
- [x] Write AGENT_PLAN.md
- [x] Create `frontend/src/lib/useAudioPlayer.ts` — hook that manages an HTMLAudioElement locked to Transport
- [x] Modify `frontend/src/app/track/[id]/page.tsx` — add audioUrl state, call useAudioPlayer
- [x] Run `npx tsc --noEmit` and fix any type errors
- [ ] Open PR

## Decisions / blockers

**Pitch preservation**: Use `HTMLAudioElement.preservesPitch = true` (Chrome default). Chrome's native time-stretch algorithm preserves pitch when `playbackRate` changes. No third-party library needed — Chrome is the only supported browser (per CLAUDE.md).

**Sync mechanism**: Schedule audio start via `setTimeout` whose delay is derived from `transport.trackTimeToCtxTime(resumeAt)`. This converts the desired track-time start position to an AudioContext timestamp, then to a real-time delay. Once playing, a RAF-based drift correction loop keeps audio within 50ms of transport time.

**Rate changes during count-in**: The `useAudioPlayer` effect depends on `rate` so it re-runs when rate changes. If audio hasn't started yet (`audio.paused`), the old scheduled start is cancelled and a new one is computed with the updated rate. If audio is already playing, only `audio.playbackRate` is updated.

**autoplay policy**: Chrome allows `HTMLAudioElement.play()` after any user interaction on the origin. Since the user must click "Play" before audio starts, the `setTimeout`-deferred `audio.play()` will always be within a user-activated context.

**audioUrl source**: `LibraryEntry.audio_url` is already fetched by `getTrackById`. Added as separate state in the page (no changes to DrumTrack type needed).
