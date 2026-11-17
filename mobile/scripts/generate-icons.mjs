// Renders the app icon set from SVG (X/O insignia in the prototype palette). Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const BG = '#0B0718';
const X = '#38BDF8';
const O = '#F472B6';
const ACCENT = '#8B5CF6';

/** Glyph block drawn in a 1024 box; `scale` shrinks it for the Android adaptive safe zone. */
const glyphs = (scale = 1, mono = false) => {
  const s = 1024;
  const off = (s - s * scale) / 2;
  const cx = mono ? '#FFFFFF' : X;
  const co = mono ? '#FFFFFF' : O;
  return `<g transform="translate(${off} ${off}) scale(${scale})">
    <path d="M250 250 L450 450 M450 250 L250 450" stroke="${cx}" stroke-width="64" stroke-linecap="round" fill="none"/>
    <circle cx="700" cy="700" r="105" stroke="${co}" stroke-width="64" fill="none"/>
    <path d="M250 700 L450 700 M700 250 L700 450" stroke="${mono ? '#FFFFFF' : ACCENT}" stroke-width="40" stroke-linecap="round" fill="none" opacity="${mono ? 0.55 : 0.9}"/>
  </g>`;
};

const svg = (inner, bg = BG) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${inner}</svg>`);

const jobs = [
  ['icon.png', svg(glyphs(1)), 1024],
  ['android-icon-foreground.png', svg(glyphs(0.66), null), 1024],
  ['android-icon-background.png', svg('', BG), 1024],
  ['android-icon-monochrome.png', svg(glyphs(0.66, true), null), 1024],
  ['splash-icon.png', svg(glyphs(1), null), 512],
  ['favicon.png', svg(glyphs(1)), 64],
];

for (const [name, buf, size] of jobs) {
  await sharp(buf).resize(size, size).png().toFile(join(out, name));
  console.log('wrote', name);
}
