

import { useState } from 'react';

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

export default function ImageProperties({ config, onChange }: ImagePropertiesProps) {
  const [tab, setTab] = useState<'rings' | 'fonts' | null>(null);

  const handleChange = (key: keyof ImagePropertiesConfig, value: number | string | boolean) => {
    onChange({ ...config, [key]: value });
  };

  const Slider = ({ label, field, min, max, step = 1, hint }: {
    label: string; field: keyof ImagePropertiesConfig; min: number; max: number; step?: number; hint?: string;
  }) => (
    <div>
      <div className="flex justify-between items-center">
        <label className="text-xs" style={{ color: 'var(--gx-text)' }}>{label}</label>
        <span className="text-xs font-mono" style={{ color: 'var(--gx-text-muted)' }}>{config[field] as number}px</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={config[field] as number}
        onChange={(e) => handleChange(field, parseInt(e.target.value))}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
        style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
      />
      {hint && <span className="text-xs" style={{ color: 'var(--gx-text-muted)', opacity: 0.7 }}>{hint}</span>}
    </div>
  );

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
          <Slider label="Inner Radius" field="innerRadius" min={100} max={300} step={10} />
          <Slider label="Ring Width" field="ringWidth" min={5} max={100} hint="Alignment rings" />
          <Slider label="GC Ring Width" field="gcRingWidth" min={20} max={100} step={5} hint="GC Content & Skew" />
          <Slider label="Ring Spacing" field="ringSpacing" min={2} max={20} />
        </div>
      )}

      {tab === 'fonts' && (
        <div className="space-y-3 pt-3">
          <Slider label="Legend Font" field="legendFontSize" min={8} max={20} />
          <Slider label="Scale Font" field="scaleFontSize" min={8} max={18} />
          <Slider label="Title Font" field="titleFontSize" min={12} max={40} step={2} />
          <Slider label="Label Font" field="labelFontSize" min={8} max={24} />
        </div>
      )}
    </div>
  );
}
