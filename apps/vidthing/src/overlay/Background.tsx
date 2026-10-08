import type { BgLayout } from '../theme';

export function Background({ bg, url, animated }: { bg: BgLayout; url: string | null; animated: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bg.color }}>
      {url && (
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: bg.fit,
            // blurring every frame of a gif is too heavy for the car thing's gpu, stills only
            filter: bg.blur > 0 && !animated ? `blur(${bg.blur}px)` : undefined,
            transform: bg.blur > 0 && !animated ? 'scale(1.05)' : undefined,
          }}
        />
      )}
      {bg.dim > 0 && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${bg.dim})` }} />}
    </div>
  );
}
