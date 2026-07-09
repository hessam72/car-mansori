'use client'

import { useRef, useMemo, useEffect, Suspense } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCarConfig, PaintZone } from '@/stores/carConfigStore'
import { DynamicPart } from './DynamicPart'
import { PartErrorBoundary } from './PartErrorBoundary'
import { DoorController } from '@/lib/DoorController'
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
  const doorControllerRef = useRef<DoorController | null>(null)

  const paintConfig = useCarConfig((s) => s.paintConfig)
  const setPartError = useCarConfig((s) => s.setPartError)
  const openParts = useCarConfig((s) => s.openParts)

  const handlePartError = (category: string, error: Error) => {
    setPartError(category, error.message)
  }

  const gltf = useGLTF(modelPath)

  // Clone + center the car ONCE per model. Paintable materials are cloned here
  // (so we never mutate drei's shared cache) and collected for the paint effect.
  const { carModel, paintTargets } = useMemo(() => {
    const clone = gltf.scene.clone(true)
    const targets: PaintTarget[] = []

    // Center model
    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())
    clone.position.sub(center)

    const getUserData = (mesh: any, key: string) => {
      return mesh.userData?.userdata?.[key] ?? mesh.userData?.[key]
    }

    // Set shadows and collect paintable materials
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material) {
          child.material.envMapIntensity = 1.5
        }

        const paintableValue = getUserData(child, 'paintable')
        const isPaintable = paintableValue === true || paintableValue === 1
        const nameMatch =
          child.material?.name?.toLowerCase().includes('body') ||
          child.material?.name?.toLowerCase().includes('paint') ||
          child.name?.toLowerCase().includes('body')

        if (isPaintable || nameMatch) {
          const zone = (getUserData(child, 'paintZone') as PaintZone) || 'body'
          child.material = (child.material as THREE.Material).clone()
          targets.push({ material: child.material as THREE.MeshPhysicalMaterial, zone })
        }
      }
    })

    return { carModel: clone, paintTargets: targets }
  }, [gltf.scene])

  // Apply paint by mutating the cached materials in place
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

  // Initialize DoorController after car model loads
  useEffect(() => {
    if (!carModel) {
      console.log('[ConfigurableCar] Car model not ready yet')
      return
    }

    console.log('[ConfigurableCar] Car model loaded, initializing DoorController...')
    try {
      const controller = new DoorController(carModel, {
        doorAngleDeg: 70,
        hoodAngleDeg: 45,
        trunkAngleDeg: 80,
        durationSec: 1.2,
      })
      doorControllerRef.current = controller
      console.log('[ConfigurableCar] ✓ DoorController initialized successfully')
      console.log('[ConfigurableCar] ✓ Controller ref set:', !!doorControllerRef.current)
    } catch (error) {
      console.error('[ConfigurableCar] ✗ DoorController initialization failed:', error)
    }

    // Don't cleanup - keep controller alive for entire component lifecycle
  }, [carModel])

  // React to openParts state changes
  useEffect(() => {
    if (!doorControllerRef.current) {
      console.log('[ConfigurableCar] State changed but controller not ready')
      return
    }

    console.log('[ConfigurableCar] openParts state changed:', openParts)
    const controller = doorControllerRef.current

    controller.openLeftFrontDoor(openParts.car_door_left)
    controller.openRightFrontDoor(openParts.car_door_right)
    controller.openLeftBackDoor(openParts.car_door_back_left)
    controller.openRightBackDoor(openParts.car_door_back_right)
    controller.openHood(openParts.car_caput)
    controller.openTrunk(openParts.car_trunk)
  }, [openParts])

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
