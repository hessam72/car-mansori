'use client'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { markStoreActivity } from './activityGovernor'
import { findSceneObject, describeSceneNames } from '@/lib/store/sceneObject'
import type { FocusOverride } from '@/lib/store/catalog'

// Frame-loop scratch — never allocate inside useFrame (same rule as
// Joystick.tsx / POVCamera.tsx)
const _box = new THREE.Box3()
const _center = new THREE.Vector3()
const _size = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _open = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _roomBox = new THREE.Box3()
const _roomCenter = new THREE.Vector3()
// Must be a Camera, not a bare Object3D: Object3D.lookAt swaps eye/target for
// non-cameras, so a plain object ends up with +Z — not -Z — facing the target,
// i.e. the camera would land looking away from the product.
const _aim = new THREE.Camera()

const DURATION = 1400
const DEG = Math.PI / 180
const RAD = 180 / Math.PI

/** The object's four horizontal axes, as unit vectors in its local frame */
const LOCAL_AXES: [number, number, number][] = [
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0]
]

/** Below this the product is effectively at the room centre — no inward direction */
const CENTRE_EPSILON = 0.5

/** Bearing in the same convention azimuthDeg uses: 0° = +Z, 90° = +X */
export function bearingToDegrees(dir: THREE.Vector3) {
  return Math.atan2(dir.x, dir.z) * RAD
}

/**
 * The direction to stand in to view `obj` head-on.
 *
 * Two ideas combined. The object's own horizontal axes are the candidates, so
 * the camera ends up square-on to the piece and follows it when the artist
 * rotates it. Which of the four is the *front* is decided by whichever points
 * most toward the middle of the room: showroom furniture sits against walls
 * facing inward, so "inward" is both the front and the side that isn't inside
 * a wall — the property the old player-relative bearing existed to protect.
 *
 * Writes into `out` and returns it.
 */
export function frontBearing(
  obj: THREE.Object3D,
  center: THREE.Vector3,
  roomCenter: THREE.Vector3,
  out: THREE.Vector3
): THREE.Vector3 {
  obj.getWorldQuaternion(_quat)

  _open.set(roomCenter.x - center.x, 0, roomCenter.z - center.z)
  const towardRoom = _open.lengthSq() > CENTRE_EPSILON * CENTRE_EPSILON
  if (towardRoom) _open.normalize()

  let bestDot = -Infinity
  out.set(0, 0, 1).applyQuaternion(_quat)
  out.y = 0
  out.normalize()

  // Product sitting at the room centre: nothing to aim away from, so keep its
  // own forward axis rather than picking an arbitrary one
  if (!towardRoom) return out

  for (const [x, y, z] of LOCAL_AXES) {
    _axis.set(x, y, z).applyQuaternion(_quat)
    _axis.y = 0
    if (_axis.lengthSq() < 1e-8) continue
    _axis.normalize()

    const d = _axis.dot(_open)
    if (d > bestDot) {
      bestDot = d
      out.copy(_axis)
    }
  }

  return out
}

