#!/usr/bin/env node
/**
 * Checks the door/hood/trunk hinge solver against a real GLB, headlessly.
 *
 *   node scripts/verify-hinges.mjs [path/to/model.glb] [--door-style=scissor]
 *
 * Both door styles are checked by default, so a regression in either is caught.
 *
 * It rebuilds the scene graph straight from the glTF JSON — POSITION accessors
 * carry exact min/max, so no DRACO decode is needed — then reproduces the same
 * two-node hinge structure lib/DoorController.ts builds at runtime and asserts:
 *
 *   1. CLOSED IS A NO-OP. With the swing node at rotation 0, every part sits
 *      exactly where it started. This is the invariant that matters most: a
 *      hinge can be geometrically perfect and still wreck the closed pose if
 *      the frame rotation and the animated rotation share one node, because
 *      tweening a single Euler component then overwrites the frame alignment
 *      rather than composing with it.
 *
 *   2. OPEN GOES THE RIGHT WAY. Conventional doors swing outward, scissor
 *      doors lift vertically without drifting sideways, hood and trunk lift.
 *
 * Run it whenever a new car GLB lands. Exits non-zero on failure.
 */
import * as THREE from 'three'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const modelPath = args.find((a) => !a.startsWith('--')) ?? 'public/scene-optimized.glb'

const styleArg = args.find((a) => a.startsWith('--door-style='))
const styles = styleArg ? [styleArg.split('=')[1]] : ['conventional', 'scissor']

// A showroom GLB holds several cars, each with its own car_door_left etc. The
// runtime scopes DoorController to one car's subtree; this does the same, so
// the check reads the car you meant rather than whichever node comes first.
const subtreeArg = args.find((a) => a.startsWith('--subtree='))
const subtreeName = subtreeArg ? subtreeArg.split('=').slice(1).join('=') : null

const USAGE =
  'Usage: node scripts/verify-hinges.mjs [path/to/model.glb] ' +
  '[--door-style=conventional|scissor] [--subtree=<node name>]'

const KNOWN_FLAGS = ['--door-style=', '--subtree=']
const unknownFlag = args.find(
  (a) => a.startsWith('--') && !KNOWN_FLAGS.some((f) => a.startsWith(f))
)
if (unknownFlag) {
  console.error(`Unknown option: ${unknownFlag}`)
  console.error(USAGE)
  process.exit(1)
}

const invalidStyle = styles.find((s) => s !== 'conventional' && s !== 'scissor')
if (invalidStyle) {
  console.error(`Unknown door style "${invalidStyle}" (expected conventional or scissor)`)
  console.error(USAGE)
  process.exit(1)
}

if (!fs.existsSync(modelPath)) {
  console.error(`No such model: ${modelPath}`)
  console.error(USAGE)
  process.exit(1)
}

// ---------------------------------------------------------------- glTF JSON

function readGltfJson(file) {
  const buf = fs.readFileSync(file)
  if (path.extname(file) === '.gltf') return JSON.parse(buf.toString('utf8'))

  let off = 12 // skip magic + version + length
  while (off < buf.length) {
    const len = buf.readUInt32LE(off)
    const type = buf.readUInt32LE(off + 4)
    if (type === 0x4e4f534a) return JSON.parse(buf.slice(off + 8, off + 8 + len).toString('utf8'))
    off += 8 + len + ((4 - (len % 4)) % 4)
  }
  throw new Error('No JSON chunk found in GLB')
}

const gltf = readGltfJson(modelPath)
const NODES = gltf.nodes ?? []
const worldOf = new Map()

function buildWorldMatrices(index, parentMatrix) {
  const node = NODES[index]
  const local = new THREE.Matrix4()
  if (node.matrix) local.fromArray(node.matrix)
  else
    local.compose(
      new THREE.Vector3(...(node.translation ?? [0, 0, 0])),
      new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1])),
      new THREE.Vector3(...(node.scale ?? [1, 1, 1]))
    )
  const world = parentMatrix.clone().multiply(local)
  worldOf.set(index, world)
  for (const child of node.children ?? []) buildWorldMatrices(child, world)
}

