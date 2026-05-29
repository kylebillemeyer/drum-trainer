import { Midi } from '@tonejs/midi';
import { DrumTrack, DrumNote, LaneId, NoteZone } from '@/types/music';

// General MIDI percussion map (channel 10): note number → [lane, zone]
const GM_MAP: Record<number, [LaneId, NoteZone]> = {
  35: ['kick',   'center'], // Acoustic Bass Drum
  36: ['kick',   'center'], // Bass Drum 1
  37: ['snare',  'rim'],    // Side Stick
  38: ['snare',  'center'], // Acoustic Snare
  39: ['snare',  'rim'],    // Hand Clap
  40: ['snare',  'center'], // Electric Snare
  41: ['tom3',   'center'], // Low Floor Tom
  42: ['hihat',  'center'], // Closed Hi-Hat
  43: ['tom3',   'center'], // High Floor Tom
  44: ['hihat',  'foot'],   // Pedal Hi-Hat
  45: ['tom2',   'center'], // Low Tom
  46: ['hihat',  'edge'],   // Open Hi-Hat
  47: ['tom2',   'center'], // Low-Mid Tom
  48: ['tom1',   'center'], // High-Mid Tom
  49: ['crash1', 'edge'],   // Crash Cymbal 1
  50: ['tom1',   'center'], // High Tom
  51: ['ride',   'bow'],    // Ride Cymbal 1
  52: ['crash2', 'edge'],   // Chinese Cymbal
  53: ['ride',   'bell'],   // Ride Bell
  55: ['crash1', 'edge'],   // Splash Cymbal
  57: ['crash2', 'edge'],   // Crash Cymbal 2
  59: ['ride',   'bow'],    // Ride Cymbal 2
};

export function parseMidi(buffer: ArrayBuffer): DrumTrack {
  const midi = new Midi(buffer);

  // Find the drum track: channel 10 (index 9), or fall back to first track with GM percussion notes
  const drumTrack =
    midi.tracks.find(t => t.notes.some(n => n.midi in GM_MAP)) ??
    midi.tracks[0];

  const notes: DrumNote[] = [];
  let noteIdx = 0;

  for (const n of drumTrack.notes) {
    const mapping = GM_MAP[n.midi];
    if (!mapping) continue;
    const [lane, zone] = mapping;
    notes.push({
      id:       `n-${noteIdx++}`,
      time:     n.time,
      lane,
      velocity: Math.round(n.velocity * 127),
      zone,
    });
  }

  notes.sort((a, b) => a.time - b.time);

  const bpm = midi.header.tempos.length > 0 ? Math.round(midi.header.tempos[0].bpm) : 120;
  const ts  = midi.header.timeSignatures[0];
  const timeSignature: [number, number] = ts ? [ts.timeSignature[0], ts.timeSignature[1]] : [4, 4];
  const durationSeconds = notes.length > 0 ? notes[notes.length - 1].time + 0.5 : 0;

  return {
    title: midi.name || 'Imported Track',
    bpm,
    timeSignature,
    notes,
    durationSeconds,
  };
}
