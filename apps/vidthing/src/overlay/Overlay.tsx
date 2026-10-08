import type { Layout } from '../theme';
import type { TimeSource } from '../time';
import { Background } from './Background';
import { Clock } from './Clock';
import { Controls, type PlayerActions, type PlayerView } from './Controls';
import { TrackInfo } from './TrackInfo';

export type OverlayProps = {
  layout: Layout;
  bgUrl: string | null;
  bgAnimated: boolean;
  time: TimeSource;
  player: PlayerView;
  actions: PlayerActions;
  /** false hides everything but the background */
  ui: boolean;
  controlsVisible: boolean;
};

// pure render of one layout; the device and the settings preview both draw through this
export function Overlay({ layout: l, bgUrl, bgAnimated, time, player, actions, ui, controlsVisible }: OverlayProps) {
  return (
    <div style={{ position: 'relative', width: 800, height: 480, overflow: 'hidden', userSelect: 'none' }}>
      <Background bg={l.bg} url={bgUrl} animated={bgAnimated} />
      {ui && l.track.show && <TrackInfo t={l.track} p={player} />}
      {ui && l.clock.show && <Clock c={l.clock} source={time} />}
      {ui && l.controls.show && <Controls c={l.controls} p={player} act={actions} visible={controlsVisible} />}
    </div>
  );
}
