export type LaneId =
  | 'kick'
  | 'snare'
  | 'hihat'
  | 'tom1'
  | 'tom2'
  | 'tom3'
  | 'crash1'
  | 'crash2'
  | 'ride';

export type NoteZone = 'center' | 'rim' | 'bow' | 'bell' | 'edge' | 'foot';

export interface DrumNote {
  id: string;
  time: number;       // seconds from track start
  lane: LaneId;
  velocity: number;   // 0–127
  zone: NoteZone;
}

export interface DrumTrack {
  title: string;
  bpm: number;
  timeSignature: [number, number];
  notes: DrumNote[];
  durationSeconds: number;
}
