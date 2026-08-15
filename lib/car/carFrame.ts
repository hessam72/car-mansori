import * as THREE from 'three'

/**
 * The car's own axes, in world space.
 *
 * Every GLB arrives in a different orientation — Blender's Z-up survives some
 * exports, Sketchfab/Collada models carry a stack of ±90° X rotations, and the
 * individual part nodes usually have their own rotation *and* non-uniform scale
 * on top. Reading a part's local axes therefore tells you nothing about where
 * the front of the car is.
 *
 * So we derive one frame for the whole model and express every hinge in it.
 * With that, "a door swings about `up`" and "a hood lifts about `right`" hold
 * for any model, and the rotation signs stop needing per-model tuning.
 */
export interface CarFrame {
  /** Unit vector toward the front of the car */
  forward: THREE.Vector3
  /** Unit vector toward the passenger side (right when sitting in the car) */
  right: THREE.Vector3
  /** Unit vector toward the roof */
  up: THREE.Vector3
  /** How the frame was established — surfaced by the ?hinges=1 overlay */
  source: 'wheels' | 'bounds' | 'override'
}

/** Per-model escape hatch for a GLB the heuristics can't read */
export interface FrameOverride {
  /** World-space vector toward the front of the car, e.g. [1, 0, 0] */
  forward?: [number, number, number]
  /** World-space vector toward the roof, e.g. [0, 1, 0] */
  up?: [number, number, number]
}

const WHEEL_NAMES = {
  frontLeft: 'Wheel_FL',
  frontRight: 'Wheel_FR',
  rearLeft: 'Wheel_RL',
  rearRight: 'Wheel_RR',
} as const

/** Case-insensitive lookup — GLB exporters are inconsistent about casing */
function findNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  const needle = name.toLowerCase()
  let found: THREE.Object3D | null = null
  root.traverse((child) => {
    if (!found && child.name.toLowerCase() === needle) found = child
  })
  return found
}

function worldPosition(node: THREE.Object3D): THREE.Vector3 {
  return node.getWorldPosition(new THREE.Vector3())
}

/**
 * Makes `forward`/`up` a clean orthonormal basis. `up` wins on direction; the
 * forward vector is projected onto the plane perpendicular to it, which is what
 * keeps a slightly-off wheel layout from producing a skewed frame.
 */
function orthonormalize(forward: THREE.Vector3, up: THREE.Vector3, source: CarFrame['source']): CarFrame {
  const u = up.clone().normalize()
  const f = forward.clone().projectOnPlane(u).normalize()
  // right = forward × up gives the passenger side for a right-handed frame
  const r = new THREE.Vector3().crossVectors(f, u).normalize()
  return { forward: f, right: r, up: u, source }
}

/**
 * Frame from the four wheel empties the model naming guide already requires.
 * This is the good path: the wheels pin down front/rear and left/right
 * unambiguously, whatever the export did to the model's orientation.
 */
function frameFromWheels(root: THREE.Object3D): CarFrame | null {
  const fl = findNode(root, WHEEL_NAMES.frontLeft)
  const fr = findNode(root, WHEEL_NAMES.frontRight)
  const rl = findNode(root, WHEEL_NAMES.rearLeft)
  const rr = findNode(root, WHEEL_NAMES.rearRight)

  if (!fl || !fr || !rl || !rr) return null

  const pFL = worldPosition(fl)
  const pFR = worldPosition(fr)
  const pRL = worldPosition(rl)
  const pRR = worldPosition(rr)

  const midFront = pFL.clone().add(pFR).multiplyScalar(0.5)
  const midRear = pRL.clone().add(pRR).multiplyScalar(0.5)
  const midRight = pFR.clone().add(pRR).multiplyScalar(0.5)
  const midLeft = pFL.clone().add(pRL).multiplyScalar(0.5)

  const forward = midFront.clone().sub(midRear)
  const right = midRight.clone().sub(midLeft)

  // Degenerate layout (all four wheels coincident, or a model where the empties
  // were never moved off the origin) — fall through to the bounds heuristic
  if (forward.lengthSq() < 1e-8 || right.lengthSq() < 1e-8) return null

  const up = new THREE.Vector3().crossVectors(right, forward)
  if (up.lengthSq() < 1e-8) return null

  return orthonormalize(forward, up, 'wheels')
}

