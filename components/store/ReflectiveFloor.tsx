import { MeshReflectorMaterial } from '@react-three/drei'
interface ReflectiveFloorProps {
  size?: number
  mixStrength?: number
  blur?: number
  roughness?: number
  opacity?: number
  resolution?: number
}

export function ReflectiveFloor({
  size = 60,
  mixStrength = 0.85,
  blur = 0.3,
  roughness = 0.62,
  opacity = 1,
  resolution = 1024,
}: ReflectiveFloorProps) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -.9, 0]}
      // receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        resolution={resolution}
        mixBlur={0}
        mixStrength={mixStrength}
        mirror={0.6}
        depthScale={4}
        minDepthThreshold={0}
        maxDepthThreshold={.5}
        roughness={1}
        metalness={.6}
        color="#3f3d39"
        // transparent
        opacity={1}
      />
    </mesh>
  )
}