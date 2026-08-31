'use client'

import { Suspense, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, NeutralToneMapping, type Box3 } from 'three'
import { PerfLadder } from '@/components/three/PerfLadder'
import { PartErrorBoundary } from '@/components/car/PartErrorBoundary'
import { clampDprToBudget } from '@/lib/three/dprBudget'
import { useQuality } from '@/contexts/QualityContext'
import {
  lightingMode,
  needsEnvironment,
  roomMode,
  STORE_RENDER,
  sunEnabled,
  type PresentationConfig,
} from '@/lib/product/presentation'
import type { ExportSources } from '@/lib/three/exportConfigured'
import PresentationEnvironment from './PresentationEnvironment'
import PresentationLighting from './PresentationLighting'
import PresentationRoom, { type RoomBounds } from './PresentationRoom'
import PresentationSun from './PresentationSun'
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
  // A room GLB is authored and checked under /store's renderer. Its materials
  // only read correctly through the same tone-mapping curve and exposure, so
  // store mode brings both across rather than re-grading the asset by hand.
  const store = lightingMode(config) === 'store'
  // The page's only shadow map, and only when a product asks for it.
  const sun = sunEnabled(config)
  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')
  const [perfScale, setPerfScale] = useState(1)

  // Spin/tilt targets live in a ref shared with the gesture layer — writing
  // them to zustand at 60Hz would re-render the bottom sheet every frame.
  const controls = useRef<StackControls>({ yaw: 0, pitch: 0 })
  // Written by the stack once it has measured the frame layer, read by the
  // camera rig to compute a distance that actually fits this canvas.
  const framing = useRef<StackFraming | null>(null)
  // The walls, when there are any — the rig clamps against these so a re-frame
  // cannot reverse the camera through the back of the room.
  const roomBounds = useRef<RoomBounds | null>(null)
  // The same box again, as state: the gallery rig is JSX and has to re-render
  // when the room resolves. The ref stays because the camera polls it per frame.
  const [roomBox, setRoomBox] = useState<Box3 | null>(null)

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
        /* Off unless the product configures a sun: with no `sun` block this
           page still renders with no shadow maps at all. */
        shadows={sun}
        frameloop="demand"
        dpr={dpr}
        style={{ touchAction: 'none' }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          toneMapping: store ? ACESFilmicToneMapping : NeutralToneMapping,
          toneMappingExposure: store ? STORE_RENDER.exposure : 1.0,
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
        {/* Suspense-wrapped on its own: `useEnvironment` suspends while the HDR
            downloads, and without a boundary of its own that unmounts the whole
            canvas subtree until it lands. */}
        <Suspense fallback={null}>
          {needsIBL && <PresentationEnvironment config={config} />}
        </Suspense>
        {/* The studio rig is authored in absolute metres around a piece at the
            origin; a modelled room needs fixtures scaled to the room itself, or
            everything past the spot cones renders black. */}
        <PresentationLighting config={config} roomBox={roomBox} />

        {/* Sun through the room's window + PCSS soft shadows. Its frustum is
            fitted to `roomBox`, so it mounts before the room and re-solves once
            the bounds arrive. */}
        {sun && <PresentationSun sun={config.sun!} roomBox={roomBox} />}

        <Suspense fallback={null}>
          <PartErrorBoundary category="room" onError={onLayerError}>
            {backdrop === 'image' && <PresentationBackdrop config={config} framing={framing} />}
            {backdrop === 'model' && (
              <PresentationRoom
                config={config as PresentationConfig & { room: { path: string } }}
                bounds={roomBounds}
                onBounds={setRoomBox}
              />
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

        <PresentationGestures
          config={config}
          controls={controls}
          framing={framing}
          roomBounds={roomBounds}
        />

        <PresentationPostProcessing />

        {debug && <PresentationDiagnostics />}
      </Canvas>
    </div>
  )
}
