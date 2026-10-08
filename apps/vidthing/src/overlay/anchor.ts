import type { CSSProperties } from 'react';
import type { Anchor } from '../theme';

const H: Record<string, 'l' | 'c' | 'r'> = { l: 'l', c: 'c', r: 'r' };
const V: Record<string, 't' | 'm' | 'b'> = { t: 't', m: 'm', b: 'b' };

// x/y are a nudge from the anchor point in screen space, so the same numbers mean the same thing in every corner.
export function anchorStyle(anchor: Anchor, x: number, y: number): CSSProperties {
  const v = V[anchor[0]] ?? 'm';
  const h = H[anchor[1]] ?? 'c';
  const s: CSSProperties = { position: 'absolute' };
  let tx = '0';
  let ty = '0';
  if (h === 'l') s.left = x;
  else if (h === 'r') s.right = -x;
  else {
    s.left = `calc(50% + ${x}px)`;
    tx = '-50%';
  }
  if (v === 't') s.top = y;
  else if (v === 'b') s.bottom = -y;
  else {
    s.top = `calc(50% + ${y}px)`;
    ty = '-50%';
  }
  if (tx !== '0' || ty !== '0') s.transform = `translate(${tx}, ${ty})`;
  s.alignItems = h === 'l' ? 'flex-start' : h === 'r' ? 'flex-end' : 'center';
  s.textAlign = h === 'l' ? 'left' : h === 'r' ? 'right' : 'center';
  return s;
}
