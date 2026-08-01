'use client'

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useFurnitureConfig } from '@/stores/furnitureConfigStore'
import * as THREE from 'three'

interface PaintTarget {
  material: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial
  initialColor: THREE.Color
}

export function FurnitureColorApplier() {
  const { scene, invalidate } = useThree()
  const selectedFurnitureId = useFurnitureConfig((s) => s.selectedFurnitureId)
  const currentColor = useFurnitureConfig((s) => s.currentColor)
  const colorInitialized = useFurnitureConfig((s) => s.colorInitialized)
  const setColorTransitioning = useFurnitureConfig((s) => s.setColorTransitioning)

  const paintTargetsRef = useRef<PaintTarget[]>([])
  const firstPaintRef = useRef(true)
  const paintAnimatingRef = useRef(false)
  const paintScratchRef = useRef(new THREE.Color())

  // Collect paintable materials when furniture is selected
  useEffect(() => {
    if (!selectedFurnitureId) {
      paintTargetsRef.current = []
      return
    }

    const targets: PaintTarget[] = []
    const furnitureIdLower = selectedFurnitureId.toLowerCase()

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const childName = child.name.toLowerCase()

        // Check if this mesh belongs to the selected furniture
        if (childName.includes(furnitureIdLower)) {
          const getUserData = (mesh: any, key: string) => {
            return mesh.userData?.userdata?.[key] ?? mesh.userData?.[key]
          }

          const paintableValue = getUserData(child, 'paintable')
          const isPaintable = paintableValue === true || paintableValue === 1

          // Consider mesh paintable if it has paintable flag or name suggests it
          const nameMatch =
            child.material?.name?.toLowerCase().includes('fabric') ||
            child.material?.name?.toLowerCase().includes('cushion') ||
            child.material?.name?.toLowerCase().includes('upholstery') ||
            childName.includes('cushion') ||
            childName.includes('seat') ||
            childName.includes('fabric')

          if (isPaintable || nameMatch) {
            // Clone material to avoid affecting other instances
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material
              child.material = (child.material as THREE.Material).clone()
            }

            const material = child.material as THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial
            targets.push({
              material,
              initialColor: material.color.clone(),
            })
          }
        }
      }
    })

    paintTargetsRef.current = targets
    firstPaintRef.current = true
  }, [selectedFurnitureId, scene])

  // Apply color change
  useEffect(() => {
    if (!colorInitialized || !currentColor || paintTargetsRef.current.length === 0) return

    paintTargetsRef.current.forEach(({ material }) => {
      if (firstPaintRef.current) {
        // Instant first coat
        material.color.set(currentColor)
      }
    })

    if (firstPaintRef.current) {
      firstPaintRef.current = false
    } else {
      paintAnimatingRef.current = true
      setColorTransitioning(true)
    }
    invalidate()
  }, [currentColor, colorInitialized, invalidate, setColorTransitioning])

  // Smooth color transition
  useFrame((_, delta) => {
    if (!paintAnimatingRef.current || !currentColor || paintTargetsRef.current.length === 0) return

    const d = 1 - Math.exp(-10 * delta) // ~400ms blend
    const scratch = paintScratchRef.current
    let moving = false

    paintTargetsRef.current.forEach(({ material }) => {
      scratch.set(currentColor)
      material.color.lerp(scratch, d)

      if (
        Math.abs(material.color.r - scratch.r) > 0.004 ||
        Math.abs(material.color.g - scratch.g) > 0.004 ||
        Math.abs(material.color.b - scratch.b) > 0.004
      ) {
        moving = true
      } else {
        material.color.copy(scratch)
      }
    })

    if (moving) {
      invalidate()
    } else {
      paintAnimatingRef.current = false
      setColorTransitioning(false)
    }
  })

  return null
}
