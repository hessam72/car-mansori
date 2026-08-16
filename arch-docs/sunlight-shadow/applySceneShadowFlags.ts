import * as THREE from 'three'

export type ShadowFlagOptions = {
  /** Substring (lowercased) marking window panes that must not cast. */
  glassToken?: string
  /** Cast from both faces — needed for thin single-plane walls / frames. */
  doubleSidedShadows?: boolean
}

/**
 * Apply the GLB shadow contract to a loaded scene graph. Call once per model
 * right after load (on the clone you actually add to the scene).
 *
 * Rules:
 * - every mesh casts + receives
 * - meshes named *glass* do NOT cast: the shadow depth pass is alpha-blind, so
 *   a transparent pane would black out the entire sun patch. Frames/mullions
 *   keep casting and that is what paints the window pattern on the floor.
 * - shadowSide = DoubleSide so thin geometry casts regardless of GLB winding
 *   (affects the depth pass only; material.side is untouched)
 */
export function applySceneShadowFlags(root: THREE.Object3D, opts: ShadowFlagOptions = {}) {
  const { glassToken = 'glass', doubleSidedShadows = true } = opts

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return

    obj.castShadow = true
    obj.receiveShadow = true

    if (obj.name.toLowerCase().includes(glassToken)) {
      obj.castShadow = false
    }

    if (doubleSidedShadows && obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      materials.forEach((mat) => {
        mat.shadowSide = THREE.DoubleSide
        mat.needsUpdate = true
      })
    }
  })
}

/**
 * Invisible collision/wireframe proxies must be excluded from both shadow
 * passes, or they cast from geometry the player can't see.
 */
export function disableShadows(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false
      obj.receiveShadow = false
    }
  })
}
