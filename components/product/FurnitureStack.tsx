'use client'

import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { collectZoneTargets, disposeTargets, preparePresentationObject } from '@/lib/three/layerMaterials'
import { applyFirstCoat, useZonePaint } from '@/hooks/useZonePaint'
import { usePresentation } from '@/stores/presentationStore'
import { useQuality } from '@/contexts/QualityContext'
import { PartErrorBoundary } from '@/components/car/PartErrorBoundary'
import { findCoverVariant, type PresentationConfig, type PresentationZone } from '@/lib/product/presentation'
import type { ExportSources } from '@/lib/three/exportConfigured'
import CoverLayer from './CoverLayer'
import type { WipeDirection } from '@/hooks/useClipWipe'

/** Rotation/tilt targets live in refs, not the store — a 60Hz zustand write
 *  would re-render the whole bottom sheet every frame. */
export interface StackControls {
  yaw: number
  pitch: number
}

/** Measured bounds of the seated piece, published to the camera rig so it can
 *  frame by what is actually there rather than a hard-coded distance. */
export interface StackFraming {
  center: THREE.Vector3
  size: THREE.Vector3
  version: number
}

interface FurnitureStackProps {
  config: PresentationConfig
  controls: React.MutableRefObject<StackControls>
  framing: React.MutableRefObject<StackFraming | null>
  /** Filled in with the raw cached GLTFs so the AR export can rebuild the piece
   *  from the sources rather than from this live, half-animated subtree. */
  sources?: React.MutableRefObject<ExportSources>
}

const TILT_LIMIT = 0.28 // ~16°

/** One GLB layer: cloned, prepared, its colourable subset tagged with a zone. */
function useLayer(path: string, zone: PresentationZone, match?: string) {
  const gltf = useGLTF(path)
  const { settings } = useQuality()

  const { scene, targets } = useMemo(() => {
    const clone = gltf.scene.clone(true)
    preparePresentationObject(clone, {
      envMapIntensity: settings.envIntensity,
      anisotropy: settings.anisotropyLevel,
    })
    const collected = collectZoneTargets(clone, { zone, match })
    applyFirstCoat(collected, usePresentation.getState().paint)
    return { scene: clone, targets: collected }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene, path])

  useZonePaint(targets)
  useEffect(() => () => disposeTargets(targets), [targets])

  return { scene, targets, source: gltf.scene }
}

/**
 * Registers the active cover's source scene without rendering it.
 *
 * The mounted CoverLayer only exists at layer step 2, but AR must export the
 * finished piece from any step — so the variant is resolved here instead.
 * It reads the same drei cache CoverLayer does, so this costs no extra fetch.
 */
function CoverSource({
  path,
  sources,
}: {
  path: string
  sources: React.MutableRefObject<ExportSources>
}) {
  const { scene } = useGLTF(path)
  useEffect(() => {
    sources.current.cover = scene
  }, [scene, sources])
  return null
}

