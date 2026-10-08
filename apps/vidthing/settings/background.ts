import { settings } from '@bridgething/client/settings';
import { BG_CHUNK_BYTES, BG_MAX_BYTES, bgChunkKey, DOC_BG_META, type BgMeta } from '../src/theme';

const SCREEN_W = 800;
const SCREEN_H = 480;

export type Prepared = { bytes: Uint8Array; mime: string; animated: boolean; thumb: string; previewUrl: string };

function sniff(b: Uint8Array): string | null {
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (b[0] === 0x89 && ascii(1, 3) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  return null;
}

function isAnimated(b: Uint8Array, mime: string): boolean {
  if (mime === 'image/gif') return countGifFrames(b) > 1;
  if (mime === 'image/webp') {
    // VP8X header carries an animation flag
    const tag = String.fromCharCode(...b.subarray(12, 16));
    return tag === 'VP8X' && (b[20] & 0x02) !== 0;
  }
  if (mime === 'image/png') {
    // apng puts acTL before the first IDAT
    const head = new TextDecoder('latin1').decode(b.subarray(0, Math.min(b.length, 1 << 16)));
    const ac = head.indexOf('acTL');
    return ac >= 0 && (head.indexOf('IDAT') < 0 || ac < head.indexOf('IDAT'));
  }
  return false;
}

// counts image descriptors, stopping at two; a cheap walk of the block structure, not a decoder
function countGifFrames(b: Uint8Array): number {
  let p = 13;
  if (b[10] & 0x80) p += 3 * (1 << ((b[10] & 0x07) + 1));
  let frames = 0;
  const skipSub = () => {
    while (p < b.length && b[p] !== 0) p += b[p] + 1;
    p++;
  };
  while (p < b.length && frames < 2) {
    const block = b[p++];
    if (block === 0x2c) {
      frames++;
      const flags = b[p + 8];
      p += 9;
      if (flags & 0x80) p += 3 * (1 << ((flags & 0x07) + 1));
      p++;
      skipSub();
    } else if (block === 0x21) {
      p++;
      skipSub();
    } else break;
  }
  return frames;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('this phone could not decode that image'));
    img.src = url;
  });
}

function draw(img: HTMLImageElement, w: number, h: number, cover: boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const s = cover ? Math.max(w / img.naturalWidth, h / img.naturalHeight) : w / img.naturalWidth;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  return c;
}

const toBlob = (c: HTMLCanvasElement, type: string, q: number) =>
  new Promise<Blob | null>(res => c.toBlob(res, type, q));

export async function prepare(file: Blob): Promise<Prepared> {
  const raw = new Uint8Array(await file.arrayBuffer());
  const mime = sniff(raw) ?? (file.type || 'image/jpeg');
  const animated = isAnimated(raw, mime);
  const srcUrl = URL.createObjectURL(file);
  const img = await loadImage(srcUrl);

  const thumb = draw(img, 240, 144, true).toDataURL('image/jpeg', 0.7);

  if (animated) {
    if (raw.length > BG_MAX_BYTES) {
      URL.revokeObjectURL(srcUrl);
      const mb = (raw.length / 1024 / 1024).toFixed(1);
      throw new Error(`that animation is ${mb} MB; the limit is ${BG_MAX_BYTES / 1024 / 1024} MB`);
    }
    return { bytes: raw, mime, animated, thumb, previewUrl: srcUrl };
  }

  // stills only need to cover 800x480; keep aspect so contain and fill still look right on the device
  const s = Math.min(1, Math.max(SCREEN_W / img.naturalWidth, SCREEN_H / img.naturalHeight));
  const c = draw(img, Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s), false);
  // ios webviews quietly hand back png for webp, so check what actually came out
  let out = await toBlob(c, 'image/webp', 0.88);
  if (!out || out.type !== 'image/webp') out = await toBlob(c, 'image/jpeg', 0.9);
  if (!out) throw new Error('could not re-encode that image');
  let bytes = new Uint8Array(await out.arrayBuffer());
  let outMime = out.type;
  if (s === 1 && raw.length <= bytes.length && raw.length <= BG_MAX_BYTES) {
    bytes = raw;
    outMime = mime;
  }
  if (bytes.length > BG_MAX_BYTES) throw new Error('that image is still too large after resizing');
  URL.revokeObjectURL(srcUrl);
  const previewUrl = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: outMime }));
  return { bytes, mime: outMime, animated: false, thumb, previewUrl };
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function upload(p: Prepared, old: BgMeta | null, progress: (frac: number) => void): Promise<BgMeta> {
  const id = Date.now().toString(36);
  const chunks = Math.ceil(p.bytes.length / BG_CHUNK_BYTES);
  for (let i = 0; i < chunks; i++) {
    progress(i / (chunks + 1));
    await settings.doc.set(bgChunkKey(id, i), b64(p.bytes.subarray(i * BG_CHUNK_BYTES, (i + 1) * BG_CHUNK_BYTES)));
  }
  const meta: BgMeta = { id, mime: p.mime, size: p.bytes.length, chunks, animated: p.animated, thumb: p.thumb };
  // meta is the commit point: the device only switches once every chunk is already there
  await settings.doc.set(DOC_BG_META, JSON.stringify(meta));
  progress(1);
  if (old) await dropChunks(old);
  return meta;
}

export async function remove(old: BgMeta | null): Promise<void> {
  await settings.doc.delete(DOC_BG_META);
  if (old) await dropChunks(old);
}

async function dropChunks(m: BgMeta) {
  for (let i = 0; i < m.chunks; i++) await settings.doc.delete(bgChunkKey(m.id, i)).catch(() => undefined);
}

export async function fromUrl(url: string): Promise<Blob> {
  const r = await settings.fetch(url, { timeoutMs: 20_000 });
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  return r.blob();
}
