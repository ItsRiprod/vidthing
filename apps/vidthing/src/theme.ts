// shared by the device app and the settings page, so nothing here may touch the client or tailwind.

export type Anchor = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';
export type FontKey = 'outfit' | 'inter' | 'mono';
export type Fit = 'cover' | 'contain' | 'fill';
export type ButtonStyle = 'bare' | 'circle';

export type Placed = {
  show: boolean;
  anchor: Anchor;
  /** px, positive moves right */
  x: number;
  /** px, positive moves down */
  y: number;
  /** 0-1 */
  opacity: number;
};

export type ClockLayout = Placed & {
  size: number;
  color: string;
  font: FontKey;
  weight: number;
  h24: boolean;
  seconds: boolean;
  showDate: boolean;
  dateStyle: 'short' | 'long';
  dateScale: number;
  shadow: number;
  pill: string;
  pillOpacity: number;
};

export type ControlsLayout = Placed & {
  size: number;
  color: string;
  accent: string;
  style: ButtonStyle;
  pill: string;
  pillOpacity: number;
  showPrevNext: boolean;
  showProgress: boolean;
  progressWidth: number;
  /** seconds of no touch before hiding, 0 keeps them up */
  autoHide: number;
};

export type TrackLayout = Placed & {
  size: number;
  color: string;
  font: FontKey;
  showArtist: boolean;
  showArt: boolean;
  artSize: number;
  maxWidth: number;
  shadow: number;
  pill: string;
  pillOpacity: number;
};

export type BgLayout = {
  fit: Fit;
  dim: number;
  blur: number;
  color: string;
};

export type Layout = {
  name: string;
  bg: BgLayout;
  clock: ClockLayout;
  controls: ControlsLayout;
  track: TrackLayout;
};

export type Slots = [Layout, Layout, Layout, Layout];
export type Theme = { v: 1; slots: Slots };

export type BgMeta = {
  id: string;
  mime: string;
  size: number;
  chunks: number;
  animated: boolean;
  /** small jpeg data url so the settings page can preview without pulling megabytes back over bluetooth */
  thumb: string;
};

export const DOC_THEME = 'theme';
export const DOC_ACTIVE = 'active';
export const DOC_BG_META = 'bg.meta';
export const bgChunkKey = (id: string, i: number) => `bg.${id}.${i}`;
// raw bytes per chunk; base64 grows it by 4/3 which lands at 240 KiB, under the 256 KiB doc cap.
export const BG_CHUNK_BYTES = 180 * 1024;
export const BG_MAX_BYTES = 8 * 1024 * 1024;

export const FONTS: Record<FontKey, string> = {
  outfit: '"Outfit", system-ui, sans-serif',
  inter: '"Inter", system-ui, sans-serif',
  mono: 'ui-monospace, "DejaVu Sans Mono", Menlo, Consolas, monospace',
};

export const BASE: Layout = {
  name: 'Custom',
  bg: { fit: 'cover', dim: 0.15, blur: 0, color: '#101418' },
  clock: {
    show: true,
    anchor: 'mc',
    x: 0,
    y: -20,
    opacity: 1,
    size: 140,
    color: '#ffffff',
    font: 'outfit',
    weight: 300,
    h24: false,
    seconds: false,
    showDate: true,
    dateStyle: 'long',
    dateScale: 0.18,
    shadow: 0.5,
    pill: '#000000',
    pillOpacity: 0,
  },
  controls: {
    show: true,
    anchor: 'bc',
    x: 0,
    y: -24,
    opacity: 0.9,
    size: 44,
    color: '#ffffff',
    accent: '#ffffff',
    style: 'circle',
    pill: '#000000',
    pillOpacity: 0.35,
    showPrevNext: true,
    showProgress: false,
    progressWidth: 320,
    autoHide: 0,
  },
  track: {
    show: true,
    anchor: 'bl',
    x: 24,
    y: -24,
    opacity: 0.9,
    size: 20,
    color: '#ffffff',
    font: 'inter',
    showArtist: true,
    showArt: false,
    artSize: 56,
    maxWidth: 260,
    shadow: 0.5,
    pill: '#000000',
    pillOpacity: 0,
  },
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T extends object>(base: T, over: unknown): T {
  if (!over || typeof over !== 'object') return structuredClone(base);
  const out = structuredClone(base) as Record<string, unknown>;
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    if (!(k in out)) continue;
    const cur = out[k];
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) out[k] = merge(cur as object, v);
    else if (typeof v === typeof cur) out[k] = v;
  }
  return out as T;
}

export const layout = (over: DeepPartial<Layout>): Layout => merge(BASE, over);

export function parseLayout(raw: unknown): Layout {
  return merge(BASE, raw);
}

export const PRESETS: Layout[] = [
  layout({ name: 'Big Center Clock' }),
  layout({
    name: 'Minimal Corner',
    bg: { dim: 0 },
    clock: { anchor: 'tr', x: -28, y: 20, size: 72, weight: 500, showDate: false, dateScale: 0.25 },
    controls: { show: false },
    track: { anchor: 'bl', x: 28, y: -24, size: 18 },
  }),
  layout({
    name: 'Now Playing Bar',
    bg: { dim: 0.25 },
    clock: { anchor: 'tl', x: 28, y: 18, size: 64, weight: 600, showDate: true, dateStyle: 'short', dateScale: 0.3 },
    controls: { anchor: 'br', x: -24, y: -24, size: 40, style: 'circle', showProgress: false, pillOpacity: 0.45 },
    track: {
      anchor: 'bl',
      x: 24,
      y: -24,
      size: 22,
      showArt: true,
      artSize: 72,
      maxWidth: 420,
      pillOpacity: 0.45,
    },
  }),
  layout({
    name: 'Retro HUD',
    bg: { dim: 0.35 },
    clock: {
      anchor: 'mc',
      y: -40,
      size: 120,
      color: '#7cffb2',
      font: 'mono',
      weight: 400,
      h24: true,
      seconds: true,
      dateStyle: 'short',
      shadow: 0.9,
    },
    controls: {
      anchor: 'bc',
      y: -20,
      size: 36,
      color: '#7cffb2',
      accent: '#7cffb2',
      style: 'bare',
      pillOpacity: 0,
      showProgress: true,
      progressWidth: 420,
      autoHide: 8,
    },
    track: { anchor: 'tc', x: 0, y: 20, size: 18, color: '#7cffb2', font: 'mono', maxWidth: 600 },
  }),
];

export const defaultTheme = (): Theme => ({ v: 1, slots: structuredClone(PRESETS) as Slots });

export function parseTheme(json: string | null | undefined): Theme {
  const t = defaultTheme();
  if (!json) return t;
  try {
    const raw = JSON.parse(json) as { slots?: unknown[] };
    if (Array.isArray(raw.slots)) raw.slots.slice(0, 4).forEach((s, i) => (t.slots[i] = parseLayout(s)));
  } catch {
    // a corrupt doc should never brick the screen, fall back to presets
  }
  return t;
}

export function parseActive(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n < 4 ? n : 0;
}

export function rgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(0,0,0,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
