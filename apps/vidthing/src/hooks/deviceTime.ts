import type { BridgethingClient, TimeInfo } from '@bridgething/client';
import type { TimeSource, Zone } from '../time';
import { measureOffset, mono } from './netTime';

// the daemon normally sets the system clock from the phone, but wallClockUnixS is whole seconds, so only override
// Date.now() when the system clock is clearly wrong (fresh boot with no rtc, phone not yet synced)
const TRUST_SYSTEM_WITHIN_MS = 3000;
const REFRESH_MS = 10 * 60_000;
const NET_SYNC_MS = 30 * 60_000;
const NET_RETRY_MS = 2 * 60_000;

export function deviceTimeSource(client: BridgethingClient): TimeSource {
  let offset = 0;
  let synced = false;
  // offset from the monotonic clock to internet time; immune to the daemon stepping the system clock
  let netOffset: number | null = null;
  let netBusy = false;
  let netTimer: ReturnType<typeof setTimeout> | undefined;
  let zone: Zone = { tz: null, offsetMin: null, locale: undefined };
  const subs = new Set<() => void>();
  const notify = () => subs.forEach(f => f());

  const apply = (t: TimeInfo) => {
    if (t.wallClockUnixS != null) {
      const diff = t.wallClockUnixS * 1000 - Date.now();
      offset = Math.abs(diff) > TRUST_SYSTEM_WITHIN_MS ? diff : 0;
      synced = true;
    }
    zone = {
      tz: t.tzIana,
      offsetMin: t.utcOffsetMinutes != null ? t.utcOffsetMinutes + (t.dstOffsetMinutes ?? 0) : null,
      // phones report en_US style, intl wants en-US
      locale: t.locale?.replace(/_/g, '-').replace(/@.*$/, '') || undefined,
    };
    notify();
  };

  const refresh = () => client.time.get().then(r => r.ok && apply(r.response.time));

  const netSync = async () => {
    if (netBusy) return;
    netBusy = true;
    clearTimeout(netTimer);
    const off = await measureOffset(client).catch(() => null);
    netBusy = false;
    if (off != null) {
      netOffset = off;
      notify();
    }
    netTimer = setTimeout(netSync, off != null ? NET_SYNC_MS : NET_RETRY_MS);
  };

  client.time.onSnapshot(s => apply(s.time));
  client.time.onChanged(s => apply(s.time));
  client.on(e => {
    if (e.type !== 'open') return;
    void refresh();
    void netSync();
  });
  setInterval(refresh, REFRESH_MS);
  void refresh();
  void netSync();

  // read over cdp to check the clock against a reference
  (globalThis as { __vidthingTime?: unknown }).__vidthingTime = () => ({
    source: netOffset != null ? 'net' : synced ? 'phone' : 'system',
    netOffset,
    driftMs: netOffset != null ? mono() + netOffset - Date.now() : offset,
  });

  return {
    now() {
      if (netOffset != null) return mono() + netOffset;
      if (synced) return Date.now() + offset;
      // before the phone answers, a system clock still stuck near the epoch is worse than no clock
      return new Date().getFullYear() >= 2025 ? Date.now() : null;
    },
    zone: () => zone,
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}
