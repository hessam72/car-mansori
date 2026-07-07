'use client'

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { OrbitControls } from '@react-three/drei'
import { useCameraStore } from '@/stores/cameraStore'
import { useSpring, config } from '@react-spring/three'
import * as THREE from 'three'

export default function CameraControls() {
  const controlsRef = useRef<OrbitControlsImpl>(null!)
  const { camera } = useThree()

  const { targetPosition, targetLookAt, autoRotate, autoRotateSpeed, clearTransition } = useCameraStore()

  // Animated camera transition with react-spring
  const [{ position, lookAt }, api] = useSpring(() => ({
    position: camera.position.toArray(),
    lookAt: [0, 0.5, 0],
    config: { tension: 120, friction: 14 }
  }))

  // Trigger animation when target changes
  useEffect(() => {
    if (targetPosition && targetLookAt && controlsRef.current) {
      api.start({
        position: targetPosition.toArray(),
        lookAt: targetLookAt.toArray(),
        onRest: () => {
          clearTransition()
        }
      })
    }
  }, [targetPosition, targetLookAt, api, clearTransition])

  // Apply animated values to camera and controls
  useFrame(() => {
    if (controlsRef.current) {
      // @ts-ignore - react-spring animated values
      camera.position.set(...position.get())
      // @ts-ignore
      controlsRef.current.target.set(...lookAt.get())
      controlsRef.current.update()
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={2}
      maxDistance={12}
      maxPolarAngle={Math.PI / 2}
      autoRotate={autoRotate}
      autoRotateSpeed={autoRotateSpeed}
      target={[0, 0.5, 0]}
    />
  )
}
