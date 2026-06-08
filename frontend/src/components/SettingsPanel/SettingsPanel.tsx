'use client';

import { useSettings } from '@/lib/SettingsContext';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Button } from '@/components/ui/button';

const TEMPO_MIN  = 0.30;
const TEMPO_MAX  = 2.00;
const TEMPO_STEP = 0.05;

interface Props {
  rate: number;
  setRate: (r: number) => void;
}

export default function SettingsPanel({ rate, setRate }: Props) {
  const { view, setView, showLabels, setShowLabels, metronome, setMetronome, countInBars, setCountInBars, preDelaySecs, setPreDelaySecs } = useSettings();

  return (
    <div className="px-4 py-3 flex flex-col gap-3">

      {/* View mode */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-300">View</span>
        <ToggleGroup
          value={[view]}
          onValueChange={(vals: string[]) => {
            const next = vals[0];
            if (next) setView(next as 'flat' | '3d');
          }}
          spacing={0}
          variant="outline"
          size="sm"
          className="font-mono text-xs"
        >
          <ToggleGroupItem
            value="flat"
            className="aria-pressed:bg-neutral-700 aria-pressed:text-white"
          >
            Flat
          </ToggleGroupItem>
          <ToggleGroupItem
            value="3d"
            className="aria-pressed:bg-neutral-700 aria-pressed:text-white"
          >
            3D
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Lane labels */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-300">Lane labels</span>
        <Switch
          checked={showLabels}
          onCheckedChange={(checked) => setShowLabels(checked)}
        />
      </div>

      {/* Metronome */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-300">Metronome</span>
        <Switch
          checked={metronome}
          onCheckedChange={(checked) => setMetronome(checked)}
        />
      </div>

      {/* Tempo */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-neutral-300">Tempo</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setRate(Math.max(TEMPO_MIN, parseFloat((rate - TEMPO_STEP).toFixed(2))))}
            disabled={rate <= TEMPO_MIN}
          >
            −
          </Button>
          <span className="text-xs font-mono text-neutral-300 w-10 text-center">
            {Math.round(rate * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setRate(Math.min(TEMPO_MAX, parseFloat((rate + TEMPO_STEP).toFixed(2))))}
            disabled={rate >= TEMPO_MAX}
          >
            +
          </Button>
        </div>
      </div>

      {/* Count-in bars */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-neutral-300">Count-in</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCountInBars(b => Math.max(1, b - 1))}
            disabled={countInBars <= 1}
          >
            −
          </Button>
          <span className="text-xs font-mono text-neutral-300 w-10 text-center">
            {countInBars} {countInBars === 1 ? 'bar' : 'bars'}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setCountInBars(b => Math.min(4, b + 1))}
            disabled={countInBars >= 4}
          >
            +
          </Button>
        </div>
      </div>

      {/* Pre-delay */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-neutral-300">Pre-delay</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPreDelaySecs(s => Math.max(0, s - 1))}
            disabled={preDelaySecs <= 0}
          >
            −
          </Button>
          <span className="text-xs font-mono text-neutral-300 w-10 text-center">
            {preDelaySecs}s
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPreDelaySecs(s => Math.min(3, s + 1))}
            disabled={preDelaySecs >= 3}
          >
            +
          </Button>
        </div>
      </div>

    </div>
  );
}
