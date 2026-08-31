'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { applyMatte, collectZoneTargets, disposeTargets, preparePresentationObject } from '@/lib/three/layerMaterials'
import { applyFirstCoat, useZonePaint } from '@/hooks/useZonePaint'
import { usePresentation } from '@/stores/presentationStore'
import { useQuality } from '@/contexts/QualityContext'
import { PartErrorBoundary } from '@/components/car/PartErrorBoundary'
import {
  findCoverVariant,
  isMatte,
  type LayerMeta,
  type PresentationConfig,
  type PresentationZone,
} from '@/lib/product/presentation'
import type { ExportSources } from '@/lib/three/exportConfigured'
import CoverLayer from './CoverLayer'
import type { WipeDirection } from '@/hooks/useClipWipe'

/** Rotation/tilt targets live in refs, not the store — a 60Hz zustand write
 *  would re-render the whole bottom sheet every frame. */
export interface StackControls {
  yaw: number
  /** Vertical drag, in radians about the horizontal axis through the piece's
   *  own centre. Drag up tips it towards the viewer, down tips it away. */
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
  /** `?debug=1` — draws the piece's ground plane so it can be lined up against
   *  the floor in the backdrop photograph. */
  debug?: boolean
  /** Filled in with the raw cached GLTFs so the AR export can rebuild the piece
   *  from the sources rather than from this live, half-animated subtree. */
  sources?: React.MutableRefObject<ExportSources>
}

/** One GLB layer: cloned, prepared, its colourable subset tagged with a zone. */
function useLayer(path: string, zone: PresentationZone, matte: boolean, match?: string) {
  const gltf = useGLTF(path)
  const { settings } = useQuality()

  const { scene, targets } = useMemo(() => {
    const clone = gltf.scene.clone(true)
    preparePresentationObject(clone, {
      envMapIntensity: matte ? 0 : settings.envIntensity,
      anisotropy: settings.anisotropyLevel,
    })
    const collected = collectZoneTargets(clone, { zone, match })
    applyFirstCoat(collected, usePresentation.getState().paint)
    if (matte) applyMatte(collected)
    return { scene: clone, targets: collected }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene, path, matte])

  useZonePaint(targets)
  useEffect(() => () => disposeTargets(targets), [targets])

  return { scene, targets, source: gltf.scene }
}

/**
 * Registers the active cover's source scene without rendering it.
 *
 * The mounted CoverLayer only exists at the finished step, but two things need
 * the cover regardless: the AR export, which always ships the whole piece, and
 * the camera framing — with the soft layer gone the cover is what overhangs the
 * frame, so a camera framed to the frame alone crops the arms.
 *
 * It reads the same drei cache CoverLayer does, so this costs no extra fetch.
 */
function CoverSource({
  path,
  sources,
  onBounds,
}: {
  path: string
  sources?: React.MutableRefObject<ExportSources>
  onBounds: (box: THREE.Box3) => void
}) {
  const { scene } = useGLTF(path)
  useEffect(() => {
    if (sources) sources.current.cover = scene
    onBounds(new THREE.Box3().setFromObject(scene))
  }, [scene, sources, onBounds])
  return null
}

/** The soft layer is optional — a product can ship as frame + cover alone. */
function SoftLayer({
  meta,
  matte,
  sources,
}: {
  meta: LayerMeta
  matte: boolean
  sources?: React.MutableRefObject<ExportSources>
}) {
  const soft = useLayer(meta.path, 'cushion', matte, meta.zoneMatch)
  useEffect(() => {
    if (!sources) return
    sources.current.soft = soft.source
    // Cleared on unmount, or the AR export would keep shipping a layer the
    // page has stopped showing.
    return () => {
      sources.current.soft = null
    }
  }, [sources, soft.source])
  return <primitive object={soft.scene} />
}

