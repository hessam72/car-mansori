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
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={3}
        shadow-camera-far={25}
        shadow-bias={-0.0001}
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
        color="#88aaff"
      />

      {/* Ground bounce light - realistic reflected light from floor */}
      <pointLight
        position={[0, 0.5, 0]}
        intensity={40}
        distance={6}
        decay={2}
        color="#ffeedd"
      />

      {/* Ambient fill */}
      <ambientLight intensity={0.3} />
    </>
  )
}
