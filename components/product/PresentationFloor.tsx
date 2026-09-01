'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { useQuality } from '@/contexts/QualityContext'
import { floorReflection, type PresentationConfig, type PresentationFloorConfig } from '@/lib/product/presentation'

/** Fallback footprint when there is no modelled room to measure — a photographed
 *  backdrop has no floor to fit to, so the manifest has to say. */
const FALLBACK_SIZE = 12

const floorDebugRequested = () =>
  process.env.NODE_ENV === 'development' &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('floordebug') === '1'

/**
 * A reflection laid over the room's own floor, rather than in place of it.
 *
 * /store reflects with an opaque plane that carries its own concrete texture,
 * which works there because the salon floor *is* that plane. A room GLB already
 * has a floor, so what is ported here is the technique and not the component:
 * drei's planar reflector — the scene re-rendered from a camera mirrored through
 * the plane, obliquely clipped so nothing below it leaks in — on a transparent
 * plane with no `map` of its own, a few millimetres above the real floor.
 *
 * Three things make the texture survive, and all three matter:
 *
 *  - **No map, and alpha under 1.** The layer is reflection only. What it does
 *    not cover, the real floor shows through, so the tiles are still tiles.
 *  - **`depthWrite` off.** A coplanar overlay that writes depth fights the
 *    surface it sits on at grazing angles, which is most of this camera's
 *    range. It is drawn in the transparent pass, after the floor it blends
 *    with, so it has no depth to contribute.
 *  - **Neither casting nor receiving.** Casting would print a hard-edged
 *    rectangle of shade onto the floor 4mm below it. Receiving would apply the
 *    sun's shadow a second time, over a floor that has already taken it — and
 *    a shadow falling across a polished floor dims its diffuse, not the things
 *    reflected in it, so leaving it to the real floor is also the truer answer.
 *
 * Off below the quality tier that affords it, and off with no `floor` block:
 * the reflection re-renders the scene from the mirror's frustum on every drawn
 * frame, which is the same cost /store gates. The fallback is simply the room's
 * own floor, so nothing is missing when it is skipped — the reason this can be
 * dropped silently where /store had to swap in a matte plane.
 */
export default function PresentationFloor({
  config,
  roomBox,
}: {
  config: PresentationConfig
  /** The measured room, once PresentationRoom has loaded it. */
  roomBox?: THREE.Box3 | null
}) {
  const { settings } = useQuality()
  const invalidate = useThree((s) => s.invalidate)

  const [override, setOverride] = useState<PresentationFloorConfig | null>(null)
  const cfg = useMemo(() => override ?? floorReflection(config), [override, config])

  // The room's footprint, so the plane reaches the walls and stops. Fitted to
  // the box rather than inset: the far edge is then buried under the wall
  // rather than ending in a visible seam short of it.
  const size = useMemo(() => {
    if (cfg.size) return cfg.size
    if (!roomBox) return FALLBACK_SIZE
    const s = roomBox.getSize(new THREE.Vector3())
    return Math.max(s.x, s.z)
  }, [cfg.size, roomBox])

  // Centred on the room, not the origin — `room.offset` slides the room around
  // the piece, so the two are not the same point.
  const centre = useMemo<[number, number]>(() => {
    if (!roomBox) return [0, 0]
    const c = roomBox.getCenter(new THREE.Vector3())
    return [c.x, c.z]
  }, [roomBox])

  const y = (config.room.floorY ?? 0) + cfg.offsetY

  // Demand loop: the reflector fills its FBO from useFrame, so without a frame
  // it mounts and never draws.
  useEffect(() => invalidate(), [invalidate, cfg, size, centre, y])

  if (!cfg.enabled || !settings.floorReflectionsEnabled) return null

  return (
    <>
      <mesh
        name="presentation-floor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[centre[0], y, centre[1]]}
        castShadow={false}
        receiveShadow={false}
        renderOrder={1}
      >
        <planeGeometry args={[size, size]} />
        <MeshReflectorMaterial
          resolution={settings.floorReflectionResolution}
          // `mirror` 1 makes the layer the reflection itself rather than a
          // surface tinted by it; the blend below is what holds it back, so
          // opacity stays the single dial for "how much floor is left".
          mirror={1}
          mixStrength={cfg.mixStrength}
          mixBlur={cfg.mixBlur}
          mixContrast={cfg.mixContrast}
          depthScale={cfg.depthScale}
          minDepthThreshold={cfg.minDepthThreshold}
          maxDepthThreshold={cfg.maxDepthThreshold}
          roughness={cfg.roughness}
          metalness={cfg.metalness}
          color={cfg.color}
          transparent
          opacity={cfg.opacity}
          blending={cfg.blend === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      {floorDebugRequested() && <FloorDebug cfg={cfg} size={size} onChange={setOverride} />}
    </>
  )
}

const STEP = 0.05

/**
 * Dev-only (?floordebug=1) tuner, in the shape of SunDebug and LampDebug.
 *
 * Opacity and mix strength are the two values that cannot be picked without the
 * room in front of you — how much sheen a floor takes depends entirely on how
 * bright and how busy its texture is — and `b` flips the blend, which is the
 * call to make once you can see whether the reflection is darkening the tiles.
 *
 *   [ / ]   opacity          - / +   mix strength
 *   , / .   blur             b       normal ⇄ additive
 */
function FloorDebug({
  cfg,
  size,
  onChange,
}: {
  cfg: PresentationFloorConfig
  size: number
  onChange: (next: PresentationFloorConfig) => void
}) {
  const invalidate = useThree((s) => s.invalidate)
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = { ...cfgRef.current }
      let handled = true
      switch (e.key) {
        case '[': c.opacity = Math.max(0, +(c.opacity - STEP).toFixed(2)); break
        case ']': c.opacity = Math.min(1, +(c.opacity + STEP).toFixed(2)); break
        case '-': case '_': c.mixStrength = Math.max(0, +(c.mixStrength - STEP * 2).toFixed(2)); break
        case '+': case '=': c.mixStrength = +(c.mixStrength + STEP * 2).toFixed(2); break
        case ',': c.mixBlur = Math.max(0, +(c.mixBlur - STEP * 2).toFixed(2)); break
        case '.': c.mixBlur = +(c.mixBlur + STEP * 2).toFixed(2); break
        case 'b': c.blend = c.blend === 'additive' ? 'normal' : 'additive'; break
        default: handled = false
      }
      if (!handled) return
      e.preventDefault()
      onChange(c)
      invalidate()
      // eslint-disable-next-line no-console
      console.info(
        `[floordebug] ${size.toFixed(1)}m plane · paste into furniture-presentation.json →\n` +
          JSON.stringify({ floor: c }, null, 2)
      )
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [invalidate, onChange, size])

  return null
}
