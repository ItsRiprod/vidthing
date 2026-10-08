import { FONTS, rgba, type TrackLayout } from '../theme';
import { anchorStyle } from './anchor';
import type { PlayerView } from './Controls';

export function TrackInfo({ t, p }: { t: TrackLayout; p: PlayerView }) {
  if (!p.title && !p.connected) return null;
  const right = t.anchor[1] === 'r';
  const ellipsis = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const;

  return (
    <div
      style={{
        ...anchorStyle(t.anchor, t.x, t.y),
        display: 'flex',
        flexDirection: right ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: t.size * 0.6,
        opacity: t.opacity,
        color: t.color,
        fontFamily: FONTS[t.font],
        textShadow: t.shadow > 0 ? `0 1px ${Math.round(t.size * 0.4)}px ${rgba('#000000', t.shadow)}` : 'none',
        background: t.pillOpacity > 0 ? rgba(t.pill, t.pillOpacity) : undefined,
        padding: t.pillOpacity > 0 ? t.size * 0.45 : undefined,
        borderRadius: t.size * 0.6,
        pointerEvents: 'none',
      }}>
      {t.showArt && p.artUrl && (
        <img
          src={p.artUrl}
          alt=""
          style={{ width: t.artSize, height: t.artSize, borderRadius: t.artSize * 0.12, objectFit: 'cover' }}
        />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: t.maxWidth, minWidth: 0 }}>
        <div style={{ ...ellipsis, fontSize: t.size, fontWeight: 600, lineHeight: 1.2 }}>
          {p.title ?? 'Nothing playing'}
        </div>
        {t.showArtist && p.artist && (
          <div style={{ ...ellipsis, fontSize: t.size * 0.75, opacity: 0.75, lineHeight: 1.3 }}>{p.artist}</div>
        )}
      </div>
    </div>
  );
}
