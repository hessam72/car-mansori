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
      console.log('[FurnitureColorApplier] No furniture ID selected')
      return
    }

    // Find the object by name in the scene - search for exact match OR parent containing the name
    let furnitureObject: THREE.Object3D | undefined
    const searchName = selectedFurnitureId.toLowerCase()

    console.log(`[FurnitureColorApplier] Searching for object with name: "${selectedFurnitureId}"`)

    scene.traverse((child) => {
      const childName = child.name.toLowerCase()
      if (childName === searchName || childName.includes(searchName)) {
        if (!furnitureObject) {
          furnitureObject = child
          console.log(`[FurnitureColorApplier] Found object: "${child.name}" (type: ${child.type})`)
        }
      }
    })

    if (!furnitureObject) {
      console.log(`[FurnitureColorApplier] Furniture object "${selectedFurnitureId}" not found in scene`)
      paintTargetsRef.current = []
      return
    }

    const targets: PaintTarget[] = []
    let meshCount = 0
    let colorableCount = 0
    let totalChildren = 0

    console.log('[FurnitureColorApplier] Processing furniture:', selectedFurnitureId, 'Found object:', furnitureObject.name)
    console.log('[FurnitureColorApplier] Object hierarchy:')

    // Log hierarchy first to understand structure
    const logHierarchy = (obj: THREE.Object3D, depth = 0) => {
      const indent = '  '.repeat(depth)
      const isMesh = obj instanceof THREE.Mesh
      console.log(`${indent}- ${obj.name} (${obj.type})${isMesh ? ' [MESH]' : ''}`)
      obj.children.forEach(child => logHierarchy(child, depth + 1))
    }
    logHierarchy(furnitureObject)

    // Traverse ONLY this furniture object and find colorable meshes
    furnitureObject.traverse((child: THREE.Object3D) => {
      totalChildren++
      if (child instanceof THREE.Mesh) {
        meshCount++
        const childName = child.name.toLowerCase()

        // ONLY check mesh name for colorable keywords
        const isColorable =
          childName.includes('fabric') ||
          childName.includes('cushion') ||
          childName.includes('upholstery') ||
          childName.includes('seat')

        // Find parent chain for debugging
        let parentChain = child.name
        let parent = child.parent
        while (parent && parent !== furnitureObject) {
          parentChain = `${parent.name} > ${parentChain}`
          parent = parent.parent
        }

        console.log(`  Mesh: ${child.name}, Path: ${parentChain}, colorable: ${isColorable}`)

        if (isColorable) {
          colorableCount++
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
          console.log(`    -> Added to color targets (depth: ${parentChain.split('>').length})`)
        }
      }
    })

    console.log(
      `[FurnitureColorApplier] Found ${meshCount} meshes, ${colorableCount} colorable, ${targets.length} targets`
    )

    paintTargetsRef.current = targets
    firstPaintRef.current = true
  }, [selectedFurnitureId, scene])

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
