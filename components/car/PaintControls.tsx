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
  const initializePaint = useCarConfig((s) => s.initializePaint)

  // Get active zone config
  const activeConfig = paintConfig[activeZone]

  // Wrapper to initialize paint on first user interaction
  const handlePaintChange = (config: Parameters<typeof setPaintConfig>[0], zone?: PaintZone) => {
    initializePaint()
    setPaintConfig(config, zone)
  }

  const handleCopyZone = (zone: PaintZone) => {
    initializePaint()
    copyZoneToAll(zone)
  }

  return (
    <div className="space-y-5">
      {/* Zone Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-3">Paint Zone</label>
        <div className="flex gap-2">
          {ZONES.map((zone) => {
            const IconComponent = zone.icon
            return (
              <button
                key={zone.id}
                onClick={() => setActiveZone(zone.id)}
                className={`
                  flex-1 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  flex items-center justify-center gap-2 backdrop-blur-sm
                  ${
                    activeZone === zone.id
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-[0_4px_16px_rgba(59,130,246,0.4)] border border-blue-400/30'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
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
        onClick={() => handleCopyZone(activeZone)}
        className="w-full px-3 py-2.5 bg-white/5 text-gray-300 rounded-xl hover:bg-white/10 transition-all text-sm font-medium border border-white/10 backdrop-blur-sm"
      >
        Copy {ZONES.find((z) => z.id === activeZone)?.name} to All Zones
      </button>

      {/* Color Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-3">Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={activeConfig.color}
            onChange={(e) => handlePaintChange({ color: e.target.value })}
            className="w-16 h-16 rounded-xl border-2 border-white/20 cursor-pointer bg-white/5 backdrop-blur-sm shadow-inner"
          />
          <input
            type="text"
            value={activeConfig.color}
            onChange={(e) => handlePaintChange({ color: e.target.value })}
            className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl uppercase font-mono text-sm text-gray-200 focus:border-blue-400 focus:outline-none transition-all backdrop-blur-sm focus:bg-white/10"
            placeholder="#ff0000"
          />
        </div>
      </div>

      {/* Metalness Slider */}
      <div>
        <label className="flex justify-between text-sm font-medium text-gray-200 mb-3">
          <span>Metalness</span>
          <span className="text-blue-400 font-mono bg-white/5 px-2 py-0.5 rounded-lg">{activeConfig.metalness.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={activeConfig.metalness}
          onChange={(e) => handlePaintChange({ metalness: parseFloat(e.target.value) })}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb backdrop-blur-sm"
        />
      </div>

      {/* Roughness Slider */}
      <div>
        <label className="flex justify-between text-sm font-medium text-gray-200 mb-3">
          <span>Roughness</span>
          <span className="text-blue-400 font-mono bg-white/5 px-2 py-0.5 rounded-lg">{activeConfig.roughness.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={activeConfig.roughness}
          onChange={(e) => handlePaintChange({ roughness: parseFloat(e.target.value) })}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb backdrop-blur-sm"
        />
      </div>

      {/* Clearcoat Slider */}
      <div>
        <label className="flex justify-between text-sm font-medium text-gray-200 mb-3">
          <span>Clearcoat</span>
          <span className="text-blue-400 font-mono bg-white/5 px-2 py-0.5 rounded-lg">{activeConfig.clearcoat.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={activeConfig.clearcoat}
          onChange={(e) => handlePaintChange({ clearcoat: parseFloat(e.target.value) })}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer slider-thumb backdrop-blur-sm"
        />
      </div>

      {/* Presets */}
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-3">Presets</label>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => handlePaintChange(preset)}
              className="flex items-center gap-2 p-2.5 border border-white/10 bg-white/5 rounded-xl hover:bg-white/10 hover:border-blue-400/50 transition-all text-sm text-gray-200 backdrop-blur-sm hover:shadow-[0_4px_12px_rgba(59,130,246,0.2)]"
            >
              <div
                className="w-8 h-8 rounded-lg border-2 border-white/20 shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)]"
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
