import type { BridgethingClient } from '@bridgething/client';

// the car thing has no ntp and its clock drifts seconds behind between phone syncs, so measure real time through the
// phone's internet. the endpoint only reports whole seconds, so each request is timed to land on the server's second
// boundary as currently estimated, which halves the uncertainty per sample down to about the round trip.
const URL_TRACE = 'https://cloudflare.com/cdn-cgi/trace';
const SAMPLES = 9;
const GOOD_ENOUGH_MS = 120;
const USABLE_MS = 500;

const mono = () => performance.timeOrigin + performance.now();

async function sample(client: BridgethingClient): Promise<[number, number, number] | null> {
  const t0 = mono();
  const r = await client.net.fetch(
    { request: { url: URL_TRACE, method: 'GET', headers: [], timeoutMs: 5000, redirect: 'follow' } },
    { timeoutMs: 6000 },
  );
  const t1 = mono();
  if (!r.ok || r.response.response.status !== 200) return null;
  const body = new TextDecoder().decode(new Uint8Array(r.response.response.body as unknown as number[]));
  const ts = Number(/ts=([\d.]+)/.exec(body)?.[1]) * 1000;
  if (!Number.isFinite(ts)) return null;
  const width = ts % 1000 === 0 ? 1000 : 1;
  // server time when it answered lies in [ts, ts + width), and that moment lies between t0 and t1 locally
  return [ts - t1, ts + width - t0, t1 - t0];
}

/** resolves to an offset to add to mono() (performance.timeOrigin + performance.now()), or null */
export async function measureOffset(client: BridgethingClient): Promise<number | null> {
  let lo = -Infinity;
  let hi = Infinity;
  for (let i = 0; i < SAMPLES; i++) {
    const s = await sample(client).catch(() => null);
    if (!s) {
      if (i === 0) return null;
      continue;
    }
    lo = Math.max(lo, s[0]);
    hi = Math.min(hi, s[1]);
    // contradicting samples mean a slow or retried request skewed one; start over rather than trust it
    if (lo > hi) return null;
    if (hi - lo < GOOD_ENOUGH_MS) break;
    // fire so the request reaches the server just as its clock ticks over, by the midpoint estimate
    const mid = (lo + hi) / 2;
    const arrive = mono() + s[2] / 2 + mid;
    await new Promise(r => setTimeout(r, (1000 - (arrive % 1000)) % 1000));
  }
  return hi - lo < USABLE_MS ? (lo + hi) / 2 : null;
}

export { mono };
