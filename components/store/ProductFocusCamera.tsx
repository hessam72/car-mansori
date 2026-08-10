'use client'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { markStoreActivity } from './activityGovernor'
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
export function poseForObject(
  obj: THREE.Object3D,
  from: THREE.Vector3,
  override?: FocusOverride
): FocusPose {
  _box.setFromObject(obj)
  _box.getCenter(_center)
  _box.getSize(_size)

  const distance =
    override?.distance ?? THREE.MathUtils.clamp(Math.max(_size.x, _size.z) * 1.1 + 1.2, 1.8, 6)

  if (override?.azimuthDeg !== undefined) {
    const a = override.azimuthDeg * DEG
    _dir.set(Math.sin(a), 0, Math.cos(a))
  } else {
    _dir.set(from.x - _center.x, 0, from.z - _center.z)
    if (_dir.lengthSq() < 1e-4) _dir.set(0, 0, 1)
    _dir.normalize()
  }

  const position = _center.clone().addScaledVector(_dir, distance)
  position.y = _center.y + (override?.height ?? Math.max(_size.y * 0.25, 0.35))

  // Orientation via a scratch object rather than camera.lookAt, so the result
  // is a quaternion we can slerp toward instead of a look-at point we'd have
  // to lerp (which whips the view through a curve and introduces roll)
  _aim.position.copy(position)
  _aim.up.set(0, 1, 0)
  _aim.lookAt(_center)

  return { position, quaternion: _aim.quaternion.clone() }
}

interface ProductFocusCameraProps {
  /** Scene-object name to fly to; null parks the component */
  targetName: string | null
  /** Per-item override of the automatic pose */
  focus?: FocusOverride
  /** Called once the flight lands, with the final pose */
  onArrive: (pose: FocusPose) => void
  /** Called if the named object isn't in the scene */
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

    const search = targetName.toLowerCase()
    let target: THREE.Object3D | undefined
    scene.traverse((child) => {
      if (!target && child.name.toLowerCase() === search) target = child
    })

    if (!target) {
      endPose.current = null
      onMiss?.()
      return
    }

    startPos.current.copy(camera.position)
    startQuat.current.copy(camera.quaternion)
    endPose.current = poseForObject(target, camera.position, focus)
    startTime.current = performance.now()

    markStoreActivity()
    invalidate()
  }, [targetName, focus, scene, camera, invalidate, onMiss])

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
