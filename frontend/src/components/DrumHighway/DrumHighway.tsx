'use client';

import { useEffect, useRef } from 'react';
import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { DrumTrack } from '@/types/music';
import { LANES, LANE_INDEX } from '@/lib/lanes';

interface Props {
  track: DrumTrack;
  getCurrentTime: () => number;
  playedUpTo: number;
  lookaheadSeconds?: number;
}

const HIT_ZONE_RATIO = 0.18;
const LANE_GAP = 1;
const MAX_GEMS = 128;

export default function DrumHighway({
  track,
  getCurrentTime,
  playedUpTo,
  lookaheadSeconds = 3,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const appRef        = useRef<Application | null>(null);
  const getCurrentTimeRef = useRef(getCurrentTime);
  const playedUpToRef = useRef(playedUpTo);

  useEffect(() => {
    getCurrentTimeRef.current = getCurrentTime;
  }, [getCurrentTime]);

  useEffect(() => {
    playedUpToRef.current = playedUpTo;
  }, [playedUpTo]);

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

      // Lane backgrounds — one Graphics per lane, created once
      const laneBgs: Graphics[] = LANES.map(() => {
        const g = new Graphics();
        app.stage.addChild(g);
        return g;
      });

      // Lane labels — one Text per lane, created once
      const laneLabels: Text[] = LANES.map((lane) => {
        const t = new Text({ text: lane.label, style: new TextStyle({ fill: 0x888888, fontFamily: 'monospace' }) });
        app.stage.addChild(t);
        return t;
      });

      // Hit zone — one Graphics, created once
      const hitZone = new Graphics();
      app.stage.addChild(hitZone);

      // Note gem pool — fixed set of Graphics, reused across frames
      const gemPool: Graphics[] = Array.from({ length: MAX_GEMS }, () => {
        const g = new Graphics();
        app.stage.addChild(g);
        return g;
      });

      app.ticker.add(() => {
        const W = app.screen.width;
        const H = app.screen.height;
        const laneH = (H - LANE_GAP * (LANES.length - 1)) / LANES.length;
        const hitX = W * HIT_ZONE_RATIO;
        const pps = (W - hitX) / lookaheadSeconds;
        const ct = getCurrentTimeRef.current();
        const playedUpTo = playedUpToRef.current;

        // Redraw lane backgrounds (cheap clear+fill, avoids object creation)
        LANES.forEach((lane, i) => {
          const y = i * (laneH + LANE_GAP);
          laneBgs[i].clear().rect(0, y, W, laneH).fill({ color: lane.bgColor });
          laneLabels[i].style.fontSize = Math.max(10, laneH * 0.35);
          laneLabels[i].x = 8;
          laneLabels[i].y = y + (laneH - laneLabels[i].height) / 2;
        });

        // Redraw hit zone
        hitZone.clear();
        for (let i = 20; i > 0; i--) {
          hitZone.rect(hitX - i * 2, 0, 2, H).fill({ color: 0xffffff, alpha: (1 - i / 20) * 0.04 });
        }
        hitZone.rect(hitX - 1, 0, 2, H).fill({ color: 0xffffff, alpha: 0.4 });

        // Update gem pool
        const visStart = ct - 0.1;
        const visEnd = ct + lookaheadSeconds + 0.1;
        let gemIdx = 0;
        for (const note of track.notes) {
          if (note.time < visStart) continue;
          if (note.time > visEnd) break;
          const laneIdx = LANE_INDEX[note.lane];
          if (laneIdx === undefined) continue;
          if (gemIdx >= MAX_GEMS) break;

          const lane = LANES[laneIdx];
          const x = hitX + (note.time - ct) * pps;
          const y = laneIdx * (laneH + LANE_GAP);
          const gemW = Math.max(8, laneH * 0.55);
          const gemH = laneH * 0.7;
          const isPast = note.time < playedUpTo;

          const g = gemPool[gemIdx++];
          g.visible = true;
          g.clear().roundRect(x - gemW / 2, y + (laneH - gemH) / 2, gemW, gemH, 4).fill({
            color: lane.color,
            alpha: isPast ? 0.15 : 0.6 + (note.velocity / 127) * 0.4,
          });
        }

        // Hide unused pool slots
        for (let i = gemIdx; i < MAX_GEMS; i++) {
          gemPool[i].visible = false;
        }
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: 400 }} />
  );
}
