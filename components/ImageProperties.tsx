'use client';

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
}

interface ImagePropertiesProps {
  config: ImagePropertiesConfig;
  onChange: (config: ImagePropertiesConfig) => void;
}

export default function ImageProperties({ config, onChange }: ImagePropertiesProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof ImagePropertiesConfig, value: number | string) => {
    onChange({
      ...config,
      [key]: value
    });
  };

  return (
    <div className="card">
      {/* Title */}
      <div className="mb-4">
        <label className="label">Title</label>
        <input
          type="text"
          value={config.title}
          onChange={(e) => handleChange('title', e.target.value)}
          placeholder="Enter plot title..."
          className="input"
        />
      </div>

      <div className="flex items-center justify-between mb-3 border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            {isOpen ? '▼' : '▶'}
          </button>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Image Properties</h3>
        </div>
      </div>
      
      {isOpen && (
        <div className="space-y-4">
          {/* Ring Dimensions */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-1">
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div>
              <label className="label">
                Default Ring Width: {config.ringWidth}px
              </label>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={config.ringWidth}
                onChange={(e) => handleChange('ringWidth', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">Alignment rings</span>
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">GC Content & Skew rings</span>
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          {/* Font Sizes */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-1">
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
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
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>          </div>
        </div>
      )}
    </div>
  );
}
