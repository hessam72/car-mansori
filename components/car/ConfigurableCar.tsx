'use client'

import { useRef, useMemo, Suspense } from 'react'
import { useGLTF } from '@react-three/drei'
import { useCarConfig } from '@/stores/carConfigStore'
import { DynamicPart } from './DynamicPart'
import { PartErrorBoundary } from './PartErrorBoundary'
import * as THREE from 'three'

interface ConfigurableCarProps {
  modelPath: string
}

export default function ConfigurableCar({ modelPath }: ConfigurableCarProps) {
  const groupRef = useRef<THREE.Group>(null!)

  // Get paint config and error handler from store
  const paintConfig = useCarConfig((s) => s.paintConfig)
  const setPartError = useCarConfig((s) => s.setPartError)

  // Handle part loading errors
  const handlePartError = (category: string, error: Error) => {
    setPartError(category, error.message)
  }

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
    <group ref={groupRef}>
      <primitive object={carModel} />

      {/* Render dynamic parts for each category */}
      {partCategories.map((category) => (
        <Suspense key={category} fallback={null}>
          <PartErrorBoundary category={category} onError={handlePartError}>
            <DynamicPart
              category={category}
              baseCarScene={carModel}
            />
          </PartErrorBoundary>
        </Suspense>
      ))}
    </group>
  )
}
