import { settings } from '@bridgething/client/settings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { PlayerView } from '../src/overlay/Controls';
import { Overlay } from '../src/overlay/Overlay';
import {
  BG_MAX_BYTES,
  DOC_ACTIVE,
  DOC_BG_META,
  DOC_THEME,
  parseActive,
  parseLayout,
  parseTheme,
  PRESETS,
  type BgMeta,
  type ClockLayout,
  type ControlsLayout,
  type Layout,
  type Theme,
  type TrackLayout,
} from '../src/theme';
import { localTimeSource } from '../src/time';
import { fromUrl, prepare, remove, upload } from './background';
import { Color, PlacedFields, Range, Section, Select, Toggle } from './fields';
import './style.css';

const SAVE_DEBOUNCE_MS = 300;
const time = localTimeSource();
const noop = () => {};
const actions = { prev: noop, next: noop, toggle: noop, seek: noop };
const sample: PlayerView = {
  title: 'Song Title',
  artist: 'Artist Name',
  artUrl: null,
  playing: true,
  positionMs: 72_000,
  at: performance.now(),
  durationMs: 210_000,
  canSeek: true,
  connected: true,
};

function Preview({ layout, bgUrl, animated }: { layout: Layout; bgUrl: string | null; animated: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 800));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="preview" ref={box} style={{ height: 480 * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0', width: 800, height: 480 }}>
        <Overlay
          layout={layout}
          bgUrl={bgUrl}
          bgAnimated={animated}
          time={time}
          player={sample}
          actions={actions}
          ui
          controlsVisible
        />
      </div>
    </div>
  );
}

