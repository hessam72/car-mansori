'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useGLTF } from '@react-three/drei'
import CustomizationPanel from '@/components/car/CustomizationPanel'
import QualitySelector from '@/components/car/QualitySelector'
import partsConfig from '@/public/config/car-parts.json'
import { useCarConfig } from '@/stores/carConfigStore'
import { isARCapable } from '@/lib/device-utils'
import { QualityProvider } from '@/contexts/QualityContext'

// Use the local DRACO decoder instead of drei's default CDN — this runs
// before any preload in this chunk (CustomizationPanel included)
useGLTF.setDecoderPath('/draco/')

const CarTuningScene = dynamic(() => import('@/components/car/CarTuningScene'), {
  ssr: false,
})

const ARCarViewer = dynamic(() => import('@/components/car/ARCarViewer'), {
  ssr: false,
})

export interface Car {
  id: string
  name: string
  name_fa: string
  model_path: string
  usdz_path: string
  specs: {
    engine: string
    horsepower: number
    torque: string
    top_speed: string
  }
}

const DEFAULT_PARTS: Record<string, string> = {
  wheels: 'wheel-stock',
  spoilers: 'spoiler-stock',
  hoods: 'hood-stock',
  bumpers: 'bumper-front-stock',
  mirrors: 'mirror-stock',
  exhaust: 'exhaust-stock',
  'side-skirts': 'skirts-none',
}

export default function CarPageClient({ car }: { car: Car | null }) {
  const [showAR, setShowAR] = useState(false)
  const [arSupported, setArSupported] = useState(false)
  const resetConfig = useCarConfig((s) => s.resetConfig)

  useEffect(() => {
    setArSupported(isARCapable())
  }, [])

  useEffect(() => {
    if (!car) return

    resetConfig(DEFAULT_PARTS)

    // Warm the drei cache: base car + the stock parts the scene renders first
    useGLTF.preload(car.model_path)
    Object.entries(DEFAULT_PARTS).forEach(([category, partId]) => {
      const parts: any[] = partsConfig[category as keyof typeof partsConfig] || []
      const part = parts.find((p) => p.id === partId)
      if (part?.model_path) useGLTF.preload(part.model_path)
    })
  }, [car, resetConfig])

  if (!car) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        Car not found
      </div>
    )
  }

  return (
    <QualityProvider>
      <div className="h-screen w-screen overflow-hidden relative">
        <CarTuningScene modelPath={car.model_path} />

        {/* Car Info Overlay */}
        <div className="absolute top-8 left-8 text-white pointer-events-none z-5">
          <h1 className="text-4xl font-bold mb-2">{car.name}</h1>
          <p className="text-xl text-gray-300">{car.name_fa}</p>
        </div>

        {/* Quality Selector */}
        <QualitySelector />

        {/* Customization Panel */}
        <CustomizationPanel />

      {/* AR Button */}
      {arSupported && (
        <button
          onClick={() => setShowAR(true)}
          className="fixed bottom-32 right-8 px-6 py-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 z-10"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
          View in AR
        </button>
      )}

      {/* AR Viewer Modal */}
      {showAR && (
        <ARCarViewer
          glbPath={car.model_path}
          usdzPath={car.usdz_path}
          carName={car.name}
          carNameFa={car.name_fa}
          onClose={() => setShowAR(false)}
        />
      )}
      </div>
    </QualityProvider>
  )
}
