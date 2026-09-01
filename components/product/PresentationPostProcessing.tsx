'use client'

import { type ReactElement } from 'react'
import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import { useQuality } from '@/contexts/QualityContext'
import type { PresentationConfig } from '@/lib/product/presentation'

/**
 * A lighter composer than the showroom's, tuned for fabric rather than paint.
 *
 * AO follows `settings.enableN8AO` and nothing else. It used to be promoted on
 * `high` too, over the top of a tier config that sets the flag `false` there —
 * so `high` was the one tier running an effect its own preset had switched off,
 * and the halo N8AO bleeds off a large silhouette read as a soft shadow hanging
 * in the air behind the piece.
 *
 * The promotion had a reason, and it has expired: it was justified by there
 * being "no shadow or reflection passes competing for budget", with AO standing
 * in for the contact shadow the page dropped. This page now has both. The sun
 * casts a real contact shadow under the piece and the floor reflects it, which
 * is what grounds it — better than AO ever did, and without the halo.
 *
 * `quality.ao` in the manifest forces it either way for a product that wants
 * the occlusion back.
 */
export function PresentationPostProcessing({ config }: { config: PresentationConfig }) {
  const { settings } = useQuality()
  const effects: ReactElement[] = []

  if (config.quality?.ao ?? settings.enableN8AO) {
    effects.push(
      <N8AO
        key="n8ao"
        halfRes
        aoRadius={0.35}
        intensity={2}
        distanceFalloff={1.0}
        quality={settings.n8aoQuality}
        color="black"
      />
    )
  }

  // Lower than the car scene's 0.15 — upholstery must not glow.
  effects.push(
    <Bloom
      key="bloom"
      intensity={0.1}
      luminanceThreshold={0.92}
      luminanceSmoothing={0.2}
      mipmapBlur
      radius={0.3}
    />
  )

  // The composer bypasses canvas MSAA and silhouette quality is the whole
  // point of this page, so SMAA runs on every tier.
  effects.push(<SMAA key="smaa" />)

  // Lighter than the showroom's 0.62 — the booth already frames the shot.
  effects.push(<Vignette key="vignette" offset={0.35} darkness={0.5} />)

  return <EffectComposer multisampling={settings.multisampling}>{effects}</EffectComposer>
}
