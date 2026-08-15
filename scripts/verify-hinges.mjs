#!/usr/bin/env node
/**
 * Checks the door/hood/trunk hinge solver against a real GLB, headlessly.
 *
 *   node scripts/verify-hinges.mjs [path/to/model.glb]
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
 *   2. OPEN GOES THE RIGHT WAY. Doors swing outward, hood and trunk lift.
 *
 * Run it whenever a new car GLB lands. Exits non-zero on failure.
 */
import * as THREE from 'three'
import fs from 'node:fs'
import path from 'node:path'

const modelPath = process.argv[2] ?? 'public/scene-optimized.glb'

if (!fs.existsSync(modelPath)) {
  console.error(`No such model: ${modelPath}`)
  console.error('Usage: node scripts/verify-hinges.mjs [path/to/model.glb]')
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

const rootIndex = gltf.scenes[gltf.scene ?? 0].nodes[0]
buildWorldMatrices(rootIndex, new THREE.Matrix4())

const indexByName = new Map()
NODES.forEach((n, i) => {
  if (n.name) indexByName.set(n.name.toLowerCase(), i)
})
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
// Mirrors HINGE_RULES in lib/DoorController.ts

const RULES = {
  car_door_left: { edge: 'front', axis: 'y', sign: -1, upEdge: 'center', angle: 70, kind: 'door' },
  car_door_right: { edge: 'front', axis: 'y', sign: 1, upEdge: 'center', angle: 70, kind: 'door' },
  car_door_back_left: { edge: 'front', axis: 'y', sign: -1, upEdge: 'center', angle: 70, kind: 'door' },
  car_door_back_right: { edge: 'front', axis: 'y', sign: 1, upEdge: 'center', angle: 70, kind: 'door' },
  car_caput: { edge: 'rear', axis: 'x', sign: 1, upEdge: 'top', angle: 45, kind: 'lid' },
  car_trunk: { edge: 'front', axis: 'x', sign: -1, upEdge: 'top', angle: 80, kind: 'lid' },
}

const frameQuat = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(frame.right, frame.up, frame.forward.clone().negate())
)

let failures = 0
const EPSILON = 1e-6

console.log('\nPARTS')

for (const [name, rule] of Object.entries(RULES)) {
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
  const upAt = rule.upEdge === 'top' ? e.maxUp : (e.minUp + e.maxUp) / 2

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
  const openOk = rule.kind === 'door' ? (onRightSide ? dRight > 0 : dRight < 0) : dUp > 0

  if (!closedOk) failures++
  if (!openOk) failures++

  const sideLabel = rule.kind === 'door' ? (onRightSide ? 'right side' : 'left side') : 'centre'
  console.log(`\n  ${name}  (${sideLabel}, hinge on ${rule.edge} edge)`)
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
    `    open    right ${dRight >= 0 ? '+' : ''}${dRight.toFixed(2)}  up ${dUp >= 0 ? '+' : ''}${dUp.toFixed(2)}  ` +
      (openOk
        ? rule.kind === 'door' ? 'swings outward OK' : 'lifts up OK'
        : rule.kind === 'door' ? 'FAILED — swings into the car' : 'FAILED — moves downward')
  )
}

console.log(
  failures === 0
    ? '\nAll hinge checks passed.\n'
    : `\n${failures} hinge check(s) FAILED.\n`
)
process.exit(failures === 0 ? 0 : 1)
