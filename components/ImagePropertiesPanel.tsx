

import ImageProperties, { type ImagePropertiesConfig } from '@/components/ImageProperties';

interface ImagePropertiesPanelProps {
  imageProperties: ImagePropertiesConfig;
  onChange: (config: ImagePropertiesConfig) => void;
}

export default function ImagePropertiesPanel({ imageProperties, onChange }: ImagePropertiesPanelProps) {
  return (
    <div className="card mb-6">
      <h2 className="section-title">Image Properties</h2>
      <div className="flex items-center gap-4 mb-3">
        <input
          type="text"
          value={imageProperties.title}
          onChange={(e) => onChange({ ...imageProperties, title: e.target.value })}
          placeholder="Plot title..."
          className="input-field flex-1 text-sm"
        />
        <label className="flex items-center gap-1.5 cursor-pointer text-xs whitespace-nowrap" style={{ color: 'var(--gx-text-muted)' }}>
          <input
            type="checkbox"
            checked={imageProperties.showLegend !== false}
            onChange={(e) => onChange({ ...imageProperties, showLegend: e.target.checked })}
            className="w-3.5 h-3.5"
            style={{ accentColor: 'var(--gx-accent)' }}
          />
          Legend
        </label>
      </div>
      <ImageProperties config={imageProperties} onChange={onChange} />
    </div>
  );
}
