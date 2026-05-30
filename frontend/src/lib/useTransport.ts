'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Transport } from './transport';

export interface TransportControls {
  playing: boolean;
  rate: number;
  getCurrentTime: () => number;
  play: () => Promise<void>;
  pause: () => void;
  setRate: (r: number) => void;
  seek: (t: number) => void;
  transport: Transport;
}

export function useTransport(): TransportControls {
  const transportRef = useRef<Transport | null>(null);
  const [playing, setPlaying] = useState(false);
  const [rate, setRateState] = useState(1);

  // Create transport once, survive StrictMode double-invoke
  if (!transportRef.current) {
    transportRef.current = new Transport();
  }

  useEffect(() => {
    const t = transportRef.current!;
    return () => {
      t.dispose();
      transportRef.current = null;
    };
  }, []);

  const play = useCallback(async () => {
    await transportRef.current!.play();
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    transportRef.current!.pause();
    setPlaying(false);
  }, []);

  const setRate = useCallback((r: number) => {
    transportRef.current!.setRate(r);
    setRateState(r);
  }, []);

  const seek = useCallback((t: number) => {
    transportRef.current!.seek(t);
  }, []);

  // Stable reference — highways capture this once, no effect re-runs
  const getCurrentTime = useCallback(() => transportRef.current!.getTime(), []);

  return {
    playing,
    rate,
    getCurrentTime,
    play,
    pause,
    setRate,
    seek,
    transport: transportRef.current!,
  };
}
