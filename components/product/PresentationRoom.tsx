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
export default function PresentationRoom({
  config,
}: {
  config: PresentationConfig & { room: { path: string } }
}) {
  const gltf = useGLTF(config.room.path)
  const camera = useThree((s) => s.camera)
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

  // The other way this page goes black: the room is authored front-facing only,
  // so if the camera lands inside a wall that wall fills the frame.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    console.log(
      `[PresentationRoom] bounds ${box.min.toArray().map((n) => n.toFixed(1)).join('/')}` +
        ` → ${box.max.toArray().map((n) => n.toFixed(1)).join('/')} (${size.toArray().map((n) => n.toFixed(1)).join(' x ')}m)`
    )
    if (box.containsPoint(camera.position)) {
      console.warn(
        '[PresentationRoom] the camera is inside the room bounds — if the screen is black,' +
          ' the room is enclosing it. Lower camera.padding or move the room GLB back.'
      )
    }
  }, [scene, camera])

  return <primitive object={scene} />
}
