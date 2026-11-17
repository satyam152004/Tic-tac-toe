// Generates the small UI/game sound effects as 16-bit mono WAV files (no third-party audio assets needed).
// Run once: node scripts/generate-sounds.mjs  (output is committed under src/assets/sounds)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'sounds');
mkdirSync(out, { recursive: true });

/** notes: [freqHz, durationMs, gain] played in sequence with a soft attack/decay envelope. */
function synth(notes, wave = 'sine') {
  const samples = [];
  for (const [freq, ms, gain = 0.5] of notes) {
    const n = Math.floor((RATE * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const env = Math.min(1, i / (RATE * 0.005)) * Math.pow(1 - i / n, 1.6);
      const ph = 2 * Math.PI * freq * t;
      const v = wave === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(ph)) : Math.sin(ph);
      samples.push(v * env * gain);
    }
  }
  return samples;
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const sounds = {
  tap: synth([[880, 45, 0.35]], 'triangle'),
  place_x: synth([[660, 90, 0.5]], 'triangle'),
  place_o: synth([[520, 90, 0.5]], 'triangle'),
  win: synth([[523, 110], [659, 110], [784, 110], [1047, 260]]),
  lose: synth([[392, 150], [330, 150], [262, 320]]),
  draw: synth([[440, 140, 0.4], [440, 200, 0.4]]),
  error: synth([[200, 160, 0.5]], 'triangle'),
};

for (const [name, s] of Object.entries(sounds)) writeFileSync(join(out, `${name}.wav`), wav(s));
console.log('sounds written to', out);
