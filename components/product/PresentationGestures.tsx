'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePresentation } from '@/stores/presentationStore'
import type { PresentationConfig } from '@/lib/product/presentation'
import type { StackControls, StackFraming } from './FurnitureStack'

const SPIN_SENSITIVITY = 0.0075
/** How far the piece may be dragged off its seated height, as a multiple of
 *  its own height. Enough to look under it or lift it clear of the sheet,
 *  not enough to lose it off-screen. */
const LIFT_LIMIT_RATIO = 0.6

interface Props {
  config: PresentationConfig
  controls: React.MutableRefObject<StackControls>
  framing: React.MutableRefObject<StackFraming | null>
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
export default function PresentationGestures({ config, controls, framing }: Props) {
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

  const minZoom = config.camera.minZoom ?? 0.6
  const maxZoom = config.camera.maxZoom ?? 1.8

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
          ` distV ${distV.toFixed(2)} distH ${distH.toFixed(2)} framed ${framedDistance.current.toFixed(2)}`
      )
    }
    targetDistance.current = framedDistance.current * zoom.current
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
      targetDistance.current = framedDistance.current * zoom.current
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
        // Vertical drag moves the piece, it does not tilt it. Converted through
        // the view height at the piece's depth so the model tracks the finger
        // 1:1 at any zoom or screen size — a fixed px→radian factor felt
        // faster on a phone than on a desktop.
        const halfFov = Math.tan(THREE.MathUtils.degToRad(config.camera.fov) / 2)
        const worldPerPixel = (2 * distance.current * halfFov) / (el.clientHeight || 1)
        const limit = (framing.current?.size.y ?? 1) * LIFT_LIMIT_RATIO
        controls.current.lift = THREE.MathUtils.clamp(
          controls.current.lift - dy * worldPerPixel,
          -limit,
          limit
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
  }, [gl, minZoom, maxZoom, controls, framing, config.camera.fov, invalidate, regress])

  useFrame((_, delta) => {
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
