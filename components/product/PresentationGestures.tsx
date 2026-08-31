'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePresentation } from '@/stores/presentationStore'
import type { PresentationConfig } from '@/lib/product/presentation'
import type { StackControls, StackFraming } from './FurnitureStack'
import type { RoomBounds } from './PresentationRoom'

const SPIN_SENSITIVITY = 0.0075
const TILT_SENSITIVITY = 0.005
/** A tenth of a full turn each way. Still reads clearly as movement — the old
 *  16° did not — without the wide swing of the 60° it replaces. Override per
 *  product with `camera.tiltLimitDeg`. */
const TILT_LIMIT_DEG = 36

interface Props {
  config: PresentationConfig
  controls: React.MutableRefObject<StackControls>
  framing: React.MutableRefObject<StackFraming | null>
  /** The walls, when the backdrop is a modelled room. */
  roomBounds?: React.MutableRefObject<RoomBounds | null>
}

/** Clearance kept between the camera and the wall behind it, in metres. */
const WALL_MARGIN = 0.35

/**
 * How far the camera can travel back along `dir` from `origin` before it leaves
 * the box.
 *
 * The rig sizes its distance from the piece alone and knows nothing about the
 * room. That held while the piece was measured once, in a single render — but
 * the cover's bounds now arrive after load, so the framing changes and the
 * camera reverses. Through the back wall, the screen is solid black.
 *
 * The origin is clamped into the box first: the look-at target is aimed *below*
 * the piece to clear the bottom sheet, and with the sheet open it can dip under
 * the floor. Bailing out there would switch the clamp off exactly when the
 * camera is furthest back.
 */
const clampedOrigin = new THREE.Vector3()

function distanceToWall(origin: THREE.Vector3, dir: THREE.Vector3, box: THREE.Box3): number {
  box.clampPoint(origin, clampedOrigin)
  let limit = Infinity
  for (const axis of ['x', 'y', 'z'] as const) {
    const d = dir[axis]
    if (Math.abs(d) < 1e-6) continue
    const t = ((d > 0 ? box.max[axis] : box.min[axis]) - clampedOrigin[axis]) / d
    if (t > 0) limit = Math.min(limit, t)
  }
  return limit
}

/**
 * The whole interaction model for this page.
 *
 * The camera never rotates and never orbits — it sits on a view ray derived
 * once from the piece's measured bounds and only slides along it. One finger
 * spins the *model*; two fingers (or the wheel) dolly within a hard clamp.
 *
 * Listeners attach to `gl.domElement`, not `document`. RotatableCar uses
 * document, which means a pointerdown anywhere — including on the bottom
 * sheet — starts a model spin. Canvas-scoping removes that conflict
 * structurally instead of heuristically.
 */