// Every root, not just the first — a room GLB is rarely a single tree
for (const root of gltf.scenes[gltf.scene ?? 0].nodes) {
  buildWorldMatrices(root, new THREE.Matrix4())
}

/** Node indices in the subtree rooted at `index`, inclusive */
function descendants(index, out = []) {
  out.push(index)
  for (const child of NODES[index].children ?? []) descendants(child, out)
  return out
}

let searchScope = NODES.map((_, i) => i)

if (subtreeName) {
  const rootOfSubtree = searchScope.find(
    (i) => NODES[i].name?.toLowerCase() === subtreeName.toLowerCase()
  )
  if (rootOfSubtree === undefined) {
    console.error(`No node named "${subtreeName}" in ${modelPath}`)
    const named = NODES.filter((n) => n.name).slice(0, 40).map((n) => n.name)
    console.error(`Named nodes: ${named.join(', ')}`)
    process.exit(1)
  }
  searchScope = descendants(rootOfSubtree)
  console.log(`subtree: ${NODES[rootOfSubtree].name} (${searchScope.length} nodes)`)
}

// Later entries would otherwise win; keeping the first match mirrors
// Object3D.getObjectByName, which returns the first hit in traversal order
const indexByName = new Map()
for (const i of searchScope) {
  const name = NODES[i].name?.toLowerCase()
  if (name && !indexByName.has(name)) indexByName.set(name, i)
}
const nodeIndex = (name) => indexByName.get(name.toLowerCase())
const worldPosition = (name) =>
  new THREE.Vector3().setFromMatrixPosition(worldOf.get(nodeIndex(name)))

// ------------------------------------------------------------- the car frame
// Mirrors deriveCarFrame() in lib/car/carFrame.ts

const WHEELS = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR']
const missingWheels = WHEELS.filter((w) => nodeIndex(w) === undefined)
if (missingWheels.length) {
  console.error(`Missing wheel empties: ${missingWheels.join(', ')}`)
  console.error('The frame would fall back to the bounding-box heuristic.')
  process.exit(1)
}

const [pFL, pFR, pRL, pRR] = WHEELS.map(worldPosition)
const midFront = pFL.clone().add(pFR).multiplyScalar(0.5)
const midRear = pRL.clone().add(pRR).multiplyScalar(0.5)
const midRight = pFR.clone().add(pRR).multiplyScalar(0.5)
const midLeft = pFL.clone().add(pRL).multiplyScalar(0.5)

const up = new THREE.Vector3()
  .crossVectors(midRight.clone().sub(midLeft), midFront.clone().sub(midRear))
  .normalize()
const forward = midFront.clone().sub(midRear).projectOnPlane(up).normalize()
const right = new THREE.Vector3().crossVectors(forward, up).normalize()
const frame = { forward, right, up }

const fmt = (v) => `[${v.toArray().map((n) => n.toFixed(3).padStart(6)).join(', ')}]`
console.log(`model: ${modelPath}\n`)
console.log('CAR FRAME (from wheel empties)')
console.log(`  forward ${fmt(forward)}`)
console.log(`  right   ${fmt(right)}`)
console.log(`  up      ${fmt(up)}`)

// The basis must be right-handed or every rotation sign flips
const handedness = new THREE.Vector3().crossVectors(right, up)
const handednessError = handedness.distanceTo(forward.clone().negate())
console.log(
  `  right x up = -forward: ${handednessError < 1e-6 ? 'OK' : `FAILED (off by ${handednessError.toFixed(4)})`}`
)

// ------------------------------------------------------- extents along frame

