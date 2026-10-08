import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { rgba, type ControlsLayout } from '../theme';
import { anchorStyle } from './anchor';

export type PlayerView = {
  title: string | null;
  artist: string | null;
  artUrl: string | null;
  playing: boolean;
  positionMs: number;
  /** performance.now() when positionMs was true */
  at: number;
  durationMs: number | null;
  canSeek: boolean;
  connected: boolean;
};

export type PlayerActions = {
  prev(): void;
  toggle(): void;
  next(): void;
  seek(ms: number): void;
};

const icon = (d: string, size: number, color: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d={d} />
  </svg>
);
const PREV = 'M6 6h2v12H6zm3.5 6 8.5 6V6z';
const NEXT = 'M16 6h2v12h-2zM6 18l8.5-6L6 6z';
const PLAY = 'M8 5v14l11-7z';
const PAUSE = 'M6 5h4v14H6zm8 0h4v14h-4z';

function Progress({ p, c, onSeek }: { p: PlayerView; c: ControlsLayout; onSeek(ms: number): void }) {
  const fill = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // drives the bar straight on the dom so the rest of the overlay is not re-rendered every frame
    let raf = 0;
    let last = 0;
    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 250) return;
      last = t;
      const pos = p.playing ? p.positionMs + (performance.now() - p.at) : p.positionMs;
      const frac = p.durationMs ? Math.min(1, Math.max(0, pos / p.durationMs)) : 0;
      if (fill.current) fill.current.style.transform = `scaleX(${frac})`;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [p.playing, p.positionMs, p.at, p.durationMs]);

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    if (!p.canSeek || !p.durationMs) return;
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.round(((e.clientX - r.left) / r.width) * p.durationMs));
  };

  return (
    <div onPointerDown={seek} style={{ width: c.progressWidth, padding: '10px 0', marginTop: 6 }}>
      <div style={{ height: 4, borderRadius: 2, background: rgba(c.color, 0.25), overflow: 'hidden' }}>
        <div
          ref={fill}
          style={{
            height: '100%',
            background: c.accent,
            transformOrigin: 'left',
            transform: 'scaleX(0)',
            willChange: 'transform',
          }}
        />
      </div>
    </div>
  );
}

export function Controls({
  c,
  p,
  act,
  visible,
}: {
  c: ControlsLayout;
  p: PlayerView;
  act: PlayerActions;
  visible: boolean;
}) {
  const [pressed, setPressed] = useState<string | null>(null);
  const s = c.size;
  const contrast = c.style === 'circle' ? (isLight(c.accent) ? '#000000' : '#ffffff') : c.accent;

  const btn = (id: string, d: string, onClick: () => void, main = false) => {
    const fg = main ? contrast : c.color;
    const circle = c.style === 'circle';
    return (
      <button
        key={id}
        onPointerDown={() => setPressed(id)}
        onPointerUp={() => setPressed(null)}
        onPointerLeave={() => setPressed(null)}
        onClick={onClick}
        style={{
          width: main ? s * 1.5 : s * 1.15,
          height: main ? s * 1.5 : s * 1.15,
          display: 'grid',
          placeItems: 'center',
          border: 'none',
          padding: 0,
          borderRadius: '50%',
          background: circle && main ? c.accent : 'transparent',
          transform: pressed === id ? 'scale(0.9)' : undefined,
          transition: 'transform 80ms',
        }}>
        {icon(d, main ? s : s * 0.8, circle && main ? fg : main ? c.accent : fg)}
      </button>
    );
  };

  return (
    <div
      style={{
        ...anchorStyle(c.anchor, c.x, c.y),
        display: 'flex',
        flexDirection: 'column',
        opacity: visible ? c.opacity : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 300ms',
        background: c.pillOpacity > 0 ? rgba(c.pill, c.pillOpacity) : undefined,
        padding: c.pillOpacity > 0 ? `${s * 0.2}px ${s * 0.45}px` : undefined,
        borderRadius: s,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: s * 0.35 }}>
        {c.showPrevNext && btn('prev', PREV, act.prev)}
        {btn('play', p.playing ? PAUSE : PLAY, act.toggle, true)}
        {c.showPrevNext && btn('next', NEXT, act.next)}
      </div>
      {c.showProgress && <Progress p={p} c={c} onSeek={act.seek} />}
    </div>
  );
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return false;
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 160;
}
