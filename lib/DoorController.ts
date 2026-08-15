import * as THREE from 'three'
import { gsap } from 'gsap'
import {
  deriveCarFrame,
  extentInFrame,
  frameQuaternion,
  pointInFrame,
  type CarFrame,
  type FrameOverride,
} from '@/lib/car/carFrame'

/**
 * Door / hood / trunk hinges.
 *
 * The hinge for every part is expressed in the car's own frame (see
 * lib/car/carFrame.ts) rather than in the part node's local axes. Part nodes
 * routinely carry their own rotation and non-uniform scale — on the Sketchfab
 * export used for testing, each panel has a ~120° quaternion and a scale like
 * [0.32, 1.03, 1.06] — so their local axes say nothing about where the front of
 * the car is. Working in the car frame is what makes one set of signs correct
 * for every model.
 *
 * Each pivot is also *oriented* to that frame, so after construction:
 *   pivot local X = passenger side, Y = roof, Z = rear.
 * Doors then always swing about local Y and hood/trunk always lift about local
 * X, which is why the rotation signs below are fixed constants rather than
 * something to re-tune per GLB.
 */

export type PartKind = 'door-left' | 'door-right' | 'hood' | 'trunk'

/** Per-part override from cars.json, for a model the heuristics read wrongly */
export interface HingeOverride {
  /** Which end of the car the hinge sits on. Defaults per part kind. */
  edge?: 'front' | 'rear'
  /** Opening angle in degrees, overriding the per-kind default */
  angleDeg?: number
  /** Reverse the opening direction */
  flip?: boolean
}

export interface DoorControllerOptions {
  doorAngleDeg?: number
  hoodAngleDeg?: number
  trunkAngleDeg?: number
  durationSec?: number
  /** Force the car's axes when wheel empties are missing or misplaced */
  frame?: FrameOverride
  /** Keyed by part node name, e.g. `{ car_caput: { angleDeg: 60 } }` */
  hinges?: Record<string, HingeOverride>
}

interface PartSpec {
  key: string
  node: string
  kind: PartKind
  window?: string
  handles?: string[]
}

/**
 * The parts the controller knows how to open. `key` matches the openParts state
 * in stores/carConfigStore.ts; `node` is the mesh name expected in the GLB.
 */
const PART_SPECS: PartSpec[] = [
  {
    key: 'car_door_left',
    node: 'car_door_left',
    kind: 'door-left',
    window: 'car_window_left',
    handles: ['door_left_attach', 'door_left_attach_2', 'door_dside_f'],
  },
  {
    key: 'car_door_right',
    node: 'car_door_right',
    kind: 'door-right',
    window: 'car_window_right',
    handles: ['door_right_attach', 'door_right_attach_2', 'door_dside_f001'],
  },
  {
    key: 'car_door_back_left',
    node: 'car_door_back_left',
    kind: 'door-left',
    window: 'car_window_back_left',
    handles: ['door_left_back_attach'],
  },
  {
    key: 'car_door_back_right',
    node: 'car_door_back_right',
    kind: 'door-right',
    window: 'car_window_back_right',
    handles: ['door_right_back_attach'],
  },
  {
    key: 'car_caput',
    node: 'car_caput',
    kind: 'hood',
    handles: ['caput_attach'],
  },
  {
    key: 'car_trunk',
    node: 'car_trunk',
    kind: 'trunk',
    window: 'car_window_back',
    handles: ['back_attach', 'back_attach_2', 'back_attach_3'],
  },
]

/**
 * Which end of the car each part hinges on, and which way it swings.
 *
 * `sign` is applied to the opening angle about `axis` in the pivot's frame-
 * aligned space (X = right, Y = up, Z = rear). Derived from geometry:
 *  - a left door extends rearward (+Z) from its front hinge and its free end
 *    must travel to the left (−X), which needs a negative rotation about Y;
 *  - a hood extends forward (−Z) from its rear hinge and its free end must
 *    rise (+Y), which needs a positive rotation about X.
 */
const HINGE_RULES: Record<
  PartKind,
  { edge: 'front' | 'rear'; axis: 'x' | 'y'; sign: 1 | -1; upEdge: 'center' | 'top' }
> = {
  'door-left': { edge: 'front', axis: 'y', sign: -1, upEdge: 'center' },
  'door-right': { edge: 'front', axis: 'y', sign: 1, upEdge: 'center' },
  // Hood hinges at the windshield end and lifts its nose
  hood: { edge: 'rear', axis: 'x', sign: 1, upEdge: 'top' },
  // Trunk hinges at the cabin end and lifts its tail
  trunk: { edge: 'front', axis: 'x', sign: -1, upEdge: 'top' },
}