function extentInFrame(index) {
  const e = {
    minForward: Infinity, maxForward: -Infinity,
    minRight: Infinity, maxRight: -Infinity,
    minUp: Infinity, maxUp: -Infinity,
  }
  let sawGeometry = false

  const visit = (i) => {
    const node = NODES[i]
    if (node.mesh !== undefined) {
      const world = worldOf.get(i)
      for (const prim of gltf.meshes[node.mesh].primitives) {
        const accessor = gltf.accessors[prim.attributes.POSITION]
        if (!accessor?.min) continue
        const [ax, ay, az] = accessor.min
        const [bx, by, bz] = accessor.max
        for (const x of [ax, bx]) for (const y of [ay, by]) for (const z of [az, bz]) {
          const v = new THREE.Vector3(x, y, z).applyMatrix4(world)
          sawGeometry = true
          const f = v.dot(frame.forward), r = v.dot(frame.right), u = v.dot(frame.up)
          if (f < e.minForward) e.minForward = f
          if (f > e.maxForward) e.maxForward = f
          if (r < e.minRight) e.minRight = r
          if (r > e.maxRight) e.maxRight = r
          if (u < e.minUp) e.minUp = u
          if (u > e.maxUp) e.maxUp = u
        }
      }
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(index)
  return sawGeometry ? e : null
}

// ------------------------------------------------------------- hinge rules
// Mirrors HINGE_RULES / SCISSOR_DOOR_RULE in lib/DoorController.ts

const LID_RULES = {
  car_caput: { edge: 'rear', axis: 'x', sign: 1, heightFraction: 1, angle: 45, kind: 'lid' },
  car_trunk: { edge: 'front', axis: 'x', sign: -1, heightFraction: 1, angle: 80, kind: 'lid' },
}

const DOOR_NAMES = [
  'car_door_left',
  'car_door_right',
  'car_door_back_left',
  'car_door_back_right',
]

const isLeftDoor = (name) => name.endsWith('_left')

function doorRule(name, style) {
  // Scissor rotates about the lateral axis, so the motion stays in the
  // vertical/longitudinal plane and both sides share one rule
  if (style === 'scissor') {
    return { edge: 'front', axis: 'x', sign: -1, heightFraction: 0.25, angle: 70, kind: 'door' }
  }
  return {
    edge: 'front',
    axis: 'y',
    sign: isLeftDoor(name) ? -1 : 1,
    heightFraction: 0.5,
    angle: 70,
    kind: 'door',
  }
}

function rulesForStyle(style) {
  const rules = {}
  for (const name of DOOR_NAMES) rules[name] = doorRule(name, style)
  return { ...rules, ...LID_RULES }
}

const frameQuat = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.forward.clone().negate())
)

const EPSILON = 1e-6
// A scissor door should stay in the vertical plane; anything more than this
// fraction of its vertical travel means the axis is canted or mis-signed
const LATERAL_TOLERANCE = 0.05

