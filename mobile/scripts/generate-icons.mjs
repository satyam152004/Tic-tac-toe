// Renders the app icon set from assets/tictactoe.png (the app logo). Run: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets');
const SRC = join(out, 'tictactoe.png');
const BG = '#0B0718';
const bgRGB = { r: 11, g: 7, b: 24, alpha: 1 };

// Logo trimmed of transparent margin, square.
const logo = await sharp(SRC).trim().toBuffer();
const sized = (n) => sharp(logo).resize(n, n, { fit: 'cover' }).png().toBuffer();
const flat = async (n) => sharp(await sized(n)).flatten({ background: bgRGB }).png().toBuffer();
/** Logo scaled to `scale` of the canvas, centred on transparent background (Android adaptive safe zone). */
const padded = async (n, scale) => {
  const inner = Math.round(n * scale);
  return sharp({ create: { width: n, height: n, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sized(inner), gravity: 'center' }]).png().toBuffer();
};
const mono = async (n) => {
  const inner = Math.round(n * 0.66);
  const { data, info } = await sharp(await sized(inner)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    data[i + 3] = lum > 70 ? Math.round(data[i + 3] * Math.min(1, (lum - 70) / 90)) : 0;
    data[i] = data[i + 1] = data[i + 2] = 255;
  }
  const g = await sharp(data, { raw: info }).png().toBuffer();
  return sharp({ create: { width: n, height: n, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: g, gravity: 'center' }]).png().toBuffer();
};
const solid = (n) => sharp({ create: { width: n, height: n, channels: 3, background: bgRGB } }).png().toBuffer();

const jobs = [
  ['icon.png', await flat(1024)],
  ['android-icon-foreground.png', await padded(1024, 0.66)],
  ['android-icon-background.png', await solid(1024)],
  ['android-icon-monochrome.png', await mono(1024)],
  ['splash-icon.png', await sized(512)],
  ['favicon.png', await flat(64)],
];
for (const [name, buf] of jobs) { await sharp(buf).toFile(join(out, name)); console.log('wrote', name); }

// Native Android launcher + splash resources (generated dir; keeps the built app in sync until next prebuild).
const res = join(root, 'android', 'app', 'src', 'main', 'res');
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const fs = await import('node:fs');
if (fs.existsSync(res)) {
  for (const [d, m] of Object.entries(dens)) {
    const dir = join(res, `mipmap-${d}`);
    if (!fs.existsSync(dir)) continue;
    const full = Math.round(108 * m);
    const icon = Math.round(48 * m);
    const w = (f, b) => sharp(b).webp({ quality: 95 }).toFile(join(dir, f));
    await w('ic_launcher_foreground.webp', await padded(full, 0.66));
    await w('ic_launcher_background.webp', await solid(full));
    await w('ic_launcher_monochrome.webp', await mono(full));
    await w('ic_launcher.webp', await flat(icon));
    // round launcher: circular crop of the logo
    const rb = await flat(icon);
    const mask = Buffer.from(`<svg width="${icon}" height="${icon}"><circle cx="${icon / 2}" cy="${icon / 2}" r="${icon / 2}"/></svg>`);
    await w('ic_launcher_round.webp', await sharp(rb).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer());
    const sd = join(res, `drawable-${d}`);
    if (fs.existsSync(join(sd, 'splashscreen_logo.png'))) await sharp(await padded(Math.round(288 * m), 0.66)).toFile(join(sd, 'splashscreen_logo.png'));
  }
  console.log('updated android res');
}
