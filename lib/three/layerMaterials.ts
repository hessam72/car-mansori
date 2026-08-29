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
 * boost env reflections and sharpen textures.
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
