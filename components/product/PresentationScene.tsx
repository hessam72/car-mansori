'use client'

import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { NeutralToneMapping } from 'three'
import { PerfLadder } from '@/components/three/PerfLadder'
import { PartErrorBoundary } from '@/components/car/PartErrorBoundary'
import { clampDprToBudget } from '@/lib/three/dprBudget'
import { useQuality } from '@/contexts/QualityContext'
import { needsEnvironment, roomMode, type PresentationConfig } from '@/lib/product/presentation'
import type { ExportSources } from '@/lib/three/exportConfigured'
import PresentationEnvironment from './PresentationEnvironment'
import PresentationLighting from './PresentationLighting'
import PresentationRoom from './PresentationRoom'
import PresentationBackdrop from './PresentationBackdrop'
import PresentationGestures from './PresentationGestures'
import { PresentationPostProcessing } from './PresentationPostProcessing'
import FurnitureStack, { type StackControls, type StackFraming } from './FurnitureStack'
import PresentationDiagnostics from './PresentationDiagnostics'

interface Props {
  config: PresentationConfig
  onLayerError?: (category: string, error: Error) => void
  /** Owned by the page so the AR export, which lives outside the Canvas, can
   *  reach the loaded GLTFs. Same ref-passing idiom as `controls`/`framing`. */
  sources?: React.MutableRefObject<ExportSources>
}

export default function PresentationScene({ config, onLayerError, sources }: Props) {
  const { settings } = useQuality()
  const backdrop = roomMode(config)
  const needsIBL = needsEnvironment(config)
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
  const [perfScale, setPerfScale] = useState(1)

  // Spin/tilt targets live in a ref shared with the gesture layer — writing
  // them to zustand at 60Hz would re-render the bottom sheet every frame.
  const controls = useRef<StackControls>({ yaw: 0, pitch: 0 })
  // Written by the stack once it has measured the frame layer, read by the
  // camera rig to compute a distance that actually fits this canvas.
  const framing = useRef<StackFraming | null>(null)

  const dpr = useMemo<[number, number]>(() => {
    const [min, max] = clampDprToBudget(settings.dpr)
    return [min, Math.max(min, +(max * perfScale).toFixed(2))]
  }, [settings.dpr, perfScale])

  return (
    <div
      className="h-full w-full"
      style={{ touchAction: 'none', overscrollBehavior: 'none' }}
    >
      <Canvas
        /* No `shadows`: this page renders with no shadow maps at all. */
        frameloop="demand"
        dpr={dpr}
        style={{ touchAction: 'none' }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          toneMapping: NeutralToneMapping,
          toneMappingExposure: 1.0,
        }}
        camera={{
          // A placeholder only — PresentationGestures re-frames from the
          // piece's measured bounds before the first drawn frame.
          position: [0, 1.2, 4],
          fov: config.camera.fov,
          near: config.camera.near ?? 0.1,
          // The stage is a booth — 40 rather than 1000 keeps depth precision
          // tight, which is what N8AO reads from.
          far: config.camera.far ?? 40,
        }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true
        }}
      >
        <PerfLadder onScale={setPerfScale} adaptive={settings.adaptiveDpr} />

        {/* Matte does NOT mean "no environment" — it means the *furniture*
            takes none, and that is enforced per-material (envMapIntensity 0),
            so it holds whether or not an environment exists. A room GLB is
            authored to be lit by one, so dropping it renders the room black.
            Hence: IBL whenever a modelled room needs it, or matte is off. */}
        {needsIBL && <PresentationEnvironment config={config} />}
        <PresentationLighting config={config} />

        <Suspense fallback={null}>
          <PartErrorBoundary category="room" onError={onLayerError}>
            {backdrop === 'image' && <PresentationBackdrop config={config} framing={framing} />}
            {backdrop === 'model' && (
              <PresentationRoom config={config as PresentationConfig & { room: { path: string } }} />
            )}
          </PartErrorBoundary>
        </Suspense>

        <Suspense fallback={null}>
          <PartErrorBoundary category="furniture" onError={onLayerError}>
            <FurnitureStack
              config={config}
              controls={controls}
              framing={framing}
              sources={sources}
              debug={debug}
            />
          </PartErrorBoundary>
        </Suspense>

        <PresentationGestures config={config} controls={controls} framing={framing} />

        <PresentationPostProcessing />

        {debug && <PresentationDiagnostics />}
      </Canvas>
    </div>
  )
}
