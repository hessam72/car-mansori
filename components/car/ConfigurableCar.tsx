'use client'

import { useRef, useMemo, useEffect, Suspense } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCarConfig, PaintZone } from '@/stores/carConfigStore'
import { DynamicPart } from './DynamicPart'
import { PartErrorBoundary } from './PartErrorBoundary'
import * as THREE from 'three'

// Use the local DRACO decoder instead of drei's default CDN
useGLTF.setDecoderPath('/draco/')

interface ConfigurableCarProps {
  modelPath: string
}

interface PaintTarget {
  material: THREE.MeshPhysicalMaterial
  zone: PaintZone
}

export default function ConfigurableCar({ modelPath }: ConfigurableCarProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const invalidate = useThree((s) => s.invalidate)

  const paintConfig = useCarConfig((s) => s.paintConfig)
  const setPartError = useCarConfig((s) => s.setPartError)

  const handlePartError = (category: string, error: Error) => {
    setPartError(category, error.message)
  }

  const gltf = useGLTF(modelPath)

  // Clone + center the car ONCE per model. Paintable materials are cloned here
  // (so we never mutate drei's shared cache) and collected for the paint effect.
  const { carModel, paintTargets } = useMemo(() => {
    const clone = gltf.scene.clone(true)
    const targets: PaintTarget[] = []

    // Helper: Support both flat userData and nested userData.userdata
    const getUserData = (mesh: any, key: string) => {
      return mesh.userData?.userdata?.[key] ?? mesh.userData?.[key]
    }

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
          const zone = (getUserData(child, 'paintZone') as PaintZone) || 'body'
          child.material = (child.material as THREE.Material).clone()
          targets.push({ material: child.material as THREE.MeshPhysicalMaterial, zone })
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

    return { carModel: clone, paintTargets: targets }
  }, [gltf.scene])

  // Apply paint by mutating the cached materials in place — no re-clone,
  // no traverse, no re-attach of DynamicParts.
  useEffect(() => {
    paintTargets.forEach(({ material, zone }) => {
      const zoneConfig = paintConfig[zone]
      material.color.set(zoneConfig.color)
      material.metalness = zoneConfig.metalness
      material.roughness = zoneConfig.roughness
      if (material.clearcoat !== undefined) {
        material.clearcoat = zoneConfig.clearcoat
        material.clearcoatRoughness = 0.1
      }
    })
    invalidate()
  }, [paintConfig, paintTargets, invalidate])

  // Dispose the per-car cloned paint materials when the model changes/unmounts
  useEffect(() => {
    return () => {
      paintTargets.forEach(({ material }) => material.dispose())
    }
  }, [paintTargets])

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