/** easeInOutCubic */
function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export interface FocusPose {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

/**
 * Derives a "standing in front of it" camera pose from the mesh's world bounds.
 *
 * The approach bearing defaults to wherever the player already is, which is the
 * only direction guaranteed not to end up inside a wall — the room geometry is
 * a single GLB with no navmesh to test against.
 */
/**
 * Places the camera `distance` along `bearing` from `center`, `height` above it.
 *
 * `bearing` is deliberately not derived from the player: it used to be, and a
 * player already standing a standoff-distance away produced a landing point
 * equal to where they stood — the camera only rotated, and if they were behind
 * the product it settled behind it.
 */
function poseAround(
  center: THREE.Vector3,
  bearing: THREE.Vector3,
  distance: number,
  height: number
): FocusPose {
  const position = center.clone().addScaledVector(bearing, distance)
  position.y = center.y + height

  // Orientation via a scratch camera rather than camera.lookAt, so the result
  // is a quaternion we can slerp toward instead of a look-at point we'd have
  // to lerp (which whips the view through a curve and introduces roll)
  _aim.position.copy(position)
  _aim.up.set(0, 1, 0)
  _aim.lookAt(center)

  return { position, quaternion: _aim.quaternion.clone() }
}

/** Explicit bearing from an authored azimuth, written into `out`. */
function bearingFromDegrees(azimuthDeg: number, out: THREE.Vector3) {
  const a = azimuthDeg * DEG
  return out.set(Math.sin(a), 0, Math.cos(a))
}

/**
 * Viewing pose derived from the object's world bounds, standing off its front.
 * Returns the bearing too so the caller can log it for `azimuthDeg` tuning.
 */
export function poseForObject(
  obj: THREE.Object3D,
  roomCenter: THREE.Vector3,
  override?: FocusOverride
): FocusPose & { bearing: THREE.Vector3 } {
  _box.setFromObject(obj)
  _box.getCenter(_center)
  _box.getSize(_size)

  const bearing =
    override?.azimuthDeg !== undefined
      ? bearingFromDegrees(override.azimuthDeg, _dir)
      : frontBearing(obj, _center, roomCenter, _dir)

  const pose = poseAround(
    _center,
    bearing,
    override?.distance ?? THREE.MathUtils.clamp(Math.max(_size.x, _size.z) * 1.1 + 1.2, 1.8, 6),
    override?.height ?? Math.max(_size.y * 0.25, 0.35)
  )

  return { ...pose, bearing: bearing.clone() }
}

/**
 * Viewing pose around a bare world point — the fallback when the mesh can't be
 * resolved but products.json carries an authored `billboardPosition`. With no
 * object there are no axes to snap to, so the room-ward direction is used raw.
 */
export function poseForPoint(
  point: [number, number, number],
  roomCenter: THREE.Vector3,
  override?: FocusOverride
): FocusPose & { bearing: THREE.Vector3 } {
  _center.set(point[0], point[1], point[2])

  let bearing: THREE.Vector3
  if (override?.azimuthDeg !== undefined) {
    bearing = bearingFromDegrees(override.azimuthDeg, _dir)
  } else {
    bearing = _dir.set(roomCenter.x - _center.x, 0, roomCenter.z - _center.z)
    if (bearing.lengthSq() < CENTRE_EPSILON * CENTRE_EPSILON) bearing.set(0, 0, 1)
    bearing.normalize()
  }

  const pose = poseAround(
    _center,
    bearing,
    override?.distance ?? 2.6,
    override?.height ?? 0.35
  )

  return { ...pose, bearing: bearing.clone() }
}

interface ProductFocusCameraProps {
  /** products.json key to fly to; null parks the component */
  targetName: string | null
  /** Product id — a second name to try, since the room may be authored on it */
  targetId?: string
  /** Authored world position, used when the mesh itself can't be resolved */
  fallbackPoint?: [number, number, number]
  /** Per-item override of the automatic pose */
  focus?: FocusOverride
  /** Called once the flight lands, with the final pose */
  onArrive: (pose: FocusPose) => void
  /** Called when no flight is possible — the caller should reveal the product
   *  anyway rather than leaving the interaction as a dead end */
  onMiss?: () => void
}

/**
 * Re-triggerable camera flight to a product.
 *
 * Distinct from CameraTransition, which is the single-shot intro fly-in keyed
 * to loadingPhase and deliberately never resets.
 *
 * While this runs, both per-frame camera writers must be frozen — the Rapier
 * body follow in usePlayerPhysics and the look easing in usePOVCamera — or the
 * tween is overwritten on the very next frame. The caller owns that freeze and
 * the landing hand-off.
 */
export function ProductFocusCamera({
  targetName,
  targetId,
  fallbackPoint,
  focus,
  onArrive,
  onMiss
}: ProductFocusCameraProps) {
  const { scene, camera, invalidate } = useThree()

  const startPos = useRef(new THREE.Vector3())
  const startQuat = useRef(new THREE.Quaternion())
  const endPose = useRef<FocusPose | null>(null)
  const startTime = useRef(0)
  // The room is static, and setFromObject walks the whole GLB — compute once
  const roomCenter = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    if (!targetName) {
      endPose.current = null
      return
    }

    if (!roomCenter.current) {
      _roomBox.setFromObject(scene)
      roomCenter.current = _roomBox.getCenter(_roomCenter).clone()
    }
    const room = roomCenter.current

    const target = findSceneObject(scene, [targetName, targetId])

    let pose: (FocusPose & { bearing: THREE.Vector3 }) | null = null
    if (target) {
      pose = poseForObject(target, room, focus)
    } else if (fallbackPoint) {
      // The room may be authored on names we can't match. products.json still
      // says where the product stands, so fly there rather than doing nothing.
      console.warn(
        `[ProductFocusCamera] No object matched "${targetName}"/"${targetId ?? '—'}"; ` +
          'falling back to billboardPosition. Scene names:',
        describeSceneNames(scene)
      )
      pose = poseForPoint(fallbackPoint, room, focus)
    } else {
      console.warn(
        `[ProductFocusCamera] No object matched "${targetName}"/"${targetId ?? '—'}" ` +
          'and no billboardPosition to fall back to. Scene names:',
        describeSceneNames(scene)
      )
    }

    if (!pose) {
      endPose.current = null
      onMiss?.()
      return
    }

    // If a product ends up framed from its back, copy this number, add 180,
    // and set it as `focus.azimuthDeg` on that item in catalog.json
    console.log(
      `[ProductFocusCamera] "${targetName}" bearing ${bearingToDegrees(pose.bearing).toFixed(1)}°` +
        `${focus?.azimuthDeg !== undefined ? ' (authored)' : ''}`
    )

    startPos.current.copy(camera.position)
    startQuat.current.copy(camera.quaternion)
    endPose.current = pose
    startTime.current = performance.now()

    markStoreActivity()
    invalidate()
  }, [targetName, targetId, fallbackPoint, focus, scene, camera, invalidate, onMiss])

  useFrame(() => {
    const end = endPose.current
    if (!end) return

    const t = Math.min((performance.now() - startTime.current) / DURATION, 1)
    const e = ease(t)

    camera.position.lerpVectors(startPos.current, end.position, e)
    camera.quaternion.slerpQuaternions(startQuat.current, end.quaternion, e)

    if (t >= 1) {
      endPose.current = null
      onArrive(end)
      return
    }

    // The scene runs frameloop="demand" — an animation that doesn't ask for
    // frames renders exactly one and then freezes
    markStoreActivity()
    invalidate()
  })

  return null
}
