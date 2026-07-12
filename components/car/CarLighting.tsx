'use client'

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

interface CarLightingProps {
  flickerData?: LightFlickerData
}

// Base intensities (stable state)
const BASE_INTENSITIES = {
  key: 70,
  fill: 40,
  rim: 80,
  bounce: 40,
}

export default function CarLighting({ flickerData }: CarLightingProps) {
  // Use provided flicker data or default to full brightness
  const data = flickerData ?? { intensities: { key: 1, fill: 1, rim: 1, bounce: 1, ambient: 0.3 }, isComplete: true }
  const flickerMultipliers = data.intensities

  return (
    <>
      {/* Key Light - Main illumination from front-right */}
      <spotLight
        position={[5, 8, 5]}
        intensity={BASE_INTENSITIES.key * flickerMultipliers.key}
        angle={0.5}
        penumbra={0.5}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-near={3}
        shadow-camera-far={25}
        shadow-bias={-0.001}
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

      {/* PERMANENT REFLECTION LIGHTS - Always on, not affected by flicker */}

 
    </>
  )
}
