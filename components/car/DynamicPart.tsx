'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useCarConfig } from '@/stores/carConfigStore'
import * as THREE from 'three'
import partsConfig from '@/public/config/car-parts.json'

interface DynamicPartProps {
  category: string
  baseCarScene: THREE.Group
}

// Helper: Find node by name (case-insensitive, recursive)
function findNodeByName(parent: THREE.Object3D, name: string): THREE.Object3D | null {
  if (parent.name.toLowerCase() === name.toLowerCase()) {
    return parent
  }
  for (const child of parent.children) {
    const found = findNodeByName(child, name)
    if (found) return found
  }
  return null
}

export function DynamicPart({ category, baseCarScene }: DynamicPartProps) {
  // Get selected part ID and actions from store
  const selectedPartId = useCarConfig((s) => s.selectedParts[category])
  const setPartLoading = useCarConfig((s) => s.setPartLoading)
  const setPartError = useCarConfig((s) => s.setPartError)

  // Track transition state
  const transitionRef = useRef<{
    oldParts: THREE.Object3D[]
    newParts: THREE.Object3D[]
    progress: number
    isTransitioning: boolean
  }>({
    oldParts: [],
    newParts: [],
    progress: 0,
    isTransitioning: false
  })

  // Find part config
  const parts = partsConfig[category as keyof typeof partsConfig] || []
  const partConfig: any = parts.find((p: any) => p.id === selectedPartId)

  // Load part model (useGLTF suspends until loaded)
  const gltf: any = partConfig?.model_path ? useGLTF(partConfig.model_path) : null

  // Track loading state - mark as loading when part changes, clear when gltf available
  useEffect(() => {
    if (partConfig?.model_path && !gltf) {
      // Loading started
      setPartLoading(category, true)
    } else if (gltf || !partConfig?.model_path) {
      // Loading complete or no model needed
      setPartLoading(category, false)
      setPartError(category, null)
    }
  }, [partConfig?.model_path, gltf, category, setPartLoading, setPartError])

  // Memory management: clear from cache on unmount
  useEffect(() => {
    return () => {
      if (partConfig?.model_path) {
        useGLTF.clear(partConfig.model_path)
      }
    }
  }, [partConfig?.model_path])

  // Animate transitions
  useFrame((_, delta) => {
    const transition = transitionRef.current
    if (!transition.isTransitioning) return

    // Wait 1-2 frames before animating to ensure initial state renders
    if (transition.progress < 0) {
      transition.progress = Math.min(0, transition.progress + delta * 3.0)
      return
    }

    transition.progress += delta * 1.5 // ~667ms duration

    if (transition.progress >= 1) {
      // Transition complete
      transition.progress = 1
      transition.isTransitioning = false

      // Remove old parts
      transition.oldParts.forEach((part) => {
        part.parent?.remove(part)
        part.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose())
            } else {
              child.material?.dispose()
            }
          }
        })
      })
      transition.oldParts = []
    }

    // Animate opacity and scale
    const fadeProgress = Math.min(1, transition.progress * 1.5) // Faster fade

    // Fade out old parts
    transition.oldParts.forEach((part) => {
      part.traverse((child: any) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial
          if (!mat.transparent) {
            mat.transparent = true
            mat.needsUpdate = true
          }
          mat.opacity = 1 - fadeProgress
        }
      })
    })

    // Fade in new parts with scale animation
    transition.newParts.forEach((part) => {
      const scaleProgress = Math.pow(fadeProgress, 0.5) // Ease-out scale
      const targetScale = part.userData.originalScale || new THREE.Vector3(1, 1, 1)
      part.scale.lerpVectors(
        new THREE.Vector3(0.6, 0.6, 0.6).multiply(targetScale),
        targetScale,
        scaleProgress
      )

      part.traverse((child: any) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial
          if (!mat.transparent) {
            mat.transparent = true
            mat.needsUpdate = true
          }
          mat.opacity = fadeProgress
        }
      })
    })
  })

  // Process part placement - add directly to baseCarScene
  useEffect(() => {
    if (!partConfig) return

    const addedClones: THREE.Object3D[] = []
    const transition = transitionRef.current

    // Store old parts for fade-out transition
    if (transition.newParts.length > 0) {
      transition.oldParts = [...transition.newParts]
    }

    // Strategy 1: hideNodes only (e.g., "None" options)
    if (partConfig.hideNodes && !partConfig.model_path) {
      partConfig.hideNodes.forEach((nodeName: string) => {
        const node = findNodeByName(baseCarScene, nodeName)
        if (node) {
          node.visible = false
        } else {
          console.warn(`[DynamicPart] hideNode not found: ${nodeName}`)
        }
      })

      // Clear transition state for "None" options
      transition.newParts = []
      transition.isTransitioning = false
      return
    }

    if (!gltf) return

    // Strategy 2: attachNodes (multiple instances, e.g., wheels)
    if (partConfig.attachNodes) {
      partConfig.attachNodes.forEach((nodeName: string) => {
        const targetNode = findNodeByName(baseCarScene, nodeName)
        if (!targetNode) {
          console.warn(`[DynamicPart] attachNode not found: ${nodeName}`)
          return
        }

        const clone = gltf.scene.clone(true)

        clone.position.copy(targetNode.position)
        clone.quaternion.copy(targetNode.quaternion)
        clone.scale.copy(targetNode.scale)

        // Store original scale for animation
        clone.userData.originalScale = targetNode.scale.clone()

        // Initialize materials for transition
        clone.traverse((child: any) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mat = child.material as THREE.MeshStandardMaterial
            mat.transparent = true
            mat.opacity = 0
            mat.needsUpdate = true
          }
        })

        // Add to same parent to maintain coordinate space
        targetNode.parent?.add(clone)
        addedClones.push(clone)

        // Hide original node
        targetNode.visible = false
      })

      // Hide nodes if specified
      if (partConfig.hideNodes) {
        partConfig.hideNodes.forEach((nodeName: string) => {
          const node = findNodeByName(baseCarScene, nodeName)
          if (node) node.visible = false
        })
      }
    }

    // Strategy 3: replaceNode (single instance, e.g., hood)
    if (partConfig.replaceNode) {
      const targetNode = findNodeByName(baseCarScene, partConfig.replaceNode)
      if (!targetNode) {
        console.warn(`[DynamicPart] replaceNode not found: ${partConfig.replaceNode}`)
        return
      }

      const clone = gltf.scene.clone(true)

      clone.position.copy(targetNode.position)
      clone.quaternion.copy(targetNode.quaternion)
      clone.scale.copy(targetNode.scale)

      // Store original scale for animation
      clone.userData.originalScale = targetNode.scale.clone()

      // Initialize materials for transition
      clone.traverse((child: any) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial
          mat.transparent = true
          mat.opacity = 0
          mat.needsUpdate = true
        }
      })

      // Add to same parent to maintain coordinate space
      targetNode.parent?.add(clone)
      addedClones.push(clone)

      // Hide original node
      targetNode.visible = false
    }

    // Start transition animation with frame delay
    transition.newParts = addedClones
    transition.progress = -0.1 // Start negative for 2-frame delay
    transition.isTransitioning = addedClones.length > 0

    // Cleanup - called when component unmounts or dependencies change
    return () => {
      // Clean up transition state
      const allParts = [...transition.oldParts, ...transition.newParts]
      allParts.forEach((clone) => {
        clone.parent?.remove(clone)
        clone.traverse((child: any) => {
          if (child instanceof THREE.Mesh) {
            child.geometry?.dispose()
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => mat.dispose())
            } else {
              child.material?.dispose()
            }
          }
        })
      })

      // Reset transition state
      transition.oldParts = []
      transition.newParts = []
      transition.isTransitioning = false
    }
  }, [gltf, partConfig, baseCarScene])

  return null
}
