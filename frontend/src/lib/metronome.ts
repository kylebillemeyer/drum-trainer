/**
 * Metronome — a Web Audio lookahead beat scheduler.
 *
 * Domain concept
 * --------------
 * Produces an audible click on every beat of the track's time signature,
 * locked to the Transport clock.  Beat 1 of each bar (the downbeat) is
 * accented with a higher pitch and louder amplitude.
 *
 * The scheduler uses the "two clocks" pattern described by Chris Wilson
 * (https://web.dev/articles/audio-scheduling): a coarse setInterval fires
 * every ~25 ms and schedules Web Audio events slightly ahead of real time,
 * eliminating the jitter that requestAnimationFrame alone would produce.
 *
 * Beat alignment
 * --------------
 * Beats are derived from the Transport's track-time axis, so they stay in
 * lock-step with the note highway at any playback rate.  Beat 1 of bar 1
 * falls at track-time 0; count-in beats live at negative track times.
 *
 * The start() method looks back by START_GRACE_SECONDS before computing the
 * first upcoming beat.  This compensates for the ~16 ms React render delay
 * between transport.play() and the useMetronome effect firing, which would
 * otherwise cause beat 1 to be silently skipped.
 *
 * Usage
 * -----
 *   const m = new Metronome(transport, track.bpm, track.timeSignature);
 *
 *   // Call after transport.play() (from inside useMetronome):
 *   m.start();   // begins scheduling clicks from the current transport position
 *   m.stop();    // cancels the interval; already-queued audio events still fire
 *
 * Lifecycle
 * ---------
 * Create a new instance whenever BPM or time signature changes (managed by
 * useMetronome).  Do not reuse across tracks.
 */

import { Transport } from './transport';

// Clicks are scheduled this far ahead of AudioContext.currentTime.
// Large enough to survive a delayed setInterval tick; small enough that
// a tempo or seek change takes effect quickly.
const LOOKAHEAD_SECONDS    = 0.1;
const SCHEDULE_INTERVAL_MS = 25;

// How far back start() searches for the first beat.  Must exceed the
// worst-case React render delay so beat 1 is never silently skipped.
const START_GRACE_SECONDS = 0.1;

// Short oscillator burst: downbeat is higher-pitched and louder.
function scheduleClick(ctx: AudioContext, time: number, isDownbeat: boolean): void {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = isDownbeat ? 1200 : 800;
  gain.gain.setValueAtTime(isDownbeat ? 0.5 : 0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

  osc.start(time);
  osc.stop(time + 0.04);
}

export class Metronome {
  private transport:   Transport;
  private bpm:         number;
  private beatsPerBar: number;

  private intervalId:       ReturnType<typeof setInterval> | null = null;
  private nextBeatTrackTime = 0;
  private nextBeatIndex     = 0;  // 0 = downbeat

  constructor(transport: Transport, bpm: number, timeSignature: [number, number]) {
    this.transport   = transport;
    this.bpm         = bpm;
    this.beatsPerBar = timeSignature[0];
  }

  private beatDuration(): number {
    return 60 / this.bpm;
  }

  private schedule(): void {
    const ctx            = this.transport.audioContext;
    const lookaheadUntil = ctx.currentTime + LOOKAHEAD_SECONDS;

    while (true) {
      const clickCtxTime = this.transport.trackTimeToCtxTime(this.nextBeatTrackTime);
      if (clickCtxTime > lookaheadUntil) break;

      // Schedule beats within START_GRACE_SECONDS of now so that a beat
      // that technically fired before this interval tick isn't silently
      // dropped.  Math.max clamps to currentTime — Web Audio rejects past
      // timestamps.
      if (clickCtxTime >= ctx.currentTime - START_GRACE_SECONDS) {
        scheduleClick(ctx, Math.max(clickCtxTime, ctx.currentTime), this.nextBeatIndex === 0);
      }

      this.nextBeatTrackTime += this.beatDuration();
      this.nextBeatIndex      = (this.nextBeatIndex + 1) % this.beatsPerBar;
    }
  }

  start(): void {
    if (this.intervalId !== null) return;

    const cur     = this.transport.getTime();
    const beatDur = this.beatDuration();

    // Look back by START_GRACE_SECONDS before ceiling so a beat that fired
    // just before this call (React render delay) is still included.
    // Positive modulo ensures correct downbeat index for negative beat numbers.
    const nextBeatNumber   = Math.ceil((cur - START_GRACE_SECONDS) / beatDur - 1e-9);
    this.nextBeatTrackTime = nextBeatNumber * beatDur;
    this.nextBeatIndex     = ((nextBeatNumber % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar;

    this.intervalId = setInterval(() => this.schedule(), SCHEDULE_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
