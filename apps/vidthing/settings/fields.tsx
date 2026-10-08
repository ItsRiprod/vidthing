import type { FormEvent, ReactNode } from 'react';
import type { Anchor, Placed } from '../src/theme';

type Val<T> = { label: string; value: T; onChange(v: T): void };

const val = (e: FormEvent<HTMLInputElement | HTMLSelectElement>) => e.currentTarget.value;

export function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="section" open={open}>
      <summary>{title}</summary>
      <div className="section-body">{children}</div>
    </details>
  );
}

export function Toggle({ label, value, onChange }: Val<boolean>) {
  return (
    <label className="field toggle">
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={e => onChange(e.currentTarget.checked)} />
    </label>
  );
}

export function Range({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  pct,
}: Val<number> & { min: number; max: number; step?: number; unit?: string; pct?: boolean }) {
  const shown = pct ? `${Math.round(value * 100)}%` : `${value}${unit}`;
  return (
    <label className="field">
      <span>
        {label} <em>{shown}</em>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={e => onChange(Number(val(e)))} />
    </label>
  );
}

export function Select<T extends string>({ label, value, onChange, options }: Val<T> & { options: [T, string][] }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={e => onChange(val(e) as T)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Color({ label, value, onChange }: Val<string>) {
  return (
    <label className="field color">
      <span>{label}</span>
      <span className="color-row">
        <input type="color" value={value} onInput={e => onChange(val(e))} />
        <input
          type="text"
          value={value}
          maxLength={7}
          onInput={e => /^#[0-9a-f]{6}$/i.test(val(e)) && onChange(val(e).toLowerCase())}
        />
      </span>
    </label>
  );
}

const ANCHORS: Anchor[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

export function AnchorPicker({ value, onChange }: { value: Anchor; onChange(a: Anchor): void }) {
  return (
    <div className="field">
      <span>Anchor</span>
      <div className="anchor-grid">
        {ANCHORS.map(a => (
          <button
            key={a}
            type="button"
            aria-label={a}
            className={a === value ? 'on' : ''}
            onClick={() => onChange(a)}
          />
        ))}
      </div>
    </div>
  );
}

// the knobs every overlay element shares: visibility, where it sits, and how see-through it is
export function PlacedFields<T extends Placed>({ v, set }: { v: T; set(p: Partial<Placed>): void }) {
  return (
    <>
      <Toggle label="Show" value={v.show} onChange={show => set({ show })} />
      <AnchorPicker value={v.anchor} onChange={anchor => set({ anchor })} />
      <Range label="Nudge X" value={v.x} min={-400} max={400} unit="px" onChange={x => set({ x })} />
      <Range label="Nudge Y" value={v.y} min={-240} max={240} unit="px" onChange={y => set({ y })} />
      <Range label="Opacity" value={v.opacity} min={0} max={1} step={0.05} pct onChange={opacity => set({ opacity })} />
    </>
  );
}
