'use client'

import { type ReactElement } from 'react'
import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import { useQuality } from '@/contexts/QualityContext'

/**
 * A lighter composer than the showroom's, tuned for fabric rather than paint.
 *
 * AO is promoted to high as well as ultra: with no shadow or reflection passes
 * competing for budget this scene can afford it, and ambient occlusion is the
 * only permitted stand-in for the contact shadow this page deliberately drops —
 * it is what stops the piece reading as detached from the floor.
 */
export function PresentationPostProcessing() {
  const { settings, preset } = useQuality()
  const effects: ReactElement[] = []

  if (settings.enableN8AO || preset === 'high') {
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
