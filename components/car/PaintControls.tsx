'use client'

import { useCarConfig, type PaintZone } from '@/stores/carConfigStore'
import { IoCarSport } from 'react-icons/io5'
import { MdAutoAwesome } from 'react-icons/md'
import { GiCarSeat } from 'react-icons/gi'

const ZONES: { id: PaintZone; name: string; icon: any }[] = [
  { id: 'body', name: 'Body', icon: IoCarSport },
  { id: 'trim', name: 'Trim', icon: MdAutoAwesome },
  { id: 'interior', name: 'Interior', icon: GiCarSeat },
]

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
  const activeZone = useCarConfig((s) => s.activeZone)
  const setActiveZone = useCarConfig((s) => s.setActiveZone)
  const setPaintConfig = useCarConfig((s) => s.setPaintConfig)
  const copyZoneToAll = useCarConfig((s) => s.copyZoneToAll)

  // Get active zone config
  const activeConfig = paintConfig[activeZone]

  return (
    <div className="space-y-5">
      {/* Zone Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Paint Zone</label>
        <div className="flex gap-2">
          {ZONES.map((zone) => {
            const IconComponent = zone.icon
            return (
              <button
                key={zone.id}
                onClick={() => setActiveZone(zone.id)}
                className={`
                  flex-1 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  flex items-center justify-center gap-2
                  ${
                    activeZone === zone.id
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                  }
                `}
              >
                <IconComponent className="text-base" />
                {zone.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Copy to All Zones Button */}
      <button
        onClick={() => copyZoneToAll(activeZone)}
        className="w-full px-3 py-2.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-all text-sm font-medium border border-gray-700"
      >
        Copy {ZONES.find((z) => z.id === activeZone)?.name} to All Zones
      </button>

      {/* Color Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={activeConfig.color}
            onChange={(e) => setPaintConfig({ color: e.target.value })}
            className="w-16 h-16 rounded-lg border-2 border-gray-700 cursor-pointer bg-gray-800"
          />
          <input
            type="text"
            value={activeConfig.color}
            onChange={(e) => setPaintConfig({ color: e.target.value })}
            className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg uppercase font-mono text-sm text-gray-200 focus:border-blue-500 focus:outline-none transition-colors"
            placeholder="#ff0000"
          />
        </div>
      </div>

      {/* Metalness Slider */}
      <div>
        <label className="flex justify-between text-sm font-medium text-gray-300 mb-3">
          <span>Metalness</span>
          <span className="text-blue-400 font-mono">{activeConfig.metalness.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={activeConfig.metalness}
          onChange={(e) => setPaintConfig({ metalness: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
        />
      </div>

      {/* Roughness Slider */}
      <div>
        <label className="flex justify-between text-sm font-medium text-gray-300 mb-3">
          <span>Roughness</span>
          <span className="text-blue-400 font-mono">{activeConfig.roughness.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={activeConfig.roughness}
          onChange={(e) => setPaintConfig({ roughness: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
        />
      </div>

      {/* Clearcoat Slider */}
      <div>
        <label className="flex justify-between text-sm font-medium text-gray-300 mb-3">
          <span>Clearcoat</span>
          <span className="text-blue-400 font-mono">{activeConfig.clearcoat.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={activeConfig.clearcoat}
          onChange={(e) => setPaintConfig({ clearcoat: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb"
        />
      </div>

      {/* Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setPaintConfig(preset)}
              className="flex items-center gap-2 p-2.5 border border-gray-700 bg-gray-800 rounded-lg hover:bg-gray-700 hover:border-blue-500 transition-all text-sm text-gray-200"
            >
              <div
                className="w-8 h-8 rounded border-2 border-gray-600 shadow-inner"
                style={{ backgroundColor: preset.color }}
              />
              <span className="text-xs">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
