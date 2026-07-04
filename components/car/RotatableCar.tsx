'use client'

import { useRef, useState } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import * as THREE from 'three'

interface RotatableCarProps {
  modelPath: string
}

export default function RotatableCar({ modelPath }: RotatableCarProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const [isDragging, setIsDragging] = useState(false)
  const [previousPointer, setPreviousPointer] = useState({ x: 0, y: 0 })

  // Target positions
  const targetPositionX = useRef(0)
  const targetPositionY = useRef(0)

  // Load model with DRACO
  const gltf = useLoader(GLTFLoader, modelPath, (loader) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/')
    loader.setDRACOLoader(dracoLoader)
  })

  // Apply materials and setup
  const model = gltf.scene.clone()
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh
      mesh.castShadow = true
      mesh.receiveShadow = true

      if (mesh.material) {
        const mat = mesh.material as THREE.MeshStandardMaterial
        mat.envMapIntensity = 1.5
        mat.metalness = 0.9
        mat.roughness = 0.3
      }
    }
  })

  // Center model
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  model.position.sub(center)

  const handlePointerDown = (e: any) => {
    setIsDragging(true)
    setPreviousPointer({ x: e.clientX, y: e.clientY })
    e.stopPropagation()
  }

  const handlePointerMove = (e: any) => {
    if (!isDragging) return

    const deltaX = e.clientX - previousPointer.x
    const deltaY = e.clientY - previousPointer.y

    // Horizontal drag → X-axis position (left/right movement)
    targetPositionX.current += deltaX * 1

    // Vertical drag → Y-axis position (up/down movement) - clamped
    const newPositionY = targetPositionY.current - deltaY * 0.05
    targetPositionY.current = THREE.MathUtils.clamp(
      newPositionY,
      -2, // max down
      2   // max up
    )

    setPreviousPointer({ x: e.clientX, y: e.clientY })
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // Smooth damping
  useFrame(() => {
    if (!groupRef.current) return

    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      targetPositionX.current,
      0.1
    )

    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetPositionY.current,
      0.1
    )
  })

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <primitive object={model} />
    </group>
  )
}
