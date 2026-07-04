export default function CarLighting() {
  return (
    <>
      {/* Key Light - Main illumination from front-right */}
      <spotLight
        position={[5, 8, 5]}
        intensity={150}
        angle={0.5}
        penumbra={0.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      {/* Fill Light - Soften shadows from left */}
      <spotLight
        position={[-5, 5, 3]}
        intensity={60}
        angle={0.6}
        penumbra={0.7}
      />

      {/* Rim Light - Edge highlight from back */}
      <spotLight
        position={[0, 4, -6]}
        intensity={80}
        angle={0.4}
        penumbra={0.6}
      />

      {/* Ambient fill */}
      <ambientLight intensity={0.3} />
    </>
  )
}
