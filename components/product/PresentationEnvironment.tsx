'use client'

import { Environment } from '@react-three/drei'
import { useQuality } from '@/contexts/QualityContext'
import { lightingMode, STORE_RENDER, type PresentationConfig } from '@/lib/product/presentation'

/**
 * IBL for the presentation stage — the same plain environment /store uses.
 *
 * This deliberately has **no children**. drei's `<Environment>` is two entirely
 * different components behind one name: with children it becomes
 * `EnvironmentPortal`, which allocates a WebGLCubeRenderTarget and bakes the
 * children plus the HDR into it, and only the childless form takes the
 * `EnvironmentCube` path that assigns `scene.environment` straight from the
 * loaded texture. The Lightformer rig that used to live here forced the portal
 * path, and a room GLB lit entirely by IBL — which is every room authored
 * against the store scene — has nothing left to reflect if that bake is empty.
 * /store renders the same HDR through the childless path and has never had the
 * problem, so this now matches it exactly.
 */
export default function PresentationEnvironment({ config }: { config: PresentationConfig }) {
  const { settings } = useQuality()

  // `hdr` is optional now that matte is the default — without one there is
  // nothing to load, and drei would throw on an undefined url.
  if (!config.room.hdr) return null

  const intensity =
    config.room.envIntensity ??
    (lightingMode(config) === 'store' ? STORE_RENDER.envIntensity : 1)

  return (
    <Environment
      files={config.room.hdr}
      background={false}
      environmentIntensity={intensity}
      resolution={settings.envResolution}
    />
  )
}