export default function FurnitureStack({ config, controls, framing, sources }: FurnitureStackProps) {
  const invalidate = useThree((s) => s.invalidate)

  const layerStep = usePresentation((s) => s.layerStep)
  const exploded = usePresentation((s) => s.exploded)
  const coverId = usePresentation((s) => s.coverId)
  const coverPhase = usePresentation((s) => s.coverPhase)
  const commitCover = usePresentation((s) => s.commitCover)
  const finishWipe = usePresentation((s) => s.finishWipe)
  const setLayerError = usePresentation((s) => s.setLayerError)

  // Frame and soft never change path, so loading them here rather than in child
  // components makes both bounding boxes available in the same render — the
  // centering offset lands on the first committed frame, with no one-frame pop.
  const frame = useLayer(config.layers.frame.path, 'wood')
  const soft = useLayer(config.layers.soft.path, 'cushion', config.layers.soft.zoneMatch)

  const gap = config.explode?.gap ?? 0.45

  // Centred in X/Z but *seated* in Y: the piece stands on the room floor rather
  // than floating at the origin, and the frame alone defines the offset so the
  // three layers (authored at a shared world origin) never drift apart.
  const { centerOffset, baseSize } = useMemo(() => {
    // The frame alone is the structural datum for centering — it is the layer
    // that always exists and never changes. Framing, though, measures frame ∪
    // soft: the upholstery overhangs the frame on every real piece, and a
    // camera framed to the frame alone crops the arms.
    const box = new THREE.Box3().setFromObject(frame.scene)
    const center = box.getCenter(new THREE.Vector3())
    const outer = box.clone().union(new THREE.Box3().setFromObject(soft.scene))
    const size = outer.getSize(new THREE.Vector3())
    if (process.env.NODE_ENV !== 'production' && (size.y > 3 || size.y < 0.2)) {
      console.warn(
        `[FurnitureStack] frame is ${size.y.toFixed(2)}m tall — check the Blender unit scale`,
        config.layers.frame.path
      )
    }
    const floorY = config.room.floorY ?? 0
    return {
      centerOffset: [-center.x, floorY - box.min.y, -center.z] as [number, number, number],
      baseSize: size,
    }
  }, [frame.scene, soft.scene, config.room.floorY, config.layers.frame.path])

  useEffect(() => {
    if (!sources) return
    sources.current.frame = frame.source
    sources.current.soft = soft.source
    sources.current.centerOffset = centerOffset
  }, [sources, frame.source, soft.source, centerOffset])

  // Publish the bounds the camera should frame. Exploding raises the top layer
  // by two gaps, so the rig has to re-frame or the fanned stack runs off-screen.
  useEffect(() => {
    const floorY = config.room.floorY ?? 0
    const extra = exploded ? gap * 2 : 0
    const size = new THREE.Vector3(baseSize.x, baseSize.y + extra, baseSize.z)
    framing.current = {
      center: new THREE.Vector3(0, floorY + size.y / 2, 0),
      size,
      version: (framing.current?.version ?? 0) + 1,
    }
    invalidate()
  }, [baseSize, exploded, gap, config.room.floorY, framing, invalidate])

  const pitchRef = useRef<THREE.Group>(null)
  const yawRef = useRef<THREE.Group>(null)
  const frameSlot = useRef<THREE.Group>(null)
  const softSlot = useRef<THREE.Group>(null)
  const coverSlot = useRef<THREE.Group>(null)

  const variant = findCoverVariant(config, coverId)

  // The cover stays mounted through a wipe-out so it animates away rather than
  // popping when you step back off it.
  const coverMounted = !!variant && (layerStep === 2 || coverPhase === 'wipeOut')
  const coverDirection: WipeDirection =
    coverPhase === 'wipeIn' ? 'in' : coverPhase === 'wipeOut' ? 'out' : null

  const softVisible = layerStep >= 1

  useFrame((_, delta) => {
    const pitch = pitchRef.current
    const yaw = yawRef.current
    if (!pitch || !yaw) return

    const target = controls.current
    const nextYaw = THREE.MathUtils.damp(yaw.rotation.y, target.yaw, 12, delta)
    const nextPitch = THREE.MathUtils.damp(
      pitch.rotation.x,
      THREE.MathUtils.clamp(target.pitch, -TILT_LIMIT, TILT_LIMIT),
      12,
      delta
    )

    let moving = Math.abs(nextYaw - target.yaw) > 1e-4 || Math.abs(nextPitch - target.pitch) > 1e-4
    yaw.rotation.y = nextYaw
    pitch.rotation.x = nextPitch

    // Explode fans the layers apart along Y; the clip plane follows via each
    // layer's world matrix, so no special-casing is needed there.
    const slots = [frameSlot.current, softSlot.current, coverSlot.current]
    slots.forEach((slot, index) => {
      if (!slot) return
      const goal = exploded ? index * gap : 0
      slot.position.y = THREE.MathUtils.damp(slot.position.y, goal, 8, delta)
      if (Math.abs(slot.position.y - goal) > 1e-4) moving = true
      else slot.position.y = goal
    })

    if (moving) invalidate()
  })

  return (
    <group ref={pitchRef} name="furniture-stack">
      <group ref={yawRef}>
        <group position={centerOffset}>
          <group ref={frameSlot}>
            <primitive object={frame.scene} />
            {exploded && <LayerLabel text={config.layers.frame.label} />}
          </group>

          <group ref={softSlot} visible={softVisible}>
            <primitive object={soft.scene} />
            {exploded && <LayerLabel text={config.layers.soft.label} />}
          </group>

          <group ref={coverSlot}>
            {/* Its own Suspense: a child that suspends hides the *nearest*
                boundary's whole subtree, so without this a cover swap would
                blank the frame and cushions too. */}
            <Suspense fallback={null}>
              {/* A single corrupt variant degrades to "unavailable" in the
                  grid; the frame and cushions keep rendering. */}
              <PartErrorBoundary
                category="cover"
                onError={(_category, error) => variant && setLayerError(variant.id, error.message)}
              >
                {coverMounted && variant && (
                  <CoverLayer
                    key={variant.id}
                    variant={variant}
                    direction={coverDirection}
                    durationMs={(config.wipe?.durationMs ?? 900) / 2}
                    onWipeComplete={coverPhase === 'wipeOut' ? commitCover : finishWipe}
                  />
                )}
              </PartErrorBoundary>
            </Suspense>
            {exploded && <LayerLabel text={config.layers.cover.label} />}
          </group>

          {sources && variant && (
            <Suspense fallback={null}>
              <PartErrorBoundary category="cover-source">
                <CoverSource path={variant.path} sources={sources} />
              </PartErrorBoundary>
            </Suspense>
          )}
        </group>
      </group>
    </group>
  )
}

function LayerLabel({ text }: { text: string }) {
  return (
    <Html center distanceFactor={6} position={[0.9, 0.25, 0]} zIndexRange={[20, 0]}>
      <span
        dir="rtl"
        className="font-persian whitespace-nowrap rounded-full border border-[var(--gold-primary)]/30
                   bg-black/70 px-3 py-1 text-[11px] text-[var(--text-primary)] backdrop-blur-sm"
      >
        {text}
      </span>
    </Html>
  )
}
