import type { BridgethingClient } from '@bridgething/client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bgChunkKey,
  DOC_ACTIVE,
  DOC_BG_META,
  DOC_THEME,
  parseActive,
  parseTheme,
  type BgMeta,
  type Theme,
} from '../theme';

const CHUNK_TIMEOUT_MS = 15_000;

function decode(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function useDocs(client: BridgethingClient) {
  const [theme, setTheme] = useState<Theme>(() => parseTheme(null));
  const [active, setActiveState] = useState(0);
  const [bg, setBg] = useState<{ url: string; meta: BgMeta } | null>(null);
  const bgId = useRef<string | null>(null);
  const loadToken = useRef(0);

  const loadBg = useCallback(
    async (metaJson: string | null) => {
      const token = ++loadToken.current;
      let meta: BgMeta | null = null;
      try {
        meta = metaJson ? (JSON.parse(metaJson) as BgMeta) : null;
      } catch {
        meta = null;
      }
      if (!meta || !meta.chunks) {
        bgId.current = null;
        setBg(null);
        return;
      }
      if (meta.id === bgId.current) return;
      const parts: Uint8Array<ArrayBuffer>[] = [];
      for (let i = 0; i < meta.chunks; i++) {
        const r = await client.doc.get({ key: bgChunkKey(meta.id, i) }, { timeoutMs: CHUNK_TIMEOUT_MS });
        // a newer upload landed mid-load, or a chunk is missing; keep showing what we have
        if (token !== loadToken.current) return;
        if (!r.ok || r.response.value == null) {
          console.warn('vidthing: background chunk missing', i, meta.id);
          return;
        }
        parts.push(decode(r.response.value));
      }
      bgId.current = meta.id;
      const done = meta;
      setBg({ url: URL.createObjectURL(new Blob(parts, { type: meta.mime })), meta: done });
    },
    [client],
  );

  useEffect(() => {
    const load = async () => {
      const [t, a, m] = await Promise.all([
        client.doc.get({ key: DOC_THEME }),
        client.doc.get({ key: DOC_ACTIVE }),
        client.doc.get({ key: DOC_BG_META }),
      ]);
      if (t.ok) setTheme(parseTheme(t.response.value));
      if (a.ok) setActiveState(parseActive(a.response.value));
      if (m.ok) void loadBg(m.response.value);
    };
    const offOpen = client.on(e => e.type === 'open' && void load());
    const offChanged = client.doc.onChanged(({ key, value }) => {
      if (key === DOC_THEME) setTheme(parseTheme(value));
      else if (key === DOC_ACTIVE) setActiveState(parseActive(value));
      else if (key === DOC_BG_META) void loadBg(value);
    });
    void load();
    return () => {
      offOpen();
      offChanged();
    };
  }, [client, loadBg]);

  // the old object url stays alive until the new one has replaced it on screen
  const prevUrl = useRef<string | null>(null);
  useEffect(() => {
    if (prevUrl.current && prevUrl.current !== bg?.url) URL.revokeObjectURL(prevUrl.current);
    prevUrl.current = bg?.url ?? null;
  }, [bg]);

  const setActive = useCallback(
    (i: number) => {
      setActiveState(i);
      void client.doc.set({ key: DOC_ACTIVE, value: String(i) });
    },
    [client],
  );

  return { theme, layout: theme.slots[active], active, setActive, bg };
}
