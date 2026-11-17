import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The app's offline engine is a COPY of the backend's engine (src/game-engine), because the server replays offline matches
 * with the original. This test fails when the copy drifts: fix it with `npm run sync:engine`.
 */
const mobileDir = join(__dirname, '..', '..', 'src', 'game-engine');
const backendDir = join(__dirname, '..', '..', '..', 'backend', 'src', 'game-engine');
const strip = (s: string) => s.replace(/(from\s+'\.\/[\w-]+)\.js'/g, "$1'");

describe('offline engine parity with the backend engine', () => {
  const files = readdirSync(backendDir).filter((f) => f.endsWith('.ts'));

  it('has every backend engine file', () => {
    expect(readdirSync(mobileDir).filter((f) => f.endsWith('.ts')).sort()).toEqual(files.sort());
  });

  it.each(files)('%s is identical to the backend (modulo import suffix)', (file) => {
    const mobile = readFileSync(join(mobileDir, file), 'utf8');
    const backend = strip(readFileSync(join(backendDir, file), 'utf8'));
    expect(mobile).toBe(backend);
  });
});
