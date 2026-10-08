export type Zone = {
  tz: string | null;
  /** utc offset plus dst, used only when the phone sends no iana zone */
  offsetMin: number | null;
  locale: string | undefined;
};

export type TimeSource = {
  /** corrected unix ms, or null while there is no trustworthy clock */
  now(): number | null;
  zone(): Zone;
  /** fires when the offset or zone changes so the clock can redraw immediately */
  subscribe(cb: () => void): () => void;
};

export type ClockText = { time: string; ampm: string; date: string };

const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(locale: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = cache.get(key);
  if (!f) {
    // an unknown locale or zone from the phone throws; degrade instead of blanking the clock
    const { timeZone: _zone, ...noZone } = opts;
    try {
      f = new Intl.DateTimeFormat(locale, opts);
    } catch {
      try {
        f = new Intl.DateTimeFormat(undefined, opts);
      } catch {
        f = new Intl.DateTimeFormat(undefined, noZone);
      }
    }
    cache.set(key, f);
  }
  return f;
}

export function formatClock(
  ms: number,
  zone: Zone,
  o: { h24: boolean; seconds: boolean; dateStyle: 'short' | 'long' },
): ClockText {
  // without an iana zone, shift the instant and format it as utc so the fixed offset is applied exactly once
  const useOffset = !zone.tz && zone.offsetMin != null;
  const at = new Date(useOffset ? ms + zone.offsetMin! * 60_000 : ms);
  const timeZone = useOffset ? 'UTC' : (zone.tz ?? undefined);

  const parts = fmt(zone.locale, {
    timeZone,
    hour: o.h24 ? '2-digit' : 'numeric',
    minute: '2-digit',
    second: o.seconds ? '2-digit' : undefined,
    hourCycle: o.h24 ? 'h23' : 'h12',
  }).formatToParts(at);

  let time = '';
  let ampm = '';
  for (const p of parts) {
    if (p.type === 'dayPeriod') ampm = p.value;
    else if (p.type === 'hour' || p.type === 'minute' || p.type === 'second') time += p.value;
    else if (p.type === 'literal' && time && !/^\s+$/.test(p.value)) time += p.value;
  }

  const date = fmt(
    zone.locale,
    o.dateStyle === 'long'
      ? { timeZone, weekday: 'long', month: 'long', day: 'numeric' }
      : { timeZone, weekday: 'short', month: 'short', day: 'numeric' },
  ).format(at);

  return { time, ampm, date };
}

export function localTimeSource(): TimeSource {
  return {
    now: () => Date.now(),
    zone: () => ({ tz: null, offsetMin: null, locale: undefined }),
    subscribe: () => () => {},
  };
}