export default function FurnitureStack({ config, controls, framing, sources, debug }: FurnitureStackProps) {
  const invalidate = useThree((s) => s.invalidate)

  const layerStep = usePresentation((s) => s.layerStep)
  const exploded = usePresentation((s) => s.exploded)
  const coverId = usePresentation((s) => s.coverId)
  const coverPhase = usePresentation((s) => s.coverPhase)
  const commitCover = usePresentation((s) => s.commitCover)
  const finishWipe = usePresentation((s) => s.finishWipe)
  const setLayerError = usePresentation((s) => s.setLayerError)

  const matte = isMatte(config)
  const softMeta = config.layers.soft

  // The frame never changes path, so loading it here rather than in a child
  // makes its bounding box available in the same render — the centering offset
  // lands on the first committed frame, with no one-frame pop.
  const frame = useLayer(config.layers.frame.path, 'wood', matte)

  // Reported by CoverSource once the active variant is in cache.
  const [coverBox, setCoverBox] = useState<THREE.Box3 | null>(null)

  const gap = config.explode?.gap ?? 0.45

  // Centred in X/Z but *seated* in Y: the piece stands on the room floor rather
  // than floating at the origin, and the frame alone defines the offset so the
  // three layers (authored at a shared world origin) never drift apart.
  const { centerOffset, baseSize } = useMemo(() => {
    // The frame alone is the structural datum for centering — it is the layer
    // that always exists and never changes. Framing, though, unions in the
    // cover: the upholstery overhangs the frame on every real piece, and a
    // camera framed to the frame alone crops the arms.
    const box = new THREE.Box3().setFromObject(frame.scene)
    const center = box.getCenter(new THREE.Vector3())
    const outer = coverBox ? box.clone().union(coverBox) : box.clone()
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
  }, [frame.scene, coverBox, config.room.floorY, config.layers.frame.path])

  useEffect(() => {
    if (!sources) return
    sources.current.frame = frame.source
    sources.current.centerOffset = centerOffset
  }, [sources, frame.source, centerOffset])

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

  // The piece's centre — the same height the camera frames on, and the axis
  // the tilt turns about.
  const pivotY = (config.room.floorY ?? 0) + baseSize.y / 2
  // Kept out of `framing` on purpose: the camera must not follow this, or the
  // piece would never move on screen. See the note on room.pieceOffsetY.
  const pieceOffsetY = config.room.pieceOffsetY ?? 0

  const pitchRef = useRef<THREE.Group>(null)
  const yawRef = useRef<THREE.Group>(null)
  const frameSlot = useRef<THREE.Group>(null)
  const softSlot = useRef<THREE.Group>(null)
  const coverSlot = useRef<THREE.Group>(null)

  const variant = findCoverVariant(config, coverId)

  // Box3 has no value equality, so compare before setting or the framing memo
  // re-runs on every cover mount and the camera re-frames for nothing.
  const handleCoverBounds = useCallback((box: THREE.Box3) => {
    setCoverBox((previous) => (previous && previous.equals(box) ? previous : box))
  }, [])

  // The cover stays mounted through a wipe-out so it animates away rather than
  // popping when you step back off it.
  const coverMounted = !!variant && (layerStep === 1 || coverPhase === 'wipeOut')
  const coverDirection: WipeDirection =
    coverPhase === 'wipeIn' ? 'in' : coverPhase === 'wipeOut' ? 'out' : null

  // Layers are exclusive now: choosing a material hides the skeleton. Exploded
  // is the exception — fanning two layers apart is pointless with one hidden.
  const frameVisible = exploded || layerStep === 0
  const softVisible = exploded || layerStep === 0

  useFrame((_, delta) => {
    const pitch = pitchRef.current
    const yaw = yawRef.current
    if (!pitch || !yaw) return

    const target = controls.current
    const nextYaw = THREE.MathUtils.damp(yaw.rotation.y, target.yaw, 12, delta)
    const nextPitch = THREE.MathUtils.damp(pitch.rotation.x, target.pitch, 12, delta)

    let moving = Math.abs(nextYaw - target.yaw) > 1e-4 || Math.abs(nextPitch - target.pitch) > 1e-4
    yaw.rotation.y = nextYaw
    pitch.rotation.x = nextPitch

    // Explode fans the layers apart along Y; the clip plane follows via each
    // layer's world matrix, so no special-casing is needed there. The soft slot
    // drops out of the ladder entirely when the product has no soft layer, so
    // the cover does not fan to a gap that nothing occupies.
    const slots = softMeta
      ? [frameSlot.current, softSlot.current, coverSlot.current]
      : [frameSlot.current, coverSlot.current]
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
    // The tilt pivot is raised to the piece's centre and undone immediately
    // below it. Rotating about the world origin instead would swing the piece
    // through an arc — invisible at the old 16°, but it throws it off-screen at
    // 60°, because the piece sits a metre or so above that origin.
    <group ref={pitchRef} name="furniture-stack" position={[0, pivotY + pieceOffsetY, 0]}>
      <group position={[0, -pivotY, 0]}>
        <group ref={yawRef}>
          <group position={centerOffset}>
            <group ref={frameSlot} visible={frameVisible}>
              <primitive object={frame.scene} />
              {exploded && <LayerLabel text={config.layers.frame.label} />}
            </group>

            {softMeta && (
              <group ref={softSlot} visible={softVisible}>
                <Suspense fallback={null}>
                  <PartErrorBoundary category="soft">
                    <SoftLayer meta={softMeta} matte={matte} sources={sources} />
                  </PartErrorBoundary>
                </Suspense>
                {exploded && <LayerLabel text={softMeta.label} />}
              </group>
            )}

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
                      matte={matte}
                      durationMs={(config.wipe?.durationMs ?? 900) / 2}
                      onWipeComplete={coverPhase === 'wipeOut' ? commitCover : finishWipe}
                    />
                  )}
                </PartErrorBoundary>
              </Suspense>
              {exploded && <LayerLabel text={config.layers.cover.label} />}
            </group>

            {variant && (
              <Suspense fallback={null}>
                <PartErrorBoundary category="cover-source">
                  <CoverSource path={variant.path} sources={sources} onBounds={handleCoverBounds} />
                </PartErrorBoundary>
              </Suspense>
            )}

            {debug && <GroundGuide y={config.room.floorY ?? 0} radius={Math.max(baseSize.x, baseSize.z)} />}
          </group>
        </group>
      </group>
    </group>
  )
}

/** The plane the piece is standing on, drawn flat. Line this up with the floor
 *  in the backdrop photograph using room.pieceOffsetY / room.imageOffsetY. */
function GroundGuide({ y, radius }: { y: number; radius: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.48, radius * 0.5, 64]} />
      <meshBasicMaterial color="#00ff9c" transparent opacity={0.9} side={THREE.DoubleSide} />
    </mesh>
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
