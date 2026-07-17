import { type ReactElement, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing'
import { SSGIEffect, TRAAEffect, VelocityDepthNormalPass } from 'realism-effects'
import { useQuality } from '@/contexts/QualityContext'

export function PostProcessing() {
  const { settings, ssgiEnabled } = useQuality()
  const ssgiActive = settings.experimentalSSGI && ssgiEnabled
  return ssgiActive ? <SSGIComposer /> : <StandardComposer />
}

function StandardComposer() {
  const { settings } = useQuality()

  // EffectComposer types require ReactElement children (no false), so the
  // effect stack is assembled as an array
  const effects: ReactElement[] = []

  // N8AO - screen-space AO, quality follows tier. halfRes computes AO at
  // half resolution with depth-aware upsampling: ~3x cheaper, visually
  // near-identical on a car scene.
  if (settings.enableN8AO) {
    effects.push(
      <N8AO
        key="n8ao"
        halfRes
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

/**
 * Experimental (ultra + opt-in): screen-space global illumination with
 * temporal reprojection AA from realism-effects. Replaces N8AO (SSGI covers
 * AO), SMAA and MSAA (TRAA is the AA). Temporal accumulation needs a steady
 * stream of frames, so the demand loop is driven continuously while active —
 * this mode trades idle efficiency for maximum fidelity.
 */
function SSGIComposer() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)

  const rig = useMemo(() => {
    const velocity = new VelocityDepthNormalPass(scene, camera)
    const ssgi = new SSGIEffect(scene, camera, velocity, {
      distance: 10,
      thickness: 10,
      denoiseIterations: 2,
      radius: 3,
      phi: 0.5,
      depthPhi: 2,
      normalPhi: 50,
      roughnessPhi: 50,
      envBlur: 0.5,
      importanceSampling: true,
      steps: 20,
      refineSteps: 5,
      resolutionScale: 1,
      missedRays: false,
    })
    const traa = new TRAAEffect(scene, camera, velocity)
    return { velocity, ssgi, traa }
  }, [scene, camera])

  useEffect(() => {
    return () => {
      rig.ssgi.dispose()
      rig.traa.dispose()
      rig.velocity.dispose()
    }
  }, [rig])

  useFrame(() => invalidate())

  return (
    <EffectComposer multisampling={0}>
      <primitive object={rig.velocity} />
      <primitive object={rig.ssgi} />
      <primitive object={rig.traa} />
      <Bloom intensity={0.15} luminanceThreshold={0.9} luminanceSmoothing={0.2} mipmapBlur radius={0.3} />
      <Vignette eskil={false} offset={0.32} darkness={0.62} />
    </EffectComposer>
  )
}
