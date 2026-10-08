import { useEffect, useState } from 'react';
import { FONTS, rgba, type ClockLayout } from '../theme';
import { formatClock, type TimeSource } from '../time';
import { anchorStyle } from './anchor';

// redraws on the exact second (or minute) boundary of the corrected clock, so it never lags the phone by a tick
function useTick(source: TimeSource, seconds: boolean): number | null {
  const [now, setNow] = useState(() => source.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const step = seconds ? 1000 : 60_000;
    const schedule = () => {
      clearTimeout(timer);
      const t = source.now();
      setNow(t);
      // with no trusted time yet, poll gently until the phone answers
      const wait = t == null ? 1000 : step - (t % step) + 5;
      timer = setTimeout(schedule, wait);
    };
    schedule();
    const off = source.subscribe(schedule);
    const onVis = () => document.visibilityState === 'visible' && schedule();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(timer);
      off();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [source, seconds]);
  return now;
}

export function Clock({ c, source }: { c: ClockLayout; source: TimeSource }) {
  const now = useTick(source, c.seconds);
  const text = now == null ? null : formatClock(now, source.zone(), c);
  const shadow = c.shadow > 0 ? `0 2px ${Math.round(c.size * 0.12)}px ${rgba('#000000', c.shadow)}` : 'none';

  return (
    <div
      style={{
        ...anchorStyle(c.anchor, c.x, c.y),
        display: 'flex',
        flexDirection: 'column',
        opacity: c.opacity,
        color: c.color,
        fontFamily: FONTS[c.font],
        textShadow: shadow,
        background: c.pillOpacity > 0 ? rgba(c.pill, c.pillOpacity) : undefined,
        padding: c.pillOpacity > 0 ? `${c.size * 0.08}px ${c.size * 0.2}px` : undefined,
        borderRadius: c.size * 0.25,
        whiteSpace: 'nowrap',
        lineHeight: 1,
        pointerEvents: 'none',
      }}>
      <div
        style={{
          fontSize: c.size,
          fontWeight: c.weight,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          display: 'flex',
          alignItems: 'baseline',
        }}>
        <span>{text ? text.time : '--:--'}</span>
        {text && !c.h24 && text.ampm && (
          <span
            style={{ fontSize: c.size * 0.28, marginLeft: c.size * 0.08, fontWeight: Math.min(900, c.weight + 100) }}>
            {text.ampm}
          </span>
        )}
      </div>
      {c.showDate && text && (
        <div
          style={{
            fontSize: Math.max(10, c.size * c.dateScale),
            fontWeight: Math.max(300, Math.min(700, c.weight + 100)),
            marginTop: c.size * 0.08,
            opacity: 0.85,
          }}>
          {text.date}
        </div>
      )}
    </div>
  );
}
