import { useEffect, useState } from 'react';

export interface ImagePropertiesConfig {
  innerRadius: number;
  ringWidth: number;
  gcRingWidth: number;
  ringSpacing: number;
  legendFontSize: number;
  scaleFontSize: number;
  titleFontSize: number;
  labelFontSize: number;
  title: string;
  showLegend?: boolean;
}

interface ImagePropertiesProps {
  config: ImagePropertiesConfig;
  onChange: (config: ImagePropertiesConfig) => void;
}

interface PropertySliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  onCommit: (value: number) => void;
}

function normaliseSliderValue(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return min + Math.round((clamped - min) / step) * step;
}

function PropertySlider({
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  onCommit,
}: PropertySliderProps) {
  const inputId = `${label.toLowerCase().replace(/\s+/g, '-')}-slider`;
  const [draftValue, setDraftValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));

  useEffect(() => {
    setDraftValue(value);
    if (!editing) setEditValue(String(value));
  }, [editing, value]);

  const commit = (nextValue: number) => {
    const normalised = normaliseSliderValue(nextValue, min, max, step);
    setDraftValue(normalised);
    setEditValue(String(normalised));
    onCommit(normalised);
  };

  const finishEditing = () => {
    const parsed = Number(editValue);
    if (Number.isFinite(parsed)) commit(parsed);
    else setEditValue(String(value));
    setEditing(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <label className="text-xs" htmlFor={inputId} style={{ color: 'var(--gx-text)' }}>
          {label}
        </label>
        {editing ? (
          <span className="image-property-value-editor">
            <input
              type="number"
              inputMode="numeric"
              aria-label={`${label} value`}
              min={min}
              max={max}
              step={step}
              value={editValue}
              onChange={event => setEditValue(event.target.value)}
              onBlur={finishEditing}
              onKeyDown={event => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setEditValue(String(value));
                  setEditing(false);
                }
              }}
              className="image-property-value-input"
              autoFocus
              onFocus={event => event.currentTarget.select()}
            />
            <span aria-hidden="true">px</span>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Edit ${label} value`}
            className="image-property-value"
            onClick={() => setEditing(true)}
            title={`Click to enter ${label.toLowerCase()}`}
          >
            <span>{draftValue}px</span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-9.3 9.3-3.8 1 1-3.8 9.3-9.3Zm-8 10.1-.4 1.6 1.6-.4 7.8-7.8-1.2-1.2-7.8 7.8Z" />
            </svg>
          </button>
        )}
      </div>
      <input
        id={inputId}
        aria-label={`${label} slider`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draftValue}
        onChange={event => setDraftValue(Number(event.target.value))}
        onPointerUp={event => commit(Number(event.currentTarget.value))}
        onPointerCancel={event => commit(Number(event.currentTarget.value))}
        onKeyUp={event => commit(Number(event.currentTarget.value))}
        onBlur={event => commit(Number(event.currentTarget.value))}
        className="image-property-range w-full h-1.5 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
      />
      {hint && <span className="text-xs" style={{ color: 'var(--gx-text-muted)', opacity: 0.7 }}>{hint}</span>}
    </div>
  );
}

export default function ImageProperties({ config, onChange }: ImagePropertiesProps) {
  const [tab, setTab] = useState<'rings' | 'fonts' | null>(null);

  const handleChange = (key: keyof ImagePropertiesConfig, value: number | string | boolean) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 text-xs">
        {(['rings', 'fonts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(tab === t ? null : t)}
            className="px-3 py-1 rounded-t transition-colors"
            style={{
              color: tab === t ? 'var(--gx-accent)' : 'var(--gx-text-muted)',
              borderBottom: tab === t ? '2px solid var(--gx-accent)' : '2px solid transparent',
            }}
          >
            {t === 'rings' ? 'Rings' : 'Fonts'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'rings' && (
        <div className="space-y-3 pt-3">
          <PropertySlider label="Inner Radius" value={config.innerRadius} min={100} max={300} step={10} onCommit={value => handleChange('innerRadius', value)} />
          <PropertySlider label="Ring Width" value={config.ringWidth} min={5} max={100} hint="Alignment rings" onCommit={value => handleChange('ringWidth', value)} />
          <PropertySlider label="GC Ring Width" value={config.gcRingWidth} min={20} max={100} step={5} hint="GC Content & Skew" onCommit={value => handleChange('gcRingWidth', value)} />
          <PropertySlider label="Ring Spacing" value={config.ringSpacing} min={2} max={20} onCommit={value => handleChange('ringSpacing', value)} />
        </div>
      )}

      {tab === 'fonts' && (
        <div className="space-y-3 pt-3">
          <PropertySlider label="Legend Font" value={config.legendFontSize} min={8} max={20} onCommit={value => handleChange('legendFontSize', value)} />
          <PropertySlider label="Scale Font" value={config.scaleFontSize} min={8} max={18} onCommit={value => handleChange('scaleFontSize', value)} />
          <PropertySlider label="Title Font" value={config.titleFontSize} min={12} max={40} step={2} onCommit={value => handleChange('titleFontSize', value)} />
          <PropertySlider label="Label Font" value={config.labelFontSize} min={8} max={24} onCommit={value => handleChange('labelFontSize', value)} />
        </div>
      )}
    </div>
  );
}