interface Hinge {
  spec: PartSpec
  /**
   * Sits at the hinge point, rotated to the car frame. Never animated — the
   * frame alignment has to live one level above the tween, because writing a
   * single Euler component on a node whose quaternion is already rotated
   * overwrites that rotation instead of composing with it.
   */
  orient: THREE.Object3D
  /** Child of `orient`, identity at rest. This is what GSAP drives. */
  swing: THREE.Object3D
  /** Where the part's node lived before it was re-parented, for dispose() */
  originalParent: THREE.Object3D
  node: THREE.Object3D
  axis: 'x' | 'y'
  /** Signed opening angle in radians */
  openAngle: number
  /** Slide offset in frame axes, sized from the part itself */
  offset: THREE.Vector3
}

export class DoorController {
  private hinges = new Map<string, Hinge>()
  private frame: CarFrame
  private invalidate: () => void
  private duration: number
  private disposed = false

  constructor(
    scene: THREE.Object3D,
    invalidate: () => void,
    options: DoorControllerOptions = {}
  ) {
    this.invalidate = invalidate

    const {
      doorAngleDeg = 70,
      hoodAngleDeg = 45,
      trunkAngleDeg = 80,
      durationSec = 1.2,
      frame: frameOverride,
      hinges: overrides = {},
    } = options

    this.duration = durationSec

    // Every measurement below reads world positions
    scene.updateMatrixWorld(true)

    this.frame = deriveCarFrame(scene, frameOverride)
    console.log('[DoorController] Car frame (%s):', this.frame.source, {
      forward: this.frame.forward.toArray().map((n) => +n.toFixed(3)),
      right: this.frame.right.toArray().map((n) => +n.toFixed(3)),
      up: this.frame.up.toArray().map((n) => +n.toFixed(3)),
    })

    const anglePerKind: Record<PartKind, number> = {
      'door-left': doorAngleDeg,
      'door-right': doorAngleDeg,
      hood: hoodAngleDeg,
      trunk: trunkAngleDeg,
    }

    for (const spec of PART_SPECS) {
      const node = scene.getObjectByName(spec.node)
      if (!node) continue

      const override = overrides[spec.node]
      const hinge = this.createHinge(
        scene,
        spec,
        node,
        anglePerKind[spec.kind],
        override
      )
      if (hinge) this.hinges.set(spec.key, hinge)
    }

    const found = [...this.hinges.keys()]
    const missing = PART_SPECS.filter((s) => !this.hinges.has(s.key)).map((s) => s.node)
    console.log('[DoorController] Hinged parts:', found)
    if (missing.length) {
      // Not an error — a 2-door model legitimately has no rear doors
      console.log('[DoorController] Parts absent from this model:', missing)
    }
  }

  /** Part keys that actually resolved in this model, for gating the UI */
  public get availableParts(): string[] {
    return [...this.hinges.keys()]
  }

  public get carFrame(): CarFrame {
    return this.frame
  }

  /**
   * Hinge nodes keyed by part, for the ?hinges=1 debug overlay. Exposes the
   * frame-aligned `orient` node rather than the animated `swing`, so the gizmo
   * shows the car frame the hinge was solved in — which is the thing you need
   * to judge when a part opens wrongly.
   */
  public get debugPivots(): { key: string; pivot: THREE.Object3D; node: THREE.Object3D }[] {
    return [...this.hinges.values()].map((h) => ({
      key: h.spec.key,
      pivot: h.orient,
      node: h.node,
    }))
  }

