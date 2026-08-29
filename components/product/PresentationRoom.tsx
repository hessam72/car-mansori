'use client'

import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
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
export default function PresentationRoom({ config }: { config: PresentationConfig }) {
  const gltf = useGLTF(config.room.path)
  const { settings } = useQuality()

  const scene = useMemo(() => {
    const clone = gltf.scene.clone(true)
    preparePresentationObject(clone, {
      envMapIntensity: config.room.envIntensity ?? 1,
      anisotropy: settings.anisotropyLevel,
    })
    return clone
  }, [gltf.scene, config.room.envIntensity, settings.anisotropyLevel])

  return <primitive object={scene} />
}
