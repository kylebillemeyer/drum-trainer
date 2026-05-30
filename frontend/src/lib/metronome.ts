import { Transport } from './transport';

const LOOKAHEAD_SECONDS = 0.1;
const SCHEDULE_INTERVAL_MS = 25;
// How far back start() looks for a beat that just fired before the effect ran.
// Must exceed the worst-case React render delay (~16ms on a slow frame).
const START_GRACE_SECONDS = 0.1;

// Oscillator-based click: downbeat is accented (higher pitch, louder)
function scheduleClick(ctx: AudioContext, time: number, isDownbeat: boolean): void {
  const osc = ctx.createOscillator();
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
  private transport: Transport;
  private bpm: number;
  private beatsPerBar: number;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private nextBeatTrackTime = 0;
  private nextBeatIndex = 0;   // 0 = downbeat

  constructor(transport: Transport, bpm: number, timeSignature: [number, number]) {
    this.transport = transport;
    this.bpm = bpm;
    this.beatsPerBar = timeSignature[0];
  }

  private beatDuration(): number {
    return 60 / this.bpm;
  }

  private schedule(): void {
    const ctx = this.transport.audioContext;
    const lookaheadUntil = ctx.currentTime + LOOKAHEAD_SECONDS;

    while (true) {
      const clickCtxTime = this.transport.trackTimeToCtxTime(this.nextBeatTrackTime);
      if (clickCtxTime > lookaheadUntil) break;

      // Allow beats within START_GRACE_SECONDS of now — covers the case where start() was called
      // a render cycle after the beat fired. Math.max prevents sending a past timestamp to Web Audio.
      if (clickCtxTime >= ctx.currentTime - START_GRACE_SECONDS) {
        scheduleClick(ctx, Math.max(clickCtxTime, ctx.currentTime), this.nextBeatIndex === 0);
      }

      this.nextBeatTrackTime += this.beatDuration();
      this.nextBeatIndex = (this.nextBeatIndex + 1) % this.beatsPerBar;
    }
  }

  start(): void {
    if (this.intervalId !== null) return;

    const cur = this.transport.getTime();
    const beatDur = this.beatDuration();
    // Look back by START_GRACE_SECONDS so a beat that fired just before this effect ran
    // (due to React render delay) is still caught by the first schedule() call.
    const nextBeatNumber = Math.ceil((cur - START_GRACE_SECONDS) / beatDur - 1e-9);
    this.nextBeatTrackTime = nextBeatNumber * beatDur;
    this.nextBeatIndex = ((nextBeatNumber % this.beatsPerBar) + this.beatsPerBar) % this.beatsPerBar;

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
