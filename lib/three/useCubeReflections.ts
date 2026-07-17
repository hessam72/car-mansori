'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * True reflections for the car: a one-shot CubeCamera capture of the scene
 * (reflective floor, baked ground shadow, studio environment) assigned as a
 * real envMap to every car material. The car hides itself during capture and
 * scene.background is temporarily set to the environment texture so paint
 * reflects the light rig too.
 *
 * Returns a `capture()` callback — call it after the scene has settled
 * (shadow bake / part fade / door animation). Paint color changes never need
 * a re-capture since the car itself is not part of the capture.
 */
export function useCubeReflections(
  carRoot: THREE.Object3D | null,
  enabled: boolean,
  resolution: number
) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)
  const rigRef = useRef<{ rt: THREE.WebGLCubeRenderTarget; cam: THREE.CubeCamera } | null>(null)

  useEffect(() => {
    if (!enabled || !carRoot) return
    const rt = new THREE.WebGLCubeRenderTarget(resolution, { type: THREE.HalfFloatType })
    const cam = new THREE.CubeCamera(0.5, 60, rt)
    cam.position.set(0, 0.6, 0) // roughly paint-surface height at car center
    rigRef.current = { rt, cam }

    return () => {
      // Detach from materials before disposing so they fall back to scene env
      carRoot.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material]
          mats.forEach((m: THREE.Material | null) => {
            const std = m as THREE.MeshStandardMaterial | null
            if (std && std.envMap === rt.texture) {
              std.envMap = null
              std.needsUpdate = true
            }
          })
        }
      })
      rt.dispose()
      rigRef.current = null
      invalidate()
    }
  }, [enabled, resolution, carRoot, invalidate])

  return useCallback(() => {
    const rig = rigRef.current
    if (!rig || !carRoot || !enabled) return

    const prevVisible = carRoot.visible
    const prevBackground = scene.background
    carRoot.visible = false
    scene.background = scene.environment
    rig.cam.update(gl, scene)
    // Force PMREM regeneration so rough materials pick up the new capture
    rig.rt.texture.needsPMREMUpdate = true
    carRoot.visible = prevVisible
    scene.background = prevBackground

    carRoot.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((m: THREE.Material | null) => {
          const std = m as THREE.MeshStandardMaterial | null
          if (std && 'envMap' in std && std.envMap !== rig.rt.texture) {
            std.envMap = rig.rt.texture
            std.needsUpdate = true
          }
        })
      }
    })
    invalidate()
  }, [carRoot, enabled, gl, scene, invalidate])
}
