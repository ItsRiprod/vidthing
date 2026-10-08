import type { BridgethingClient, ConnectionState, PlayerState } from '@bridgething/client';
import { useEffect, useMemo, useState } from 'react';
import type { PlayerActions, PlayerView } from '../overlay/Controls';

export function usePlayer(client: BridgethingClient): { view: PlayerView; actions: PlayerActions } {
  const [conn, setConn] = useState<ConnectionState>(client.connectionState);
  const [snap, setSnap] = useState<{ state: PlayerState; at: number } | null>(null);
  const [artUrl, setArtUrl] = useState<string | null>(null);

  useEffect(() => {
    const take = (state: PlayerState) => setSnap({ state, at: performance.now() });
    const prime = () => client.player.stateGet().then(r => r.ok && take(r.response.state));
    const offConn = client.on(e => {
      if (e.type === 'open' || e.type === 'close' || e.type === 'connecting') setConn(client.connectionState);
      if (e.type === 'open') void prime();
    });
    const offSnap = client.player.onSnapshot(r => take(r.state));
    void prime();
    return () => {
      offConn();
      offSnap();
    };
  }, [client]);

  const artworkId = snap?.state.track?.artworkId ?? null;
  useEffect(() => {
    if (!artworkId) {
      setArtUrl(null);
      return;
    }
    let dead = false;
    let url: string | null = null;
    (async () => {
      const r = await client.asset.get({ id: artworkId, requestId: crypto.randomUUID() });
      if (dead || !r.ok) return;
      const bytes = new Uint8Array(r.response.bytes as unknown as number[]);
      url = URL.createObjectURL(new Blob([bytes], { type: r.response.mime ?? 'image/jpeg' }));
      setArtUrl(url);
    })();
    return () => {
      dead = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, artworkId]);

  const view = useMemo<PlayerView>(() => {
    const s = snap?.state;
    const playing = s?.playback.state === 'playing';
    const age = playing ? (s?.playback.positionAgeMs ?? 0) : 0;
    return {
      title: s?.track?.title ?? null,
      artist: s?.track?.artist ?? null,
      artUrl,
      playing,
      positionMs: (s?.playback.positionMs ?? 0) + age,
      at: snap?.at ?? performance.now(),
      durationMs: s?.track?.durationMs ?? null,
      canSeek: s?.playback.setElapsedTimeAvailable !== false,
      connected: conn === 'open' && !!s?.track,
    };
  }, [snap, artUrl, conn]);

  const actions = useMemo<PlayerActions>(
    () => ({
      prev: () => void client.player.skipPrev({ allowSeeking: true }),
      next: () => void client.player.skipNext(),
      toggle: () => {
        const playing = snap?.state.playback.state === 'playing';
        // flip locally so the icon answers the press now, the next snapshot corrects it if the phone disagrees
        setSnap(cur => {
          if (!cur) return cur;
          const now = performance.now();
          const pb = cur.state.playback;
          const pos = playing ? pb.positionMs + (pb.positionAgeMs ?? 0) + (now - cur.at) : pb.positionMs;
          const state = playing ? 'paused' : 'playing';
          return { at: now, state: { ...cur.state, playback: { ...pb, state, positionMs: pos, positionAgeMs: 0 } } };
        });
        void (playing ? client.player.pause() : client.player.resume());
      },
      seek: ms => void client.player.seekTo({ positionMs: ms }),
    }),
    [client, snap],
  );

  return { view, actions };
}
