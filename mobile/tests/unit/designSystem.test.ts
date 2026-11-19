import * as fs from 'fs';
import * as path from 'path';
import { THEME_COLORS, THEME_IDS, ThemeColors, withAlpha } from '../../src/design-system/colors';
import { FONT_ASSETS, fonts } from '../../src/design-system/fonts';
import { iconSize } from '../../src/design-system/icons';
import { type } from '../../src/design-system/typography';

const ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(ROOT, 'src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}
const files = walk(SRC);
const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, '/');
const read = (f: string) => fs.readFileSync(f, 'utf8');

// --- WCAG contrast -----------------------------------------------------------------------------------------
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [16, 8, 0].map((s) => ((n >> s) & 255) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('fonts', () => {
  const families = Object.values(fonts).flatMap((g) => Object.values(g)) as string[];

  it('every font family a token can name is loaded by the app (FONT_ASSETS feeds useFonts)', () => {
    for (const f of families) {
      expect(Object.keys(FONT_ASSETS)).toContain(f);
      expect((FONT_ASSETS as Record<string, unknown>)[f]).toBeTruthy();
    }
    // and nothing is loaded that no token can reach
    expect(Object.keys(FONT_ASSETS).sort()).toEqual([...families].sort());
  });

  it('uses only Plus Jakarta Sans for text and JetBrains Mono for numbers', () => {
    expect(Object.values(fonts.body).every((f) => f.startsWith('PlusJakartaSans_'))).toBe(true);
    expect(Object.values(fonts.mono).every((f) => f.startsWith('JetBrainsMono_'))).toBe(true);
    expect(Object.keys(fonts).sort()).toEqual(['body', 'mono']);
  });

  it('has no bold / extra-bold weights', () => {
    expect(families.filter((f) => /_\d+(Bold|ExtraBold|Black|Heavy)$/.test(f))).toEqual([]);
  });

  it('Outfit is gone: no source reference and no dependency', () => {
    const hits = files.filter((f) => /outfit/i.test(read(f))).map(rel);
    expect(hits).toEqual([]);
    const pkg = JSON.parse(read(path.join(ROOT, 'package.json')));
    expect(Object.keys(pkg.dependencies).filter((d) => /outfit/i.test(d))).toEqual([]);
  });

  it('screens never hardcode a font family name, fontWeight, or a bold token (only the type scale / fonts tokens)', () => {
    const offenders: string[] = [];
    for (const f of files) {
      if (rel(f) === 'src/design-system/fonts.ts') continue;
      const s = read(f);
      if (/['"`](PlusJakartaSans|JetBrainsMono|Outfit)_\w+['"`]/.test(s)) offenders.push(`${rel(f)}: literal font name`);
      if (/fontWeight\s*:/.test(s)) offenders.push(`${rel(f)}: fontWeight`);
      if (/fonts\.\w+\.(bold|extrabold)/.test(s)) offenders.push(`${rel(f)}: bold token`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('type scale', () => {
  const variants = Object.entries(type);

  it('only uses tokenised font families', () => {
    const families = Object.values(fonts).flatMap((g) => Object.values(g)) as string[];
    for (const [name, style] of variants) expect({ name, ok: families.includes(style.fontFamily as string) }).toEqual({ name, ok: true });
  });

  it('line height leaves room for the glyphs (>= 1.2x) so text never clips', () => {
    for (const [name, style] of variants) {
      expect({ name, ratio: (style.lineHeight as number) / (style.fontSize as number) >= 1.2 }).toEqual({ name, ratio: true });
    }
  });

  it('numeric variants are monospaced, everything else is Plus Jakarta Sans', () => {
    for (const [name, style] of variants) {
      const mono = /^(num|numLarge|numHero|code)$/.test(name);
      expect({ name, mono: (style.fontFamily as string).startsWith('JetBrainsMono_') }).toEqual({ name, mono });
    }
  });

  it('sizes step down monotonically from title to caption', () => {
    const order = ['title', 'headline', 'heading', 'subheading', 'body', 'small', 'caption'] as const;
    const sizes = order.map((k) => type[k].fontSize as number);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });
});

describe('theme tokens', () => {
  const keys: (keyof ThemeColors)[] = ['bgPrimary', 'bgSecondary', 'bgCard', 'bgElevated', 'accent', 'accentSecondary', 'accentFill', 'x', 'o', 'success', 'warning', 'danger', 'text', 'textSecondary', 'border', 'onAccent', 'onWarning', 'dangerText', 'dangerSoft', 'dangerBorder', 'scrim'];

  it.each(THEME_IDS)('%s defines every token', (id) => {
    for (const k of keys) expect({ k, v: typeof THEME_COLORS[id][k] }).toEqual({ k, v: 'string' });
    expect(Object.keys(THEME_COLORS[id]).sort()).toEqual([...keys].sort());
  });

  it.each(THEME_IDS)('%s: body text, secondary text and button labels are readable (WCAG AA)', (id) => {
    const c = THEME_COLORS[id];
    expect(contrast(c.text, c.bgPrimary)).toBeGreaterThanOrEqual(7);
    expect(contrast(c.text, c.bgCard)).toBeGreaterThanOrEqual(7);
    expect(contrast(c.textSecondary, c.bgPrimary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.textSecondary, c.bgCard)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onAccent, c.accentFill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.dangerText, c.bgPrimary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.dangerText, c.bgCard)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c.onWarning, c.warning)).toBeGreaterThanOrEqual(7);
  });

  it.each(THEME_IDS)('%s: icons and the X / O marks are distinguishable from the card (>= 3:1)', (id) => {
    const c = THEME_COLORS[id];
    for (const k of ['accent', 'x', 'o'] as const) expect(contrast(c[k], c.bgCard)).toBeGreaterThanOrEqual(3);
  });
});

describe('withAlpha / icon sizes', () => {
  it('converts 6 and 3 digit hex to rgba and clamps alpha', () => {
    expect(withAlpha('#8B5CF6', 0.2)).toBe('rgba(139,92,246,0.2)');
    expect(withAlpha('#fff', 0.5)).toBe('rgba(255,255,255,0.5)');
    expect(withAlpha('#000000', 2)).toBe('rgba(0,0,0,1)');
  });
  it('leaves non-hex colours untouched instead of corrupting them', () => {
    expect(withAlpha('rgba(1,2,3,0.5)', 0.2)).toBe('rgba(1,2,3,0.5)');
  });
  it('icon sizes ascend', () => {
    const v = Object.values(iconSize);
    expect([...v].sort((a, b) => a - b)).toEqual(v);
  });
});

describe('base components are flat', () => {
  const BASE = ['AppButton', 'AppCard', 'AppAvatar', 'AppModal', 'AppIconButton', 'Pressy'].map((n) => path.join(SRC, 'components/common', `${n}.tsx`)).concat(path.join(SRC, 'components/navigation/AppTabBar.tsx'));
  it('use no gradients and no glow', () => {
    for (const f of BASE) {
      const s = read(f);
      expect({ f: rel(f), gradient: /LinearGradient|expo-linear-gradient/.test(s) }).toEqual({ f: rel(f), gradient: false });
      expect({ f: rel(f), glow: /glow\(/.test(s) }).toEqual({ f: rel(f), glow: false });
    }
  });
  it('use no hardcoded hex colours (colours come from the theme)', () => {
    for (const f of BASE) expect({ f: rel(f), hex: read(f).match(/#[0-9a-fA-F]{3,8}\b/g) }).toEqual({ f: rel(f), hex: null });
  });
});

describe('app-wide', () => {
  it('no screen or component uses a gradient (flat, solid surfaces everywhere)', () => {
    const hits = files.filter((f) => /LinearGradient|expo-linear-gradient/.test(read(f))).map(rel);
    expect(hits).toEqual([]);
  });
  it('no coloured glow helper remains', () => {
    expect(files.filter((f) => /\bglow\(/.test(read(f))).map(rel)).toEqual([]);
  });
});
