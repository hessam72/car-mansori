'use client'

import { Suspense } from 'react'
import { Environment } from '@react-three/drei'

interface LightFlickerData {
  intensities: {
    key: number
    fill: number
    rim: number
    bounce: number
    ambient: number
  }
  isComplete: boolean
}

interface ConditionalEnvironmentProps {
  flickerData: LightFlickerData
}

/**
 * Conditionally renders HDR environment after light flicker completes
 */
export function ConditionalEnvironment({ flickerData }: ConditionalEnvironmentProps) {
  if (!flickerData.isComplete) return null

  return (
    <Suspense fallback={null}>
      <Environment
        files="/hdr/main_hdr.exr"
        background={false}
        environmentIntensity={0.8}
      />
    </Suspense>
  )
}
