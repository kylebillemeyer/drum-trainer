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

const HIT_ZONE_RATIO = 0.18;
const LANE_GAP = 1;

export default function DrumHighway({
  track,
  playing,
  playbackRate = 1,
  lookaheadSeconds = 3,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const playingRef = useRef(playing);
  const currentTimeRef = useRef(0);
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
        width: width || 800,
        height: height || 400,
        backgroundColor: 0x111111,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      app.canvas.style.display = 'block';
      app.canvas.style.width = '100%';
      app.canvas.style.height = '100%';
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
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      currentTimeRef.current = 0;
      lastTimestampRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: 400 }} />
  );
}

function render(
  app: Application,
  track: DrumTrack,
  currentTime: number,
  lookaheadSeconds: number,
) {
  app.stage.removeChildren();

  const W = app.screen.width;
  const H = app.screen.height;
  const laneH = (H - LANE_GAP * (LANES.length - 1)) / LANES.length;
  const hitX = W * HIT_ZONE_RATIO;
  const pixelsPerSecond = (W - hitX) / lookaheadSeconds;

  const g = new Graphics();
  app.stage.addChild(g);

  LANES.forEach((lane, i) => {
    const y = i * (laneH + LANE_GAP);
    g.rect(0, y, W, laneH).fill({ color: lane.bgColor });

    const label = new Text({
      text: lane.label,
      style: new TextStyle({
        fill: 0x888888,
        fontSize: Math.max(10, laneH * 0.35),
        fontFamily: 'monospace',
      }),
    });
    label.x = 8;
    label.y = y + (laneH - label.height) / 2;
    app.stage.addChild(label);
  });

  // Hit zone line + glow
  for (let i = 20; i > 0; i--) {
    g.rect(hitX - i * 2, 0, 2, H).fill({ color: 0xffffff, alpha: (1 - i / 20) * 0.04 });
  }
  g.rect(hitX - 1, 0, 2, H).fill({ color: 0xffffff, alpha: 0.4 });

  // Note gems
  const visibleStart = currentTime - 0.1;
  const visibleEnd = currentTime + lookaheadSeconds + 0.1;

  for (const note of track.notes) {
    if (note.time < visibleStart || note.time > visibleEnd) continue;
    const laneIdx = LANE_INDEX[note.lane];
    if (laneIdx === undefined) continue;

    const lane = LANES[laneIdx];
    const x = hitX + (note.time - currentTime) * pixelsPerSecond;
    const y = laneIdx * (laneH + LANE_GAP);
    const gemW = Math.max(8, laneH * 0.55);
    const gemH = laneH * 0.7;

    g.roundRect(x - gemW / 2, y + (laneH - gemH) / 2, gemW, gemH, 4).fill({
      color: lane.color,
      alpha: 0.6 + (note.velocity / 127) * 0.4,
    });
  }
}
