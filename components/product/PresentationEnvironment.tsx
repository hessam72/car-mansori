'use client'

import { Environment, Lightformer } from '@react-three/drei'
import { useQuality } from '@/contexts/QualityContext'
import type { PresentationConfig } from '@/lib/product/presentation'

/**
 * IBL for the presentation stage.
 *
 * frames={1} bakes the cubemap once on mount, so the Lightformer rig costs
 * nothing per frame. With no shadow or reflection passes competing for budget,
 * the env resolution is stepped up one tier over the showroom's.
 */
export default function PresentationEnvironment({ config }: { config: PresentationConfig }) {
  const { settings } = useQuality()
  // Capped at 512, *not* the 2048 the tier ladder would allow. With children
  // present drei switches to portal mode and allocates a WebGLCubeRenderTarget
  // at this size — six half-float faces, so 2048 is a ~200MB allocation that a
  // phone simply fails, and a failed environment map renders black. 512 is
  // beyond ample for IBL, which is PMREM-blurred before anything samples it.
  const resolution = Math.min(settings.envResolution * 2, 512)

  // `hdr` is optional now that matte is the default — without one there is
  // nothing to load, and drei would throw on an undefined url.
  if (!config.room.hdr) return null

  return (
    <Environment
      files={config.room.hdr}
      background={false}
      resolution={resolution}
      frames={1}
      environmentIntensity={config.room.envIntensity ?? 1}
    >
      {/* Overhead softbox — the broad top light fabric needs to read */}
      <Lightformer
        form="rect"
        intensity={2.5}
        position={[0, 4, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[6, 3, 1]}
      />
      {/* Side strip — grazing highlight that shows weave and stitching */}
      <Lightformer
        form="rect"
        intensity={1.6}
        position={[3.5, 2, 1]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[4, 2, 1]}
      />
      <Lightformer
        form="rect"
        intensity={0.9}
        position={[-3.5, 2, 1]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[4, 2, 1]}
      />
    </Environment>
  )
}
