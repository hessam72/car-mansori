'use client'

import { useMemo, useEffect } from 'react'
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
  // Get selected part ID from store
  const selectedPartId = useCarConfig((s) => s.selectedParts[category])

  // Find part config
  const parts = partsConfig[category as keyof typeof partsConfig] || []
  const partConfig: any = parts.find((p: any) => p.id === selectedPartId)

  // Load part model if URL exists (useGLTF has built-in DRACO + caching)
  const gltf: any = partConfig?.model_path ? useGLTF(partConfig.model_path) : null

  // Memory management: clear from cache on unmount
  useEffect(() => {
    return () => {
      if (partConfig?.model_path) {
        useGLTF.clear(partConfig.model_path)
      }
    }
  }, [partConfig?.model_path])

  // Process part placement
  const partInstances = useMemo(() => {
    if (!partConfig) return null

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
      return null
    }

    if (!gltf) return null

    // Strategy 2: attachNodes (multiple instances, e.g., wheels)
    if (partConfig.attachNodes) {
      const instances: THREE.Group[] = []

      partConfig.attachNodes.forEach((nodeName: string) => {
        const targetNode = findNodeByName(baseCarScene, nodeName)
        if (!targetNode) {
          console.warn(`[DynamicPart] attachNode not found: ${nodeName}`)
          return
        }
        console.log('[DynamicPart] targetNode:', nodeName, targetNode.position)

        const clone = gltf.scene.clone(true)

        clone.position.copy(targetNode.position)
        clone.quaternion.copy(targetNode.quaternion)
        clone.scale.copy(targetNode.scale)

        console.log('[DynamicPart] clone assigned:', clone.position)

        // Hide original node
        targetNode.visible = false

        instances.push(clone)
      })

      // Hide nodes if specified
      if (partConfig.hideNodes) {
        partConfig.hideNodes.forEach((nodeName: string) => {
          const node = findNodeByName(baseCarScene, nodeName)
          if (node) node.visible = false
        })
      }

      return instances
    }

    // Strategy 3: replaceNode (single instance, e.g., hood)
    if (partConfig.replaceNode) {
      const targetNode = findNodeByName(baseCarScene, partConfig.replaceNode)
      if (!targetNode) {
        console.warn(`[DynamicPart] replaceNode not found: ${partConfig.replaceNode}`)
        return null
      }

      console.log('[DynamicPart] replaceNode targetNode:', partConfig.replaceNode, targetNode.position)

      const clone = gltf.scene.clone(true)

      clone.position.copy(targetNode.position)
      clone.quaternion.copy(targetNode.quaternion)
      clone.scale.copy(targetNode.scale)

      console.log('[DynamicPart] replaceNode clone assigned:', clone.position)

      // Hide original node
      targetNode.visible = false

      return [clone]
    }

    return null
  }, [gltf, partConfig, baseCarScene])

  // Dispose geometries/materials when instances change
  useEffect(() => {
    return () => {
      partInstances?.forEach((instance) => {
        instance.traverse((child: any) => {
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
    }
  }, [partInstances])

  if (!partInstances) return null

  return (
    <group>
      {partInstances.map((instance, i) => (
        <primitive key={i} object={instance} />
      ))}
    </group>
  )
}
