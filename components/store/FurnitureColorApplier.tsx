'use client'

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useFurnitureConfig } from '@/stores/furnitureConfigStore'
import * as THREE from 'three'

interface PaintTarget {
  material: THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial
  initialColor: THREE.Color
  meshName: string
}

export function FurnitureColorApplier() {
  const { invalidate } = useThree()
  const selectedObject = useFurnitureConfig((s) => s.selectedObject)
  const currentColor = useFurnitureConfig((s) => s.currentColor)
  const colorInitialized = useFurnitureConfig((s) => s.colorInitialized)
  const setColorTransitioning = useFurnitureConfig((s) => s.setColorTransitioning)

  const paintTargetsRef = useRef<PaintTarget[]>([])
  const firstPaintRef = useRef(true)
  const paintAnimatingRef = useRef(false)
  const paintScratchRef = useRef(new THREE.Color())

  // Collect paintable materials when furniture is selected
  useEffect(() => {
    if (!selectedObject) {
      paintTargetsRef.current = []
      console.log('[FurnitureColorApplier] No object selected')
      return
    }

    const targets: PaintTarget[] = []
    let meshCount = 0
    let paintableCount = 0

    console.log('[FurnitureColorApplier] Processing object:', selectedObject.name)

    const getUserData = (mesh: any, key: string) => {
      return mesh.userData?.userdata?.[key] ?? mesh.userData?.[key]
    }

    // Traverse the selected object and find all meshes
    selectedObject.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount++
        const paintableValue = getUserData(child, 'paintable')
        const isPaintable = paintableValue === true || paintableValue === 1

        // Check if material/mesh name suggests it's colorable
        const nameMatch =
          child.material?.name?.toLowerCase().includes('fabric') ||
          child.material?.name?.toLowerCase().includes('cushion') ||
          child.material?.name?.toLowerCase().includes('upholstery') ||
          child.material?.name?.toLowerCase().includes('paint') ||
          child.name?.toLowerCase().includes('cushion') ||
          child.name?.toLowerCase().includes('seat') ||
          child.name?.toLowerCase().includes('fabric')

        console.log(`  Mesh: ${child.name}, paintable: ${isPaintable}, nameMatch: ${nameMatch}`)

        if (isPaintable || nameMatch) {
          paintableCount++
          // Clone material to avoid affecting other instances
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material
            child.material = (child.material as THREE.Material).clone()
          }

          const material = child.material as THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial
          targets.push({
            material,
            initialColor: material.color.clone(),
            meshName: child.name,
          })
          console.log(`    -> Added to paint targets`)
        }
      }
    })

    // Fallback: if no paintable meshes found, apply to ALL meshes with standard/physical materials
    if (targets.length === 0 && meshCount > 0) {
      console.log('[FurnitureColorApplier] No paintable meshes found, applying to ALL meshes')
      selectedObject.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          (child.material instanceof THREE.MeshStandardMaterial ||
            child.material instanceof THREE.MeshPhysicalMaterial)
        ) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material
            child.material = (child.material as THREE.Material).clone()
          }

          const material = child.material as THREE.MeshPhysicalMaterial | THREE.MeshStandardMaterial
          targets.push({
            material,
            initialColor: material.color.clone(),
            meshName: child.name,
          })
          console.log(`  -> Added mesh: ${child.name}`)
        }
      })
    }

    console.log(
      `[FurnitureColorApplier] Found ${meshCount} meshes, ${paintableCount} paintable, ${targets.length} targets`
    )

    paintTargetsRef.current = targets
    firstPaintRef.current = true
  }, [selectedObject])

  // Apply color change
  useEffect(() => {
    if (!colorInitialized || !currentColor || paintTargetsRef.current.length === 0) {
      console.log(
        '[FurnitureColorApplier] Color change skipped:',
        'initialized:',
        colorInitialized,
        'color:',
        currentColor,
        'targets:',
        paintTargetsRef.current.length
      )
      return
    }

    console.log(`[FurnitureColorApplier] Applying color ${currentColor} to ${paintTargetsRef.current.length} targets`)

    paintTargetsRef.current.forEach(({ material, meshName }) => {
      if (firstPaintRef.current) {
        // Instant first coat
        material.color.set(currentColor)
        console.log(`  -> Set ${meshName} to ${currentColor}`)
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