  private createHinge(
    scene: THREE.Object3D,
    spec: PartSpec,
    node: THREE.Object3D,
    angleDeg: number,
    override: HingeOverride | undefined
  ): Hinge | null {
    const originalParent = node.parent
    if (!originalParent) {
      console.warn(`[DoorController] "${spec.node}" has no parent, skipping`)
      return null
    }

    const extent = extentInFrame(node, this.frame)
    if (!extent) {
      console.warn(`[DoorController] "${spec.node}" has no geometry to measure, skipping`)
      return null
    }

    const rule = HINGE_RULES[spec.kind]
    const edge = override?.edge ?? rule.edge

    // Hinge sits on one end of the part along the car's length, at the part's
    // own lateral centre, and either mid-height (doors) or on the top skin
    const forwardAt = edge === 'front' ? extent.maxForward : extent.minForward
    const rightAt = (extent.minRight + extent.maxRight) / 2
    const upAt =
      rule.upEdge === 'top' ? extent.maxUp : (extent.minUp + extent.maxUp) / 2

    const hingeWorld = pointInFrame(this.frame, forwardAt, rightAt, upAt)

    // Two nodes, not one. `orient` carries the hinge point and the rotation
    // into the car frame; `swing` is its child, starts at identity, and is the
    // only thing animated. Collapsing them would mean tweening one Euler
    // component of an already-rotated node, which overwrites the frame
    // alignment rather than composing with it — the part would then be wrong
    // even at rest.
    //
    // Both hang off the model root rather than the part's own parent:
    // intermediate GLB nodes routinely carry rotation and non-uniform scale
    // (this test model stacks three ±90° X rotations), and a scaled parent
    // would skew the axes away from the frame.
    const orient = new THREE.Object3D()
    orient.name = `${spec.node}__hinge`
    scene.add(orient)
    orient.position.copy(scene.worldToLocal(hingeWorld.clone()))

    // Align to the car: X = right, Y = up, Z = rear
    const rootWorldQuat = scene.getWorldQuaternion(new THREE.Quaternion())
    orient.quaternion.copy(rootWorldQuat.invert().multiply(frameQuaternion(this.frame)))

    const swing = new THREE.Object3D()
    swing.name = `${spec.node}__swing`
    orient.add(swing)
    orient.updateMatrixWorld(true)

    // attach() preserves each object's world transform across the re-parent
    swing.attach(node)

    if (spec.window) {
      const win = scene.getObjectByName(spec.window)
      if (win) {
        win.updateMatrixWorld(true)
        swing.attach(win)
      }
    }

    for (const handleName of spec.handles ?? []) {
      const handle = scene.getObjectByName(handleName)
      if (handle) {
        handle.updateMatrixWorld(true)
        swing.attach(handle)
      }
    }

    // Real doors ease outward off their hinge as they swing. Scaled from the
    // part itself so it reads the same on a hatchback and a limousine, where
    // the old fixed 0.11 world units did not. Hood and trunk pivot cleanly now
    // that the hinge is on the right edge, so they need no translation at all.
    const partLength = Math.abs(extent.maxForward - extent.minForward)
    const offset = new THREE.Vector3()
    if (spec.kind === 'door-left') offset.setX(-0.05 * partLength)
    else if (spec.kind === 'door-right') offset.setX(0.05 * partLength)

    const sign = override?.flip ? -rule.sign : rule.sign
    const openAngle = sign * THREE.MathUtils.degToRad(override?.angleDeg ?? angleDeg)

    return {
      spec,
      orient,
      swing,
      originalParent,
      node,
      axis: rule.axis,
      openAngle,
      offset,
    }
  }

  /** Opens or closes one part by its openParts key. Unknown keys are ignored. */
  public setOpen(partKey: string, isOpen: boolean) {
    if (this.disposed) return
    const hinge = this.hinges.get(partKey)
    if (!hinge) return

    // `swing` starts at identity inside the frame-aligned `orient`, so 0 is a
    // true closed pose and the axis means what it says
    gsap.to(hinge.swing.rotation, {
      [hinge.axis]: isOpen ? hinge.openAngle : 0,
      duration: this.duration,
      ease: 'power2.inOut',
      onUpdate: this.invalidate,
    })

    gsap.to(hinge.swing.position, {
      x: isOpen ? hinge.offset.x : 0,
      y: isOpen ? hinge.offset.y : 0,
      z: isOpen ? hinge.offset.z : 0,
      duration: this.duration,
      ease: 'power2.inOut',
      onUpdate: this.invalidate,
    })
  }

  /** Applies a whole openParts record in one go */
  public applyOpenState(openParts: Record<string, boolean>) {
    for (const [key, isOpen] of Object.entries(openParts)) {
      this.setOpen(key, !!isOpen)
    }
  }

  public openLeftFrontDoor(isOpen: boolean) {
    this.setOpen('car_door_left', isOpen)
  }

  public openRightFrontDoor(isOpen: boolean) {
    this.setOpen('car_door_right', isOpen)
  }

  public openLeftBackDoor(isOpen: boolean) {
    this.setOpen('car_door_back_left', isOpen)
  }

  public openRightBackDoor(isOpen: boolean) {
    this.setOpen('car_door_back_right', isOpen)
  }

  public openHood(isOpen: boolean) {
    this.setOpen('car_caput', isOpen)
  }

  public openTrunk(isOpen: boolean) {
    this.setOpen('car_trunk', isOpen)
  }

  /**
   * Stops every tween and returns the parts to the parents they were taken
   * from. Without this a model swap would build a second controller on top of
   * the first one's pivots and measure hinges from already-rotated panels.
   */
  public dispose() {
    if (this.disposed) return
    this.disposed = true

    for (const hinge of this.hinges.values()) {
      gsap.killTweensOf(hinge.swing.rotation)
      gsap.killTweensOf(hinge.swing.position)

      // Re-home the part, window and handles before dropping the hinge nodes
      for (const child of [...hinge.swing.children]) {
        hinge.originalParent.attach(child)
      }
      hinge.orient.removeFromParent()
    }

    this.hinges.clear()
  }
}
