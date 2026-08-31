'use client'

import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { preparePresentationObject } from '@/lib/three/layerMaterials'
import { useQuality } from '@/contexts/QualityContext'
import type { PresentationConfig } from '@/lib/product/presentation'

/**
 * The trimmed presentation booth.
 *
 * Authored front-facing only — there is no geometry behind the static camera,
 * which is where the real saving lives (download, parse and VRAM, none of which
 * frustum culling helps with). Never a paint target, never a shadow caster.
 */
/** Published so the camera rig can keep itself inside the walls. */
export interface RoomBounds {
  box: THREE.Box3
}

export default function PresentationRoom({
  config,
  bounds,
}: {
  config: PresentationConfig & { room: { path: string } }
  bounds?: React.MutableRefObject<RoomBounds | null>
}) {
  const gltf = useGLTF(config.room.path)
  const invalidate = useThree((s) => s.invalidate)
  const { settings } = useQuality()

  // Never matte. The matte flag exists to stop the *furniture* picking up
  // environment reflections, and it does that per-material. A room GLB is
  // authored to be lit by the environment, so zeroing its envMapIntensity
  // renders it black — which is exactly what it did.
  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true)
    preparePresentationObject(clone, {
      envMapIntensity: config.room.envIntensity ?? 1,
      anisotropy: settings.anisotropyLevel,
    })
    return clone
  }, [gltf.scene, config.room.envIntensity, settings.anisotropyLevel])

  // Publish the walls. The camera rig derives its distance purely from the
  // piece and has never known the room exists — which was fine while the piece
  // was measured once, but the framing can now change after load, and a camera
  // that reverses through the back wall renders solid black.
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    if (bounds) bounds.current = { box }
    // Demand loop: without a frame the rig never reads the new bounds.
    invalidate()
    if (process.env.NODE_ENV !== 'production') {
      const size = box.getSize(new THREE.Vector3())
      console.log(
        `[PresentationRoom] bounds ${box.min.toArray().map((n) => n.toFixed(1)).join('/')}` +
          ` → ${box.max.toArray().map((n) => n.toFixed(1)).join('/')}` +
          ` (${size.toArray().map((n) => n.toFixed(1)).join(' x ')}m)`
      )
    }
    return () => {
      if (bounds) bounds.current = null
    }
  }, [scene, bounds, invalidate])

  return <primitive object={scene} />
}
