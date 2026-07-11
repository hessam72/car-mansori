'use client'

import { MotionValue } from 'framer-motion'
import { useLightFlicker } from '@/hooks/useLightFlicker'

interface CarLightingProps {
  scrollProgress?: MotionValue<number>
}

// Base intensities (stable state)
const BASE_INTENSITIES = {
  key: 150,
  fill: 60,
  rim: 80,
  bounce: 40,
}

export default function CarLighting({ scrollProgress }: CarLightingProps) {
  // Get flicker multipliers (0→1) + ambient intensity if scroll progress provided
  const flickerMultipliers = scrollProgress
    ? useLightFlicker(scrollProgress)
    : { key: 1, fill: 1, rim: 1, bounce: 1, ambient: 0.3 }

  return (
    <>
      {/* Key Light - Main illumination from front-right */}
      <spotLight
        position={[5, 8, 5]}
        intensity={BASE_INTENSITIES.key * flickerMultipliers.key}
        angle={0.5}
        penumbra={0.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={3}
        shadow-camera-far={25}
        shadow-bias={-0.0001}
      />

      {/* Fill Light - Soften shadows from left */}
      <spotLight
        position={[-5, 5, 3]}
        intensity={BASE_INTENSITIES.fill * flickerMultipliers.fill}
        angle={0.6}
        penumbra={0.7}
      />

      {/* Rim Light - Edge highlight from back */}
      <spotLight
        position={[0, 4, -6]}
        intensity={BASE_INTENSITIES.rim * flickerMultipliers.rim}
        angle={0.4}
        penumbra={0.6}
        color="#88aaff"
      />

      {/* Ground bounce light - realistic reflected light from floor */}
      <pointLight
        position={[0, 0.5, 0]}
        intensity={BASE_INTENSITIES.bounce * flickerMultipliers.bounce}
        distance={6}
        decay={2}
        color="#ffeedd"
      />

      {/* Ambient fill - smooth fade, no flicker */}
      <ambientLight intensity={flickerMultipliers.ambient} />
    </>
  )
}
