'use client';

import { useEffect, useRef } from 'react';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { DrumTrack } from '@/types/music';
import { LANES, LANE_INDEX } from '@/lib/lanes';

interface Props {
  track: DrumTrack;
  playing: boolean;
  playbackRate?: number;
  lookaheadSeconds?: number;
}

// Highway geometry
const HORIZON_Y  = 0.30;  // horizon line (fraction of screen height from top)
const HIT_Y      = 0.86;  // hit zone (fraction of screen height from top)
const HWY_W_HIT  = 0.80;  // highway width at hit zone (fraction of screen width)

// Perspective constant D:  factor = D / (D + t/lookahead)
// Smaller D = stronger perspective (faster acceleration near viewer).
// D = 0.5 gives a ~3:1 speed ratio between hit zone and far end.
const PERSPECTIVE_D = 0.5;

// Depth of each note box along the track (seconds)
const NOTE_DEPTH_SEC = 0.07;
// Height of the front face of a box at the hit zone (pixels at scale=1)
const BOX_FACE_H = 24;

const N = LANES.length;

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function darken(hex: number, f: number): number {
  return (Math.round(((hex >> 16) & 0xff) * f) << 16)
       | (Math.round(((hex >>  8) & 0xff) * f) <<  8)
       |  Math.round((hex         & 0xff) * f);
}

/**
 * True perspective projection.
 * tSec = seconds until this point crosses the hit zone (0 = at hit zone, lookahead = far end).
 * Returns screen (x, y) and a scale factor (1 at hit zone, <1 further away).
 */
function project(normX: number, tSec: number, lookaheadSeconds: number, W: number, H: number) {
  const hitY   = H * HIT_Y;
  const horizY = H * HORIZON_Y;
  const wHit   = W * HWY_W_HIT;

  // 1/z perspective: factor → 1 at t=0, → 0 as t → ∞
  const factor = PERSPECTIVE_D / (PERSPECTIVE_D + Math.max(0, tSec) / lookaheadSeconds);

  return {
    x:     W / 2 + normX * wHit * factor,
    y:     horizY + (hitY - horizY) * factor,
    scale: factor,
  };
}

export default function DrumHighway3D({
  track,
  playing,
  playbackRate = 1,
  lookaheadSeconds = 3,
}: Props) {
  const containerRef     = useRef<HTMLDivElement>(null);
  const appRef           = useRef<Application | null>(null);
  const playingRef       = useRef(playing);
  const currentTimeRef   = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    playingRef.current = playing;
    if (!playing) lastTimestampRef.current = null;
  }, [playing]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let app: Application;
    let ro: ResizeObserver;
    let destroyed = false;

    async function init() {
      const { width, height } = container.getBoundingClientRect();
      app = new Application();
      await app.init({
        width:  width  || 800,
        height: height || 400,
        backgroundColor: 0x05050a,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (destroyed) { app.destroy(true); return; }

      app.canvas.style.display = 'block';
      app.canvas.style.width   = '100%';
      app.canvas.style.height  = '100%';
      container.appendChild(app.canvas);
      appRef.current = app;

      ro = new ResizeObserver(() => {
        const { width: w, height: h } = container.getBoundingClientRect();
        if (w > 0 && h > 0) app.renderer.resize(w, h);
      });
      ro.observe(container);

      app.ticker.add(() => {
        const now = performance.now();
        if (playingRef.current) {
          if (lastTimestampRef.current !== null) {
            currentTimeRef.current +=
              ((now - lastTimestampRef.current) / 1000) * playbackRate;
          }
          lastTimestampRef.current = now;
        }
        render(app, track, currentTimeRef.current, lookaheadSeconds);
      });
    }

    init();

    return () => {
      destroyed = true;
      ro?.disconnect();
      if (appRef.current) { appRef.current.destroy(true); appRef.current = null; }
      currentTimeRef.current   = 0;
      lastTimestampRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: 400 }} />
  );
}

