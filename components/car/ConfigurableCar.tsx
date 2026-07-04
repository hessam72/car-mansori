'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useCarConfig } from '@/stores/carConfigStore'
import { DynamicPart } from './DynamicPart'
import * as THREE from 'three'

interface ConfigurableCarProps {
  modelPath: string
}

export default function ConfigurableCar({ modelPath }: ConfigurableCarProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const isDragging = useRef(false)
  const previousPointer = useRef({ x: 0, y: 0 })

  // Target rotation and position
  const targetRotationY = useRef(0)
  const targetPositionY = useRef(0)

  // Get paint config from store
  const paintConfig = useCarConfig((s) => s.paintConfig)

  // Load base car model with DRACO (useGLTF has built-in DRACO support)
  const gltf = useGLTF(modelPath)

  // Process car model with paint config
  const carModel = useMemo(() => {
    const clone = gltf.scene.clone(true)

    // Helper: Support both flat userData and nested userData.userdata
    const getUserData = (mesh: any, key: string) => {
      return mesh.userData?.userdata?.[key] ?? mesh.userData?.[key]
    }

    // Apply paint to body meshes
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true

        // Check if mesh is paintable (userData flag OR name matching)
        const isPaintable = getUserData(child, 'paintable') === true
        const nameMatch =
          child.material?.name?.toLowerCase().includes('body') ||
          child.material?.name?.toLowerCase().includes('paint') ||
          child.name?.toLowerCase().includes('body')

        if (isPaintable || nameMatch) {
          // Get paint zone from userData, fallback to 'body'
          const zone = (getUserData(child, 'paintZone') as 'body' | 'trim' | 'interior') || 'body'
          const zoneConfig = paintConfig[zone]

          const mat = child.material as any
          mat.color.set(zoneConfig.color)
          mat.metalness = zoneConfig.metalness
          mat.roughness = zoneConfig.roughness
          if (mat.clearcoat !== undefined) {
            mat.clearcoat = zoneConfig.clearcoat
            mat.clearcoatRoughness = 0.1
          }
          mat.needsUpdate = true
        }

        // Enhanced reflections for all materials
        if (child.material) {
          child.material.envMapIntensity = 1.5
        }
      }
    })

    // Center model
    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())
    clone.position.sub(center)

    return clone
  }, [gltf.scene, paintConfig])

  const handlePointerDown = (e: any) => {
    isDragging.current = true
    previousPointer.current = { x: e.clientX, y: e.clientY }
    e.stopPropagation()

    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
  }

  const handlePointerMove = (e: PointerEvent | any) => {
    if (!isDragging.current) return

    const deltaX = e.clientX - previousPointer.current.x
    const deltaY = e.clientY - previousPointer.current.y

    // Horizontal drag → Y-axis rotation (vitrine spin)
    targetRotationY.current += deltaX * 0.01

    // Vertical drag → Y-axis position (up/down movement) - clamped
    const newPositionY = targetPositionY.current - deltaY * 0.05
    targetPositionY.current = THREE.MathUtils.clamp(
      newPositionY,
      0,   // floor level (prevent going through floor at -0.8)
      1.5  // max up
    )

    previousPointer.current = { x: e.clientX, y: e.clientY }
  }

  const handlePointerUp = () => {
    isDragging.current = false

    document.removeEventListener('pointermove', handlePointerMove)
    document.removeEventListener('pointerup', handlePointerUp)
  }

  // Smooth damping
  useFrame(() => {
    if (!groupRef.current) return

    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotationY.current,
      0.1
    )

    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      targetPositionY.current,
      0.1
    )
  })

  // Part categories to render
  const partCategories = [
    'wheels',
    'spoilers',
    'hoods',
    'bumpers',
    'mirrors',
    'exhaust',
    'side-skirts',
  ]

  return (
    <group ref={groupRef} onPointerDown={handlePointerDown}>
      <primitive object={carModel} />

      {/* Render dynamic parts for each category */}
      {partCategories.map((category) => (
        <DynamicPart
          key={category}
          category={category}
          baseCarScene={carModel}
        />
      ))}
    </group>
  )
}
