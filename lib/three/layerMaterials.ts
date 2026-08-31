import * as THREE from 'three'
import { prepareCarMaterial, type CarMaterialOptions } from './prepareCarMaterial'
import type { PresentationZone } from '@/lib/product/presentation'

export interface ZoneTarget {
  material: THREE.MeshPhysicalMaterial
  zone: PresentationZone
}

/**
 * Material prep for the presentation page.
 *
 * Deliberately NOT `prepareCarObject` — that force-sets castShadow/receiveShadow
 * on every mesh, and this page renders with no shadow maps at all. Here we only
 * set env reflection strength and sharpen textures.
 */
export function preparePresentationObject(root: THREE.Object3D, options: CarMaterialOptions = {}) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = false
    child.receiveShadow = false
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((mat: THREE.Material) => mat && prepareCarMaterial(mat, options))
  })
}

/**
 * Strip every specular reflection from a set of painted materials.
 *
 * The HDR environment was reflecting into the upholstery and shifting the
 * colours away from the hex the user actually picked. With no IBL in the scene
 * `envMapIntensity` has nothing to sample, but it is zeroed anyway so a stray
 * `scene.environment` cannot creep back in; `clearcoat` is the other source —
 * a glossy coat over the base colour, authored per cover variant.
 *
 * `reflectivity` is deliberately left alone. Zeroing it would kill the direct
 * specular from the spot rig too, and that is ordinary shading — it is what
 * gives the fabric its form. The complaint was the environment bouncing into
 * the colour, not the lights.
 */
export function applyMatte(targets: ZoneTarget[]) {
  targets.forEach(({ material }) => {
    material.envMapIntensity = 0
    if (material.clearcoat !== undefined) material.clearcoat = 0
  })
}

/** Blender can beat the name heuristic by tagging a mesh; handles both the flat
 *  and the nested `userdata` shape glTF exporters produce. */
function zoneOverride(mesh: THREE.Mesh): PresentationZone | null {
  const data = mesh.userData as Record<string, any> | undefined
  const value = data?.userdata?.zone ?? data?.zone ?? data?.userdata?.paintZone ?? data?.paintZone
  return value === 'wood' || value === 'cover' || value === 'cushion' ? value : null
}

export interface CollectOptions {
  /** Zone every matching mesh in this layer belongs to. */
  zone: PresentationZone
  /** Substring tested against mesh.name. Omit to take every mesh in the layer. */
  match?: string
}

/**
 * Clone the materials this layer owns and tag them with their zone.
 *
 * Cloning is mandatory — drei caches the GLTF, so mutating a material in place
 * would leak colour and clipping planes into every other user of that asset.
 * Meshes outside the match rule are left untouched and un-cloned.
 */
export function collectZoneTargets(root: THREE.Object3D, options: CollectOptions): ZoneTarget[] {
  const { zone, match } = options
  const needle = match?.toLowerCase()
  const targets: ZoneTarget[] = []

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return

    const override = zoneOverride(child)
    const matched = !needle || child.name.toLowerCase().includes(needle)
    if (!override && !matched) return

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    const cloned = materials.map((mat) => {
      const copy = mat.clone() as THREE.MeshPhysicalMaterial
      targets.push({ material: copy, zone: override ?? zone })
      return copy
    })
    child.material = Array.isArray(child.material) ? cloned : cloned[0]
  })

  return targets
}

/** Dispose only the cloned materials — geometry belongs to drei's cache. */
export function disposeTargets(targets: ZoneTarget[]) {
  targets.forEach(({ material }) => material.dispose())
}
