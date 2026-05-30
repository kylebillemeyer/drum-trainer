/**
 * Transport — the single source of truth for playback position.
 *
 * Domain concept
 * --------------
 * The app has two independent time axes:
 *
 *   • Track time  — seconds from the start of a DrumTrack (t = 0 is bar 1,
 *                   beat 1). Negative values are used during the count-in
 *                   bar that precedes the track.  This is the coordinate
 *                   system that DrumNote.time lives in.
 *
 *   • AudioContext time — the monotonically-increasing clock maintained by
 *                   the Web Audio API (ctx.currentTime).  This is what the
 *                   Metronome scheduler uses to stamp future audio events.
 *
 * Transport owns the mapping between the two.  While playing:
 *
 *   trackTime = trackAnchor + (ctx.currentTime − ctxAnchor) × rate
 *
 * Pausing freezes trackAnchor at the current position; seek() and setRate()
 * re-anchor both sides so the curve stays continuous.
 *
 * Usage
 * -----
 * Create one instance per session (managed by useTransport).  Never share
 * an instance across sessions — dispose() and recreate.
 *
 *   const t = new Transport();
 *
 *   // Must be called from a user-gesture handler (browser autoplay policy).
 *   await t.play();
 *
 *   // Read current position each animation frame:
 *   const ct = t.getTime();
 *
 *   // Schedule a Web Audio event to fire at a specific track time:
 *   const when = t.trackTimeToCtxTime(noteTime);
 *   oscillator.start(when);
 *
 *   t.pause();
 *   t.seek(30);        // jump to 30 s
 *   t.setRate(0.75);   // slow to 75 %
 *   t.dispose();       // closes the AudioContext when done
 */
export class Transport {
  private ctx: AudioContext | null = null;

  private trackAnchor = 0;  // track-time position at the last anchor point
  private ctxAnchor   = 0;  // ctx.currentTime at the last anchor point
  private rate        = 1;
  private playing     = false;

  // AudioContext created lazily on first play() — safe during SSR construction
  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  /** The underlying AudioContext — use only for scheduling Web Audio nodes. */
  get audioContext(): AudioContext {
    return this.getCtx();
  }

  /** Current track-time position in seconds. Safe to call every animation frame. */
  getTime(): number {
    if (!this.playing) return this.trackAnchor;
    return this.trackAnchor + (this.getCtx().currentTime - this.ctxAnchor) * this.rate;
  }

  /**
   * Convert a track-time position to the AudioContext timestamp at which it
   * will occur.  Use this to schedule Web Audio events (e.g. metronome clicks)
   * so they stay locked to the highway position.
   */
  trackTimeToCtxTime(trackTime: number): number {
    const ctx = this.getCtx();
    if (!this.playing) return ctx.currentTime;
    return this.ctxAnchor + (trackTime - this.trackAnchor) / this.rate;
  }

  isPlaying(): boolean { return this.playing; }
  getRate():   number  { return this.rate; }

  /**
   * Start playback.  Must be called inside a user-gesture handler so the
   * browser allows AudioContext.resume().
   */
  async play(): Promise<void> {
    if (this.playing) return;
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    this.ctxAnchor = ctx.currentTime;
    this.playing   = true;
  }

  /** Freeze the playhead at the current position. */
  pause(): void {
    if (!this.playing) return;
    this.trackAnchor = this.getTime();
    this.playing     = false;
  }

  /** Jump to a track-time position (may be negative during count-in). */
  seek(trackTime: number): void {
    this.trackAnchor = trackTime;
    if (this.playing) this.ctxAnchor = this.getCtx().currentTime;
  }

  /**
   * Change playback rate without a position discontinuity.
   * Both anchors are re-stamped so getTime() returns the same value
   * immediately before and after the call.
   */
  setRate(r: number): void {
    this.trackAnchor = this.getTime();
    if (this.playing) this.ctxAnchor = this.getCtx().currentTime;
    this.rate = r;
  }

  /** Close the AudioContext.  Call when the owning hook unmounts. */
  dispose(): void {
    this.ctx?.close();
  }
}
