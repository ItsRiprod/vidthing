import type { BridgethingClient } from '@bridgething/client';
import { useEffect, useRef } from 'react';

const WHEEL_THROTTLE_MS = 70;
// the dial press is not in the documented mapping; these are the likely candidates
const PLAY_KEYS = new Set(['Enter', ' ', 'MediaPlayPause']);

export function useHardware(
  client: BridgethingClient,
  h: { setSlot(i: number): void; toggle(): void; toggleUi(): void },
) {
  const ref = useRef(h);
  ref.current = h;

  useEffect(() => {
    let lastWheel = 0;
    const onWheel = (e: WheelEvent) => {
      const d = e.deltaX || e.deltaY;
      if (!d) return;
      e.preventDefault();
      const t = performance.now();
      if (t - lastWheel < WHEEL_THROTTLE_MS) return;
      lastWheel = t;
      void (d > 0 ? client.audio.volumeUp() : client.audio.volumeDown());
    };
    const onKey = (e: KeyboardEvent) => {
      if (import.meta.env.DEV) console.debug('vidthing key', e.key, e.code);
      if (e.repeat) return;
      if (e.key >= '1' && e.key <= '4') ref.current.setSlot(Number(e.key) - 1);
      else if (PLAY_KEYS.has(e.key)) {
        e.preventDefault();
        ref.current.toggle();
      } else if (e.key === 'Escape') ref.current.toggleUi();
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [client]);
}
