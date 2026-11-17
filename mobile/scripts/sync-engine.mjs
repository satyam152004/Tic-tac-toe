// Copies the backend's pure-TS game engine into the app and strips ".js" import suffixes (Metro resolves extensionless).
// Run: npm run sync:engine   (the parity test fails if the copy drifts from the backend).
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, '..', 'backend', 'src', 'game-engine');
const to = join(root, 'src', 'game-engine');
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from).filter((n) => n.endsWith('.ts'))) {
  const src = readFileSync(join(from, f), 'utf8').replace(/(from\s+'\.\/[\w-]+)\.js'/g, "$1'");
  writeFileSync(join(to, f), src);
}
console.log('engine synced');
