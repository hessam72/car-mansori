import { MeshReflectorMaterial } from '@react-three/drei'

interface ReflectiveFloorProps {
  size?: number
  mixStrength?: number
  /** Maps to MeshReflectorMaterial mixBlur */
  blur?: number
  roughness?: number
  opacity?: number
  resolution?: number
  /** When false, renders a plain matte floor — skips the per-frame reflection render pass entirely */
  enabled?: boolean
}

// NOTE: prop defaults intentionally equal the values that used to be
// hardcoded in the JSX (roughness 1, mixBlur 0) so existing consumers
// (/store Scene, homepage hero, /car) render identically now that the
// props are actually honored.
export function ReflectiveFloor({
  size = 60,
  mixStrength = 0.85,
  blur = 0,
  roughness = 1,
  opacity = 1,
  resolution = 1024,
  enabled = true,
}: ReflectiveFloorProps) {
  return (
    <mesh
      name="reflective-floor"
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -.9, 0]}
      // receiveShadow
    >
      <planeGeometry args={[size, size]} />
      {enabled ? (
        <MeshReflectorMaterial
          resolution={resolution}
          mixBlur={blur}
          mixStrength={mixStrength}
          mirror={0.6}
          depthScale={4}
          minDepthThreshold={0}
          maxDepthThreshold={.5}
          roughness={roughness}
          metalness={.6}
          color="#3f3d39"
          opacity={opacity}
        />
      ) : (
        // Same base look without the reflection FBO — used by low quality tier
        <meshStandardMaterial color="#3f3d39" metalness={0.6} roughness={1} />
      )}
    </mesh>
  )
}