function Settings() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [slot, setSlot] = useState(0);
  const [meta, setMeta] = useState<BgMeta | null>(null);
  const [localBg, setLocalBg] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [preset, setPreset] = useState('0');
  const [url, setUrl] = useState('');
  const [io, setIo] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [t, a, m] = await Promise.all([
          settings.doc.get(DOC_THEME),
          settings.doc.get(DOC_ACTIVE),
          settings.doc.get(DOC_BG_META),
        ]);
        setTheme(parseTheme(t.value));
        setSlot(parseActive(a.value));
        setMeta(m.value ? (JSON.parse(m.value) as BgMeta) : null);
      } catch (err) {
        setTheme(parseTheme(null));
        setStatus(`could not reach the car thing: ${msg(err)}`);
      }
    })();
    // the device writes `active` when a preset button is pressed; follow it so edits land on what is on screen
    return settings.onDocChanged((key, value) => key === DOC_ACTIVE && setSlot(parseActive(value)));
  }, []);

  const save = (next: Theme) => {
    setTheme(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      settings.doc.set(DOC_THEME, JSON.stringify(next)).catch(err => setStatus(`save failed: ${msg(err)}`));
    }, SAVE_DEBOUNCE_MS);
  };

  const pickSlot = (i: number) => {
    setSlot(i);
    settings.doc.set(DOC_ACTIVE, String(i)).catch(() => undefined);
  };

  const layout = theme?.slots[slot];
  const edit = (fn: (l: Layout) => void) => {
    if (!theme) return;
    const next = structuredClone(theme);
    fn(next.slots[slot]);
    save(next);
  };
  const setClock = (p: Partial<ClockLayout>) => edit(l => Object.assign(l.clock, p));
  const setControls = (p: Partial<ControlsLayout>) => edit(l => Object.assign(l.controls, p));
  const setTrack = (p: Partial<TrackLayout>) => edit(l => Object.assign(l.track, p));
  const setBgL = (p: Partial<Layout['bg']>) => edit(l => Object.assign(l.bg, p));

  async function takeFile(file: Blob) {
    setStatus('preparing image...');
    try {
      const p = await prepare(file);
      setBusy(0);
      setStatus(`uploading ${(p.bytes.length / 1024).toFixed(0)} KB to the car thing...`);
      const m = await upload(p, meta, setBusy);
      setMeta(m);
      setLocalBg(cur => {
        if (cur) URL.revokeObjectURL(cur);
        return p.previewUrl;
      });
      setStatus(m.animated ? 'animated background set' : 'background set');
    } catch (err) {
      setStatus(msg(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const previewBg = localBg ?? meta?.thumb ?? null;
  const presetOptions = useMemo(() => PRESETS.map((p, i) => [String(i), p.name] as [string, string]), []);

  if (!theme || !layout) return <main className="hint">connecting to the car thing...</main>;
  const { clock: c, controls: k, track: t, bg } = layout;

  return (
    <main>
      <div className="sticky">
        <Preview layout={layout} bgUrl={previewBg} animated={meta?.animated ?? false} />
        <div className="slots">
          {theme.slots.map((s, i) => (
            <button key={i} type="button" className={i === slot ? 'on' : 'secondary'} onClick={() => pickSlot(i)}>
              <b>{i + 1}</b> {s.name}
            </button>
          ))}
        </div>
        <p className="status">{status}</p>
      </div>

      <Section title="Background" open>
        <p className="hint">
          Shared by all four layouts. Stills are resized for the screen; GIF, animated WebP and APNG up to{' '}
          {BG_MAX_BYTES / 1024 / 1024} MB are kept as-is.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          disabled={busy != null}
          onChange={e => e.currentTarget.files?.[0] && takeFile(e.currentTarget.files[0])}
        />
        {busy != null && <progress value={busy} max={1} />}
        <div className="row">
          <input
            type="url"
            placeholder="or paste an image url"
            value={url}
            onInput={e => setUrl(e.currentTarget.value)}
          />
          <button
            type="button"
            className="secondary"
            disabled={!url || busy != null}
            onClick={async () => {
              try {
                setStatus('downloading...');
                await takeFile(await fromUrl(url));
              } catch (err) {
                setStatus(msg(err));
              }
            }}>
            Load
          </button>
        </div>
        {meta && (
          <button
            type="button"
            className="secondary"
            disabled={busy != null}
            onClick={async () => {
              await remove(meta).catch(err => setStatus(msg(err)));
              setMeta(null);
              setLocalBg(null);
              setStatus('background removed');
            }}>
            Remove background
          </button>
        )}
        <Select
          label="Fit"
          value={bg.fit}
          options={[
            ['cover', 'Fill screen (crop)'],
            ['contain', 'Fit whole image'],
            ['fill', 'Stretch'],
          ]}
          onChange={fit => setBgL({ fit })}
        />
        <Range label="Dim" value={bg.dim} min={0} max={0.9} step={0.05} pct onChange={dim => setBgL({ dim })} />
        <Range
          label="Blur (stills only)"
          value={bg.blur}
          min={0}
          max={20}
          unit="px"
          onChange={blur => setBgL({ blur })}
        />
        <Color label="Backdrop color" value={bg.color} onChange={color => setBgL({ color })} />
      </Section>

      <Section title="Clock" open>
        <PlacedFields v={c} set={setClock} />
        <Range label="Size" value={c.size} min={24} max={260} unit="px" onChange={size => setClock({ size })} />
        <Color label="Color" value={c.color} onChange={color => setClock({ color })} />
        <Select
          label="Font"
          value={c.font}
          options={[
            ['outfit', 'Outfit'],
            ['inter', 'Inter'],
            ['mono', 'Monospace'],
          ]}
          onChange={font => setClock({ font })}
        />
        <Range
          label="Weight"
          value={c.weight}
          min={100}
          max={900}
          step={100}
          onChange={weight => setClock({ weight })}
        />
        <Toggle label="24-hour" value={c.h24} onChange={h24 => setClock({ h24 })} />
        <Toggle label="Seconds" value={c.seconds} onChange={seconds => setClock({ seconds })} />
        <Toggle label="Show date" value={c.showDate} onChange={showDate => setClock({ showDate })} />
        <Select
          label="Date style"
          value={c.dateStyle}
          options={[
            ['long', 'Thursday, October 8'],
            ['short', 'Thu, Oct 8'],
          ]}
          onChange={dateStyle => setClock({ dateStyle })}
        />
        <Range
          label="Date size"
          value={c.dateScale}
          min={0.08}
          max={0.5}
          step={0.01}
          pct
          onChange={dateScale => setClock({ dateScale })}
        />
        <Range
          label="Shadow"
          value={c.shadow}
          min={0}
          max={1}
          step={0.05}
          pct
          onChange={shadow => setClock({ shadow })}
        />
        <Color label="Backing color" value={c.pill} onChange={pill => setClock({ pill })} />
        <Range
          label="Backing opacity"
          value={c.pillOpacity}
          min={0}
          max={1}
          step={0.05}
          pct
          onChange={pillOpacity => setClock({ pillOpacity })}
        />
      </Section>

      <Section title="Media controls">
        <PlacedFields v={k} set={setControls} />
        <Range label="Size" value={k.size} min={20} max={96} unit="px" onChange={size => setControls({ size })} />
        <Color label="Icon color" value={k.color} onChange={color => setControls({ color })} />
        <Color label="Play button color" value={k.accent} onChange={accent => setControls({ accent })} />
        <Select
          label="Play button"
          value={k.style}
          options={[
            ['circle', 'Filled circle'],
            ['bare', 'Icon only'],
          ]}
          onChange={style => setControls({ style })}
        />
        <Toggle
          label="Previous / next"
          value={k.showPrevNext}
          onChange={showPrevNext => setControls({ showPrevNext })}
        />
        <Toggle
          label="Progress bar (tap to seek)"
          value={k.showProgress}
          onChange={showProgress => setControls({ showProgress })}
        />
        <Range
          label="Progress width"
          value={k.progressWidth}
          min={120}
          max={760}
          unit="px"
          onChange={progressWidth => setControls({ progressWidth })}
        />
        <Color label="Backing color" value={k.pill} onChange={pill => setControls({ pill })} />
        <Range
          label="Backing opacity"
          value={k.pillOpacity}
          min={0}
          max={1}
          step={0.05}
          pct
          onChange={pillOpacity => setControls({ pillOpacity })}
        />
        <Range
          label="Auto-hide after (0 = never)"
          value={k.autoHide}
          min={0}
          max={30}
          unit="s"
          onChange={autoHide => setControls({ autoHide })}
        />
      </Section>

      <Section title="Song title">
        <PlacedFields v={t} set={setTrack} />
        <Range label="Size" value={t.size} min={12} max={48} unit="px" onChange={size => setTrack({ size })} />
        <Color label="Color" value={t.color} onChange={color => setTrack({ color })} />
        <Select
          label="Font"
          value={t.font}
          options={[
            ['inter', 'Inter'],
            ['outfit', 'Outfit'],
            ['mono', 'Monospace'],
          ]}
          onChange={font => setTrack({ font })}
        />
        <Toggle label="Show artist" value={t.showArtist} onChange={showArtist => setTrack({ showArtist })} />
        <Toggle label="Show album art" value={t.showArt} onChange={showArt => setTrack({ showArt })} />
        <Range
          label="Art size"
          value={t.artSize}
          min={32}
          max={200}
          unit="px"
          onChange={artSize => setTrack({ artSize })}
        />
        <Range
          label="Max width"
          value={t.maxWidth}
          min={120}
          max={760}
          unit="px"
          onChange={maxWidth => setTrack({ maxWidth })}
        />
        <Range
          label="Shadow"
          value={t.shadow}
          min={0}
          max={1}
          step={0.05}
          pct
          onChange={shadow => setTrack({ shadow })}
        />
        <Color label="Backing color" value={t.pill} onChange={pill => setTrack({ pill })} />
        <Range
          label="Backing opacity"
          value={t.pillOpacity}
          min={0}
          max={1}
          step={0.05}
          pct
          onChange={pillOpacity => setTrack({ pillOpacity })}
        />
      </Section>

      <Section title={`Layout ${slot + 1}`}>
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            maxLength={24}
            value={layout.name}
            onInput={e => edit(l => (l.name = e.currentTarget.value))}
          />
        </label>
        <div className="row">
          <Select label="Start from preset" value={preset} options={presetOptions} onChange={setPreset} />
          <button
            type="button"
            className="secondary"
            onClick={() => edit(l => Object.assign(l, structuredClone(PRESETS[Number(preset)])))}>
            Apply
          </button>
        </div>
        <label className="field">
          <span>Share this layout</span>
          <textarea
            rows={4}
            value={io}
            placeholder="paste a layout here to import it"
            onInput={e => setIo(e.currentTarget.value)}
          />
        </label>
        <div className="row">
          <button type="button" className="secondary" onClick={() => setIo(JSON.stringify(layout))}>
            Export
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              try {
                const l = parseLayout(JSON.parse(io));
                edit(cur => Object.assign(cur, l));
                setStatus('layout imported');
              } catch {
                setStatus('that is not a valid layout');
              }
            }}>
            Import
          </button>
        </div>
      </Section>

      <div className="row">
        <button type="button" onClick={() => settings.done()}>
          Done
        </button>
      </div>
      <p className="hint">
        On the Car Thing: buttons 1-4 switch layouts, the dial changes volume, Back hides everything but the background.
      </p>
    </main>
  );
}

const msg = (err: unknown) => (err instanceof Error ? err.message : String(err));

createRoot(document.getElementById('root')!).render(<Settings />);
