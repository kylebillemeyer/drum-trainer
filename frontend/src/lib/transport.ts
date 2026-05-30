export class Transport {
  private ctx: AudioContext | null = null;

  private trackAnchor = 0;
  private ctxAnchor = 0;
  private rate = 1;
  private playing = false;

  // AudioContext created lazily on first play() — safe during SSR construction
  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  get audioContext(): AudioContext {
    return this.getCtx();
  }

  getTime(): number {
    if (!this.playing) return this.trackAnchor;
    return this.trackAnchor + (this.getCtx().currentTime - this.ctxAnchor) * this.rate;
  }

  trackTimeToCtxTime(trackTime: number): number {
    const ctx = this.getCtx();
    if (!this.playing) return ctx.currentTime;
    return this.ctxAnchor + (trackTime - this.trackAnchor) / this.rate;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getRate(): number {
    return this.rate;
  }

  async play(): Promise<void> {
    if (this.playing) return;
    const ctx = this.getCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    this.ctxAnchor = ctx.currentTime;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.trackAnchor = this.getTime();
    this.playing = false;
  }

  seek(trackTime: number): void {
    this.trackAnchor = trackTime;
    if (this.playing) this.ctxAnchor = this.getCtx().currentTime;
  }

  setRate(r: number): void {
    this.trackAnchor = this.getTime();
    if (this.playing) this.ctxAnchor = this.getCtx().currentTime;
    this.rate = r;
  }

  dispose(): void {
    this.ctx?.close();
  }
}
