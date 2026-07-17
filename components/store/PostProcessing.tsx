import { type ReactElement } from 'react'
import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import { useQuality } from '@/contexts/QualityContext'

export function PostProcessing() {
  const { settings } = useQuality()

  // EffectComposer types require ReactElement children (no false), so the
  // effect stack is assembled as an array
  const effects: ReactElement[] = []

  // N8AO - HEAVY: Screen-space ambient occlusion, quality follows tier
  if (settings.enableN8AO) {
    effects.push(
      <N8AO
        key="n8ao"
        aoRadius={0.5}
        intensity={3}
        distanceFalloff={1.0}
        quality={settings.n8aoQuality}
        color="black"
      />
    )
  }

  // Bloom - high threshold so only true highlights glow; paint stays crisp
  effects.push(
    <Bloom
      key="bloom"
      intensity={0.15}
      luminanceThreshold={0.9}
      luminanceSmoothing={0.2}
      mipmapBlur
      radius={0.3}
    />
  )

  // SMAA - cheap edge AA; the composer bypasses canvas MSAA so this matters
  if (settings.enableSMAA) {
    effects.push(<SMAA key="smaa" />)
  }

  // Vignette - VERY LIGHT: simple screen overlay
  effects.push(<Vignette key="vignette" eskil={false} offset={0.32} darkness={0.62} />)

  return <EffectComposer multisampling={settings.multisampling}>{effects}</EffectComposer>
}