function render(app: Application, track: DrumTrack, currentTime: number, lookaheadSeconds: number) {
  app.stage.removeChildren();

  const W = app.screen.width;
  const H = app.screen.height;
  const g = new Graphics();
  app.stage.addChild(g);

  const hitY   = H * HIT_Y;
  const horizY = H * HORIZON_Y;

  // Vanishing point — where all lanes converge (very large t → factor ≈ 0)
  const vp = { x: W / 2, y: horizY };

  // --- Sky ---
  g.rect(0, 0, W, horizY).fill({ color: 0x05050a });

  // --- Lane surfaces (triangle from vanishing point to hit-zone edge) ---
  for (let i = 0; i < N; i++) {
    const lN = -0.5 + i / N;
    const rN = -0.5 + (i + 1) / N;
    const bl = project(lN, 0, lookaheadSeconds, W, H);
    const br = project(rN, 0, lookaheadSeconds, W, H);
    const shade = i % 2 === 0 ? 0x0d0d18 : 0x0a0a14;
    g.poly([vp.x, vp.y, vp.x, vp.y, br.x, br.y, bl.x, bl.y]).fill({ color: shade });
  }

  // --- Lane dividers ---
  for (let i = 0; i <= N; i++) {
    const norm = -0.5 + i / N;
    const bot  = project(norm, 0, lookaheadSeconds, W, H);
    g.moveTo(vp.x, vp.y).lineTo(bot.x, bot.y)
     .stroke({ color: 0x2a2a40, width: 1, alpha: 0.8 });
  }

  // --- Horizon glow ---
  for (let i = 8; i >= 0; i--) {
    g.rect(0, horizY - i, W, 2).fill({ color: 0x6060ff, alpha: (1 - i / 8) * 0.12 });
  }

  // --- Hit zone bar + glow ---
  const hitL = project(-0.5, 0, lookaheadSeconds, W, H);
  const hitR = project( 0.5, 0, lookaheadSeconds, W, H);
  const barW = hitR.x - hitL.x;
  for (let i = 10; i >= 0; i--) {
    g.rect(hitL.x, hitY - i * 3, barW, 6).fill({ color: 0xffffff, alpha: (1 - i / 10) * 0.15 });
  }
  g.rect(hitL.x, hitY - 2, barW, 4).fill({ color: 0xffffff, alpha: 0.7 });

  // --- Footer below hit zone ---
  g.rect(0, hitY + 2, W, H - hitY - 2).fill({ color: 0x05050a });

  // --- Lane labels ---
  for (let i = 0; i < N; i++) {
    const pos   = project(-0.5 + (i + 0.5) / N, 0, lookaheadSeconds, W, H);
    const laneW = project(-0.5 + (i + 1) / N, 0, lookaheadSeconds, W, H).x
                - project(-0.5 + i / N,        0, lookaheadSeconds, W, H).x;
    const label = new Text({
      text: LANES[i].label,
      style: new TextStyle({ fill: 0x666680, fontSize: Math.min(13, laneW * 0.18), fontFamily: 'monospace' }),
    });
    label.anchor.set(0.5, 0);
    label.x = pos.x;
    label.y = hitY + 8;
    app.stage.addChild(label);
  }

  // --- Notes: 3D boxes lying on the track, drawn far-to-near ---
  const visible = track.notes
    .filter(n => {
      const t = n.time - currentTime;
      return t + NOTE_DEPTH_SEC >= 0 && t <= lookaheadSeconds;
    })
    .sort((a, b) => b.time - a.time); // painter's order: far first

  for (const note of visible) {
    const laneIdx = LANE_INDEX[note.lane];
    if (laneIdx === undefined) continue;

    const tFront = note.time - currentTime;
    const tBack  = tFront + NOTE_DEPTH_SEC;

    const lN = -0.5 + laneIdx / N;
    const rN = -0.5 + (laneIdx + 1) / N;

    // Four corners of the top face
    const fl = project(lN, tFront, lookaheadSeconds, W, H);
    const fr = project(rN, tFront, lookaheadSeconds, W, H);
    const bl = project(lN, tBack,  lookaheadSeconds, W, H);
    const br = project(rN, tBack,  lookaheadSeconds, W, H);

    const lane  = LANES[laneIdx];
    const alpha = 0.75 + (note.velocity / 127) * 0.25;
    // Depth fog: notes beyond the lookahead window fade out slightly
    const fog   = tFront > lookaheadSeconds * 0.85
      ? lerp(1, 0.4, (tFront - lookaheadSeconds * 0.85) / (lookaheadSeconds * 0.15))
      : 1;

    const inset = (fr.x - fl.x) * 0.05;

    // Top face
    g.poly([
      bl.x + inset, bl.y,
      br.x - inset, br.y,
      fr.x - inset, fr.y,
      fl.x + inset, fl.y,
    ]).fill({ color: lane.color, alpha: alpha * fog });

    // Highlight stripe along the length of the top face
    g.poly([
      lerp(bl.x + inset, br.x - inset, 0.15), bl.y,
      lerp(bl.x + inset, br.x - inset, 0.35), br.y,
      lerp(fl.x + inset, fr.x - inset, 0.35), fr.y,
      lerp(fl.x + inset, fr.x - inset, 0.15), fl.y,
    ]).fill({ color: 0xffffff, alpha: 0.18 * fog * fl.scale });

    // Front face (only when near edge is within the visible highway)
    if (tFront <= lookaheadSeconds && tFront >= -NOTE_DEPTH_SEC) {
      const faceH = BOX_FACE_H * fl.scale;
      g.poly([
        fl.x + inset, fl.y,
        fr.x - inset, fr.y,
        fr.x - inset, fr.y + faceH,
        fl.x + inset, fl.y + faceH,
      ]).fill({ color: darken(lane.color, 0.45), alpha: alpha * fog });

      g.moveTo(fl.x + inset, fl.y + faceH)
       .lineTo(fr.x - inset, fr.y + faceH)
       .stroke({ color: darken(lane.color, 0.25), width: 1, alpha: fog * 0.9 });
    }
  }
}