/**
 * Fallback for models with no wheel empties: assume the glTF +Y-up convention,
 * take the longer horizontal axis as the car's length, and let the hood decide
 * which end is the front.
 */
function frameFromBounds(root: THREE.Object3D, hoodName = 'car_caput'): CarFrame {
  const up = new THREE.Vector3(0, 1, 0)
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())

  // Longer of the two horizontal extents is the car's length
  const forward = size.x >= size.z ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1)

  // The hood sits at the front, so it tells us which way along that axis is forward
  const hood = findNode(root, hoodName)
  if (hood) {
    const center = box.getCenter(new THREE.Vector3())
    const toHood = worldPosition(hood).sub(center)
    if (toHood.dot(forward) < 0) forward.negate()
  }

  return orthonormalize(forward, up, 'bounds')
}

function frameFromOverride(override: FrameOverride): CarFrame | null {
  if (!override.forward && !override.up) return null
  const forward = new THREE.Vector3(...(override.forward ?? [0, 0, 1]))
  const up = new THREE.Vector3(...(override.up ?? [0, 1, 0]))
  if (forward.lengthSq() < 1e-8 || up.lengthSq() < 1e-8) return null
  return orthonormalize(forward, up, 'override')
}

/**
 * Resolves the car's axes, preferring an explicit override, then the wheel
 * empties, then the model's bounding box. Call after `updateMatrixWorld` —
 * every step reads world positions.
 */
export function deriveCarFrame(root: THREE.Object3D, override?: FrameOverride): CarFrame {
  if (override) {
    const forced = frameFromOverride(override)
    if (forced) return forced
  }
  return frameFromWheels(root) ?? frameFromBounds(root)
}

/**
 * Extent of an object along the car's axes, rather than along world X/Y/Z.
 *
 * Projects the object's world-space vertices onto the frame, which is what
 * turns "the front edge of this door" into a number regardless of how the model
 * is oriented. A world-space `Box3` would be axis-aligned to the *world*, so it
 * over-reports every edge as soon as the car sits at an angle in the scene.
 *
 * Returns null for an object with no renderable geometry.
 */
export interface FrameExtent {
  minForward: number
  maxForward: number
  minRight: number
  maxRight: number
  minUp: number
  maxUp: number
}

export function extentInFrame(node: THREE.Object3D, frame: CarFrame): FrameExtent | null {
  const extent: FrameExtent = {
    minForward: Infinity,
    maxForward: -Infinity,
    minRight: Infinity,
    maxRight: -Infinity,
    minUp: Infinity,
    maxUp: -Infinity,
  }

  const vertex = new THREE.Vector3()
  let sawVertex = false

  node.updateWorldMatrix(true, true)
  node.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const position = child.geometry?.getAttribute('position')
    if (!position) return

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position as THREE.BufferAttribute, i)
      vertex.applyMatrix4(child.matrixWorld)
      sawVertex = true

      const f = vertex.dot(frame.forward)
      const r = vertex.dot(frame.right)
      const u = vertex.dot(frame.up)

      if (f < extent.minForward) extent.minForward = f
      if (f > extent.maxForward) extent.maxForward = f
      if (r < extent.minRight) extent.minRight = r
      if (r > extent.maxRight) extent.maxRight = r
      if (u < extent.minUp) extent.minUp = u
      if (u > extent.maxUp) extent.maxUp = u
    }
  })

  return sawVertex ? extent : null
}

/** Rebuilds a world point from coordinates expressed along the frame axes */
export function pointInFrame(
  frame: CarFrame,
  forward: number,
  right: number,
  up: number
): THREE.Vector3 {
  return new THREE.Vector3()
    .addScaledVector(frame.forward, forward)
    .addScaledVector(frame.right, right)
    .addScaledVector(frame.up, up)
}

/**
 * World-space quaternion aligning an object to the frame as
 * X = right, Y = up, Z = rearward.
 *
 * Z points backward rather than forward so the basis stays right-handed
 * (right × up = −forward), matching three.js' own convention where an object
 * looks down its local −Z.
 */
export function frameQuaternion(frame: CarFrame): THREE.Quaternion {
  const basis = new THREE.Matrix4().makeBasis(
    frame.right,
    frame.up,
    frame.forward.clone().negate()
  )
  return new THREE.Quaternion().setFromRotationMatrix(basis)
}
