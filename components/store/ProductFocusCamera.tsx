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
// Must be a Camera, not a bare Object3D: Object3D.lookAt swaps eye/target for
// non-cameras, so a plain object ends up with +Z — not -Z — facing the target,
// i.e. the camera would land looking away from the product.
const _aim = new THREE.Camera()

const DURATION = 1400
const DEG = Math.PI / 180

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
 * Places the camera `distance` from `center`, `height` above it, on the side
 * the player is already standing — the only bearing guaranteed not to end up
 * inside a wall, since the room is one GLB with no navmesh to test against.
 */
function poseAround(
  center: THREE.Vector3,
  from: THREE.Vector3,
  distance: number,
  height: number,
  azimuthDeg?: number
): FocusPose {
  if (azimuthDeg !== undefined) {
    const a = azimuthDeg * DEG
    _dir.set(Math.sin(a), 0, Math.cos(a))
  } else {
    _dir.set(from.x - center.x, 0, from.z - center.z)
    if (_dir.lengthSq() < 1e-4) _dir.set(0, 0, 1)
    _dir.normalize()
  }

  const position = center.clone().addScaledVector(_dir, distance)
  position.y = center.y + height

  // Orientation via a scratch camera rather than camera.lookAt, so the result
  // is a quaternion we can slerp toward instead of a look-at point we'd have
  // to lerp (which whips the view through a curve and introduces roll)
  _aim.position.copy(position)
  _aim.up.set(0, 1, 0)
  _aim.lookAt(center)

  return { position, quaternion: _aim.quaternion.clone() }
}

/** Viewing pose derived from the object's world bounds. */
export function poseForObject(
  obj: THREE.Object3D,
  from: THREE.Vector3,
  override?: FocusOverride
): FocusPose {
  _box.setFromObject(obj)
  _box.getCenter(_center)
  _box.getSize(_size)

  return poseAround(
    _center,
    from,
    override?.distance ?? THREE.MathUtils.clamp(Math.max(_size.x, _size.z) * 1.1 + 1.2, 1.8, 6),
    override?.height ?? Math.max(_size.y * 0.25, 0.35),
    override?.azimuthDeg
  )
}

/**
 * Viewing pose around a bare world point — the fallback when the mesh can't be
 * resolved but products.json carries an authored `billboardPosition`.
 */
export function poseForPoint(
  point: [number, number, number],
  from: THREE.Vector3,
  override?: FocusOverride
): FocusPose {
  _center.set(point[0], point[1], point[2])
  return poseAround(
    _center,
    from,
    override?.distance ?? 2.6,
    override?.height ?? 0.35,
    override?.azimuthDeg
  )
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

  useEffect(() => {
    if (!targetName) {
      endPose.current = null
      return
    }

    const target = findSceneObject(scene, [targetName, targetId])

    let pose: FocusPose | null = null
    if (target) {
      pose = poseForObject(target, camera.position, focus)
    } else if (fallbackPoint) {
      // The room may be authored on names we can't match. products.json still
      // says where the product stands, so fly there rather than doing nothing.
      console.warn(
        `[ProductFocusCamera] No object matched "${targetName}"/"${targetId ?? '—'}"; ` +
          'falling back to billboardPosition. Scene names:',
        describeSceneNames(scene)
      )
      pose = poseForPoint(fallbackPoint, camera.position, focus)
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
