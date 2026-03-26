'use client';


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
  const handleChange = (key: keyof ImagePropertiesConfig, value: number | string | boolean) => {
    onChange({
      ...config,
      [key]: value
    });
  };

  return (
    <div className="space-y-4">
          {/* Ring Dimensions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold pb-1" style={{ color: 'var(--gx-text)', borderBottom: '1px solid var(--gx-border)' }}>
              Ring Dimensions
            </h4>

            <div>
              <label className="label">
                Inner Radius: {config.innerRadius}px
              </label>
              <input
                type="range"
                min="100"
                max="300"
                step="10"
                value={config.innerRadius}
                onChange={(e) => handleChange('innerRadius', parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
              />
            </div>

            <div>
              <label className="label">
                Default Ring Width: {config.ringWidth}px
              </label>
              <input
                type="range"
                min="5"
                max="100"
                step="1"
                value={config.ringWidth}
                onChange={(e) => handleChange('ringWidth', parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
              />
              <span className="text-xs" style={{ color: 'var(--gx-text-muted)' }}>Alignment rings</span>
            </div>

            <div>
              <label className="label">
                GC Ring Width: {config.gcRingWidth}px
              </label>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={config.gcRingWidth}
                onChange={(e) => handleChange('gcRingWidth', parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
              />
              <span className="text-xs" style={{ color: 'var(--gx-text-muted)' }}>GC Content & Skew rings</span>
            </div>

            <div>
              <label className="label">
                Ring Spacing: {config.ringSpacing}px
              </label>
              <input
                type="range"
                min="2"
                max="20"
                step="1"
                value={config.ringSpacing}
                onChange={(e) => handleChange('ringSpacing', parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
              />
            </div>
          </div>

          {/* Font Sizes */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold pb-1" style={{ color: 'var(--gx-text)', borderBottom: '1px solid var(--gx-border)' }}>
              Font Sizes
            </h4>

            <div>
              <label className="label">
                Legend Font: {config.legendFontSize}px
              </label>
              <input
                type="range"
                min="8"
                max="20"
                step="1"
                value={config.legendFontSize}
                onChange={(e) => handleChange('legendFontSize', parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
              />
            </div>

            <div>
              <label className="label">
                Scale Font: {config.scaleFontSize}px
              </label>
              <input
                type="range"
                min="8"
                max="18"
                step="1"
                value={config.scaleFontSize}
                onChange={(e) => handleChange('scaleFontSize', parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
              />
            </div>

            <div>
              <label className="label">
                Title Font: {config.titleFontSize}px
              </label>
              <input
                type="range"
                min="12"
                max="40"
                step="2"
                value={config.titleFontSize}
                onChange={(e) => handleChange('titleFontSize', parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
              />
            </div>
            <div>
              <label className="label">
                Annotation Label Font: {config.labelFontSize}px
              </label>
              <input
                type="range"
                min="8"
                max="24"
                step="1"
                value={config.labelFontSize}
                onChange={(e) => handleChange('labelFontSize', parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--gx-accent)', background: 'var(--gx-bg)' }}
              />
            </div>
          </div>
    </div>
  );
}