export default function PresentationGestures({ config, controls, framing, roomBounds }: Props) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  const regress = useThree((s) => s.performance.regress)

  const sheetCoverage = usePresentation((s) => s.sheetCoverage)

  const target = useRef(new THREE.Vector3())
  const desiredTarget = useRef(new THREE.Vector3())
  const viewDir = useRef(new THREE.Vector3(0, 0, 1))
  const framedDistance = useRef(0)
  const distance = useRef(0)
  const targetDistance = useRef(0)
  /** Zoom survives a re-frame (rotation, resize) as a ratio, not an absolute. */
  const zoom = useRef(1)
  const appliedVersion = useRef(-1)
  const settled = useRef(false)
  const warnedTight = useRef(false)

  const minZoom = config.camera.minZoom ?? 0.6
  const maxZoom = config.camera.maxZoom ?? 1.8
  const tiltLimit = THREE.MathUtils.degToRad(config.camera.tiltLimitDeg ?? TILT_LIMIT_DEG)

  /** How far back the wall lets the camera go. Infinity with no room. */
  const wallLimit = () => {
    const box = roomBounds?.current?.box
    if (!box) return Infinity
    const limit = distanceToWall(desiredTarget.current, viewDir.current, box) - WALL_MARGIN
    return limit > 0 ? limit : Infinity
  }

  /**
   * The distance to actually fly to, for a given zoom factor.
   *
   * The wall caps the *base* framing distance before zoom is applied, rather
   * than capping the final number. Capping the result pins the camera to the
   * wall and the dolly stops responding entirely — which is exactly what a
   * flat `Math.min(framed * zoom, limit)` did. Scaling the base instead keeps
   * the full zoom range usable inside whatever room there is: a piece that
   * cannot be framed without backing through the wall simply gets cropped a
   * little, which is the right trade.
   */
  const solveDistance = (zoomFactor: number) => {
    const limit = wallLimit()
    const base = Math.min(framedDistance.current, limit)
    return Math.min(base * zoomFactor, limit)
  }

  // Framing is the fiddliest thing on this page — `?debug=1` prints the solve.
  const trace =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug')

  /**
   * Distance at which the piece just fits, then padded.
   *
   * `fov` is vertical, so on a portrait canvas the horizontal field is far
   * narrower than it looks — a distance tuned on desktop puts the camera
   * inside the sofa on a phone. Both axes are solved and the larger wins.
   */
  const reframe = () => {
    const frame = framing.current
    if (!frame || !size.height) return

    const aspect = size.width / size.height
    const fovRad = THREE.MathUtils.degToRad(config.camera.fov)
    const halfFov = Math.tan(fovRad / 2)

    // Worst-case silhouette: the piece can be spun to any yaw.
    const radius = Math.hypot(frame.size.x, frame.size.z) / 2
    // The piece has to fit the band the sheet leaves visible, not the whole
    // viewport. Capped so an over-tall sheet cannot push the camera to infinity
    // — the sheet's own max height is kept below this so the two agree.
    const coverage = Math.min(sheetCoverage, 0.62)
    const distV = frame.size.y / (1 - coverage) / 2 / halfFov
    const distH = radius / (halfFov * aspect)
    framedDistance.current = Math.max(distV, distH) * (config.camera.padding ?? 1.15)

    // Aiming below the centre lifts the piece up-screen, clear of the sheet.
    // Half the sheet's coverage re-centres the piece in the visible band; the
    // configured lift is a small extra bias on top.
    const viewHeight = 2 * framedDistance.current * halfFov
    const lift = (coverage / 2 + (config.camera.screenLift ?? 0.02)) * viewHeight
    desiredTarget.current.copy(frame.center).setY(frame.center.y - lift)

    const azimuth = THREE.MathUtils.degToRad(config.camera.azimuthDeg ?? 0)
    const elevation = THREE.MathUtils.degToRad(config.camera.elevationDeg ?? 10)
    viewDir.current
      .set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation))
      .normalize()

    if (trace) {
      console.log(
        `[reframe] coverage ${coverage.toFixed(3)} aspect ${aspect.toFixed(3)}` +
          ` size ${frame.size.toArray().map((n) => +n.toFixed(2)).join('/')}` +
          ` distV ${distV.toFixed(2)} distH ${distH.toFixed(2)} framed ${framedDistance.current.toFixed(2)}` +
          ` wall ${roomBounds?.current?.box ? wallLimit().toFixed(2) : 'none'}` +
          ` → dist ${solveDistance(zoom.current).toFixed(2)}`
      )
    }
    if (process.env.NODE_ENV !== 'production' && !warnedTight.current) {
      const limit = wallLimit()
      if (limit < framedDistance.current) {
        warnedTight.current = true
        console.warn(
          `[PresentationGestures] the room wall is ${limit.toFixed(2)}m back but the piece needs` +
            ` ${framedDistance.current.toFixed(2)}m to frame — the view is cropped and the dolly` +
            ` range is squeezed. Lower camera.padding, or scale the room GLB up.`
        )
      }
    }

    targetDistance.current = solveDistance(zoom.current)
    // First frame snaps; a later re-frame (explode, resize) eases via useFrame
    // so the pull-back reads as part of the explode animation.
    if (!settled.current) {
      distance.current = targetDistance.current
      target.current.copy(desiredTarget.current)
      settled.current = true
      camera.position.copy(target.current).addScaledVector(viewDir.current, distance.current)
      camera.lookAt(target.current)
    }
    invalidate()
  }

  // Re-frame on mount, on a resize/orientation change, and when the stack
  // reports new bounds (a different product, or a layer that loaded late).
  useFrame(() => {
    const version = framing.current?.version ?? -1
    if (version >= 0 && version !== appliedVersion.current) {
      appliedVersion.current = version
      reframe()
    }
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reframe, [size.width, size.height, config.camera, sheetCoverage])

  useEffect(() => {
    const el = gl.domElement
    const pointers = new Map<number, { x: number; y: number }>()
    let mode: 'idle' | 'rotate' | 'pinch' = 'idle'
    let pinchStart = 0

    const pinchDistance = () => {
      const [a, b] = Array.from(pointers.values())
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    const applyZoom = (factor: number) => {
      zoom.current = THREE.MathUtils.clamp(zoom.current * factor, minZoom, maxZoom)
      targetDistance.current = solveDistance(zoom.current)
    }

    const onPointerDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      // A second finger landing must not feed its first delta into the spin.
      mode = pointers.size >= 2 ? 'pinch' : 'rotate'
      if (mode === 'pinch') pinchStart = pinchDistance()
      regress()
      invalidate()
    }

    const onPointerMove = (e: PointerEvent) => {
      const previous = pointers.get(e.pointerId)
      if (!previous) return
      const dx = e.clientX - previous.x
      const dy = e.clientY - previous.y
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (mode === 'pinch' && pointers.size >= 2) {
        const current = pinchDistance()
        if (current > 0 && pinchStart > 0) applyZoom(pinchStart / current)
        pinchStart = current
      } else if (mode === 'rotate') {
        controls.current.yaw += dx * SPIN_SENSITIVITY
        // Drag up tips the piece towards you, down tips it away. The rotation
        // happens about the piece's own centre — see FurnitureStack — so it
        // turns in place rather than swinging through an arc.
        controls.current.pitch = THREE.MathUtils.clamp(
          controls.current.pitch - dy * TILT_SENSITIVITY,
          -tiltLimit,
          tiltLimit
        )
      }

      regress()
      invalidate()
    }

    const endPointer = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
      // Dropping from two fingers to one must re-anchor, or the remaining
      // pointer's stale delta snaps the model round.
      if (pointers.size >= 2) {
        mode = 'pinch'
        pinchStart = pinchDistance()
      } else if (pointers.size === 1) {
        mode = 'rotate'
      } else {
        mode = 'idle'
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      applyZoom(1 + delta * 0.0012)
      regress()
      invalidate()
    }

    // iOS Safari treats a two-finger pinch as page zoom unless this is killed.
    const onGesture = (e: Event) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPointer)
    el.addEventListener('pointercancel', endPointer)
    el.addEventListener('lostpointercapture', endPointer)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', onGesture)
    el.addEventListener('gesturechange', onGesture)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endPointer)
      el.removeEventListener('pointercancel', endPointer)
      el.removeEventListener('lostpointercapture', endPointer)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGesture)
      el.removeEventListener('gesturechange', onGesture)
    }
  }, [gl, minZoom, maxZoom, tiltLimit, controls, invalidate, regress])

  useFrame((_, delta) => {
    // Re-clamped every frame, not just on reframe: the room GLB usually
    // resolves after the camera has already settled, and the walls have to
    // pull it back in when they arrive.
    const legal = solveDistance(zoom.current)
    if (legal !== targetDistance.current) targetDistance.current = legal

    const distanceSettled = distance.current === targetDistance.current
    const targetSettled = target.current.distanceToSquared(desiredTarget.current) < 1e-8
    if (distanceSettled && targetSettled) return

    if (!distanceSettled) {
      const next = THREE.MathUtils.damp(distance.current, targetDistance.current, 12, delta)
      distance.current = Math.abs(next - targetDistance.current) < 1e-4 ? targetDistance.current : next
    }
    if (targetSettled) target.current.copy(desiredTarget.current)
    else target.current.lerp(desiredTarget.current, 1 - Math.exp(-10 * delta))

    camera.position.copy(target.current).addScaledVector(viewDir.current, distance.current)
    camera.lookAt(target.current)
    invalidate()
  })

  return null
}
