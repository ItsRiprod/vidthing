import { BridgethingClient } from '@bridgething/client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { daemonUrl } from './daemon';
import { deviceTimeSource } from './hooks/deviceTime';
import { useDocs } from './hooks/useDocs';
import { useHardware } from './hooks/useHardware';
import { usePlayer } from './hooks/usePlayer';
import { Overlay } from './overlay/Overlay';

export default function App() {
  const client = useMemo(() => new BridgethingClient({ url: daemonUrl() }), []);
  const time = useMemo(() => deviceTimeSource(client), [client]);
  const { layout, setActive, bg } = useDocs(client);
  const { view, actions } = usePlayer(client);
  const [ui, setUi] = useState(true);
  const [controlsUp, setControlsUp] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const autoHide = layout.controls.autoHide;
  const poke = useCallback(() => {
    setControlsUp(true);
    clearTimeout(hideTimer.current);
    if (autoHide > 0) hideTimer.current = setTimeout(() => setControlsUp(false), autoHide * 1000);
  }, [autoHide]);
  useEffect(() => {
    poke();
    return () => clearTimeout(hideTimer.current);
  }, [poke]);

  useHardware(client, {
    setSlot: setActive,
    toggle: () => {
      actions.toggle();
      poke();
    },
    toggleUi: () => setUi(v => !v),
  });

  return (
    // capture so the first tap on a hidden control only wakes it, the button underneath ignores it while invisible
    <div onPointerDownCapture={poke} style={{ width: 800, height: 480 }}>
      <Overlay
        layout={layout}
        bgUrl={bg?.url ?? null}
        bgAnimated={bg?.meta.animated ?? false}
        time={time}
        player={view}
        actions={actions}
        ui={ui}
        controlsVisible={controlsUp}
      />
    </div>
  );
}
