import { DrumTrack } from '@/types/music';

// Basic rock beat at 100 BPM for 4 bars — used for highway development/testing
const BPM = 100;
const BEAT = 60 / BPM;
const EIGHTH = BEAT / 2;
const SIXTEENTH = BEAT / 4;

function note(id: string, time: number, lane: DrumTrack['notes'][0]['lane'], velocity = 100): DrumTrack['notes'][0] {
  return { id, time, lane, velocity, zone: 'center' };
}

const notes: DrumTrack['notes'] = [];
for (let bar = 0; bar < 4; bar++) {
  const o = bar * 4 * BEAT;
  // Kick on 1 and 3
  notes.push(note(`k-1-${bar}`, o + 0 * BEAT, 'kick', 110));
  notes.push(note(`k-3-${bar}`, o + 2 * BEAT, 'kick', 105));
  // Snare on 2 and 4
  notes.push(note(`s-2-${bar}`, o + 1 * BEAT, 'snare', 100));
  notes.push(note(`s-4-${bar}`, o + 3 * BEAT, 'snare', 100));
  // Hi-hat every eighth note
  for (let e = 0; e < 8; e++) {
    notes.push(note(`hh-${e}-${bar}`, o + e * EIGHTH, 'hihat', e % 2 === 0 ? 90 : 70));
  }
  // Crash on beat 1 of first bar
  if (bar === 0) {
    notes.push(note('crash-0', 0, 'crash1', 115));
  }
}

export const TEST_TRACK: DrumTrack = {
  title: 'Test Beat',
  bpm: BPM,
  timeSignature: [4, 4],
  notes: notes.sort((a, b) => a.time - b.time),
  durationSeconds: 4 * 4 * BEAT,
};
