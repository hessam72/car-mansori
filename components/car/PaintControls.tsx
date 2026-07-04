'use client'

import { useCarConfig } from '@/stores/carConfigStore'

const PRESETS = [
  { id: 'gloss-red', name: 'Gloss Red', color: '#ff0000', metalness: 0.9, roughness: 0.3, clearcoat: 1.0 },
  { id: 'satin-black', name: 'Satin Black', color: '#1a1a1a', metalness: 0.7, roughness: 0.5, clearcoat: 0.5 },
  { id: 'matte-gray', name: 'Matte Gray', color: '#666666', metalness: 0.3, roughness: 0.9, clearcoat: 0.0 },
  { id: 'chrome', name: 'Chrome', color: '#d4d4d4', metalness: 1.0, roughness: 0.1, clearcoat: 1.0 },
  { id: 'gloss-blue', name: 'Gloss Blue', color: '#0066ff', metalness: 0.9, roughness: 0.3, clearcoat: 1.0 },
  { id: 'pearl-white', name: 'Pearl White', color: '#f5f5f5', metalness: 0.8, roughness: 0.2, clearcoat: 0.9 },
]

export default function PaintControls() {
  const paintConfig = useCarConfig((s) => s.paintConfig)
  const setPaintConfig = useCarConfig((s) => s.setPaintConfig)

  return (
    <div className="space-y-6">
      {/* Color Picker */}
      <div>
        <label className="block text-sm font-medium mb-2">Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={paintConfig.color}
            onChange={(e) => setPaintConfig({ color: e.target.value })}
            className="w-16 h-16 rounded-lg border-2 border-gray-300 cursor-pointer"
          />
          <input
            type="text"
            value={paintConfig.color}
            onChange={(e) => setPaintConfig({ color: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg uppercase font-mono text-sm"
            placeholder="#ff0000"
          />
        </div>
      </div>

      {/* Metalness Slider */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Metalness: {paintConfig.metalness.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={paintConfig.metalness}
          onChange={(e) => setPaintConfig({ metalness: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Roughness Slider */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Roughness: {paintConfig.roughness.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={paintConfig.roughness}
          onChange={(e) => setPaintConfig({ roughness: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Clearcoat Slider */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Clearcoat: {paintConfig.clearcoat.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={paintConfig.clearcoat}
          onChange={(e) => setPaintConfig({ clearcoat: parseFloat(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Presets */}
      <div>
        <label className="block text-sm font-medium mb-2">Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setPaintConfig(preset)}
              className="flex items-center gap-2 p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <div
                className="w-8 h-8 rounded border border-gray-300"
                style={{ backgroundColor: preset.color }}
              />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
