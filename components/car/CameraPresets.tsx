'use client'

import { useCameraStore, CAMERA_PRESETS, PresetName } from '@/stores/cameraStore'
import { Camera, RotateCcw, Home } from 'lucide-react'

export default function CameraPresets() {
  const { activePreset, setPreset, autoRotate, setAutoRotate } = useCameraStore()

  const presets: PresetName[] = ['front', 'rear', 'sideLeft', 'sideRight', 'top', 'detail']

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10">
        {/* Controls row */}
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">Auto Rotate</span>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                autoRotate
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setPreset('home')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all flex items-center gap-1.5"
          >
            <Home className="w-4 h-4" />
            <span>Reset</span>
          </button>
        </div>

        {/* Camera presets */}
        <div className="flex gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              onClick={() => setPreset(preset)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activePreset === preset
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                  : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                {CAMERA_PRESETS[preset].label}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