/** Runs every assertion for one door style. Returns the failure count. */
function checkStyle(style) {
  let failures = 0
  console.log(`\n${'='.repeat(64)}\nDOOR STYLE: ${style}\n${'='.repeat(64)}`)

  for (const [name, rule] of Object.entries(rulesForStyle(style))) {
    const index = nodeIndex(name)
    if (index === undefined) {
      console.log(`\n  ${name}: absent from this model (skipped)`)
      continue
    }

    const e = extentInFrame(index)
    if (!e) {
      console.log(`\n  ${name}: no geometry (skipped)`)
      continue
    }

    const forwardAt = rule.edge === 'front' ? e.maxForward : e.minForward
    const rightAt = (e.minRight + e.maxRight) / 2
    const upAt = e.minUp + (e.maxUp - e.minUp) * rule.heightFraction

    const hinge = new THREE.Vector3()
      .addScaledVector(frame.forward, forwardAt)
      .addScaledVector(frame.right, rightAt)
      .addScaledVector(frame.up, upAt)

    // The runtime structure: orient (hinge point + frame rotation) > swing > part
    const orientWorld = new THREE.Matrix4().compose(hinge, frameQuat, new THREE.Vector3(1, 1, 1))
    const partWorldBefore = worldOf.get(index)
    // attach() preserves world transform, so the part's matrix relative to swing
    const partInSwing = orientWorld.clone().invert().multiply(partWorldBefore)

    const swingAt = (radians) => {
      const euler = new THREE.Euler()
      euler[rule.axis] = radians
      const swingLocal = new THREE.Matrix4().makeRotationFromEuler(euler)
      return orientWorld.clone().multiply(swingLocal).multiply(partInSwing)
    }

    // --- assertion 1: closed is a no-op ---
    const closed = swingAt(0)
    let closedDrift = 0
    for (let i = 0; i < 16; i++) {
      closedDrift = Math.max(closedDrift, Math.abs(closed.elements[i] - partWorldBefore.elements[i]))
    }
    const closedOk = closedDrift < EPSILON

    // --- assertion 2: opening travels the right way ---
    const farForward = rule.edge === 'front' ? e.minForward : e.maxForward
    const freeEnd = new THREE.Vector3()
      .addScaledVector(frame.forward, farForward)
      .addScaledVector(frame.right, rightAt)
      .addScaledVector(frame.up, upAt)

    const toLocal = swingAt(0).clone().invert()
    const localFreeEnd = freeEnd.clone().applyMatrix4(toLocal)
    const openedFreeEnd = localFreeEnd
      .clone()
      .applyMatrix4(swingAt(rule.sign * THREE.MathUtils.degToRad(rule.angle)))

    const delta = openedFreeEnd.clone().sub(freeEnd)
    const dRight = delta.dot(frame.right)
    const dUp = delta.dot(frame.up)

    const onRightSide = rightAt > 0
    const isScissorDoor = rule.kind === 'door' && style === 'scissor'

    let openOk
    let expectation
    if (isScissorDoor) {
      // Straight up, and it must NOT drift sideways — that is what separates
      // scissor from a butterfly door and catches a canted or mis-signed axis
      openOk = dUp > 0 && Math.abs(dRight) <= LATERAL_TOLERANCE * Math.abs(dUp)
      expectation = openOk
        ? 'lifts vertically OK'
        : dUp <= 0
          ? 'FAILED — sinks instead of lifting'
          : 'FAILED — drifts sideways, axis is not lateral'
    } else if (rule.kind === 'door') {
      openOk = onRightSide ? dRight > 0 : dRight < 0
      expectation = openOk ? 'swings outward OK' : 'FAILED — swings into the car'
    } else {
      openOk = dUp > 0
      expectation = openOk ? 'lifts up OK' : 'FAILED — moves downward'
    }

    if (!closedOk) failures++
    if (!openOk) failures++

    const sideLabel = rule.kind === 'door' ? (onRightSide ? 'right side' : 'left side') : 'centre'
    console.log(
      `\n  ${name}  (${sideLabel}, hinge on ${rule.edge} edge at ${(rule.heightFraction * 100).toFixed(0)}% height)`
    )
    console.log(
      `    extent  forward[${e.minForward.toFixed(2)}, ${e.maxForward.toFixed(2)}]` +
        `  right[${e.minRight.toFixed(2)}, ${e.maxRight.toFixed(2)}]` +
        `  up[${e.minUp.toFixed(2)}, ${e.maxUp.toFixed(2)}]`
    )
    console.log(`    hinge   ${fmt(hinge)}`)
    console.log(
      `    closed  drift ${closedDrift.toExponential(1)}  ${closedOk ? 'OK' : 'FAILED — part moves when shut'}`
    )
    console.log(
      `    open    right ${dRight >= 0 ? '+' : ''}${dRight.toFixed(2)}  up ${dUp >= 0 ? '+' : ''}${dUp.toFixed(2)}  ${expectation}`
    )
  }

  return failures
}

const failures = styles.reduce((total, style) => total + checkStyle(style), 0)

console.log(
  failures === 0
    ? `\nAll hinge checks passed (${styles.join(', ')}).\n`
    : `\n${failures} hinge check(s) FAILED.\n`
)
process.exit(failures === 0 ? 0 : 1)
