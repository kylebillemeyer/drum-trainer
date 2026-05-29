import { LaneId } from '@/types/music';

export interface LaneConfig {
  id: LaneId;
  label: string;
  color: number;       // PixiJS hex color for note gems
  bgColor: number;     // lane background tint
}

// Top-to-bottom order mirrors the kit layout: cymbals at top, kick at bottom
export const LANES: LaneConfig[] = [
  { id: 'crash2',  label: 'Crash L', color: 0xe74c3c, bgColor: 0x1a1218 },
  { id: 'crash1',  label: 'Crash R', color: 0xe74c3c, bgColor: 0x1a1218 },
  { id: 'ride',    label: 'Ride',    color: 0xf39c12, bgColor: 0x1a1a12 },
  { id: 'hihat',   label: 'Hi-Hat',  color: 0x2ecc71, bgColor: 0x121a14 },
  { id: 'tom1',    label: 'Tom 1',   color: 0x3498db, bgColor: 0x121418 },
  { id: 'tom2',    label: 'Tom 2',   color: 0x3498db, bgColor: 0x121418 },
  { id: 'tom3',    label: 'Tom 3',   color: 0x3498db, bgColor: 0x121418 },
  { id: 'snare',   label: 'Snare',   color: 0x9b59b6, bgColor: 0x161218 },
  { id: 'kick',    label: 'Kick',    color: 0xe67e22, bgColor: 0x1a1412 },
];

export const LANE_INDEX: Record<LaneId, number> = Object.fromEntries(
  LANES.map((l, i) => [l.id, i])
) as Record<LaneId, number>;
