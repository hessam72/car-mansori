'use client'

import { useQuality } from '@/contexts/QualityContext'
import { QualityPreset } from '@/lib/config/quality'

const QUALITY_LABELS: Record<QualityPreset, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
}

export default function QualitySelector() {
  const { preset, setPreset } = useQuality()

  return (
    <div className="absolute top-4 right-4 z-10 bg-black/50 backdrop-blur-sm rounded-lg p-3">
      <div className="flex flex-col gap-2">
        <span className="text-white text-sm font-medium mb-1">Graphics Quality</span>
        <div className="flex gap-2">
          {(Object.keys(QUALITY_LABELS) as QualityPreset[]).map((quality) => (
            <button
              key={quality}
              onClick={() => setPreset(quality)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                preset === quality
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              {QUALITY_LABELS[quality]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
