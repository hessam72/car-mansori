import * as THREE from 'three'
import gsap from 'gsap'

export type SuspensionPreset = 'stock' | 'lowered' | 'raised'

/**
 * Controls suspension height animation for the car group
 * Uses GSAP for smooth transitions, similar to DoorController
 */
export class SuspensionController {
  private carGroup: THREE.Group
  private invalidate: () => void
  private baseY: number
  private excludedNodes: THREE.Object3D[]
  private excludedNodesBaseY: Map<THREE.Object3D, number>

  constructor(carGroup: THREE.Group, invalidate: () => void, excludedNodes: THREE.Object3D[] = []) {
    this.carGroup = carGroup
    this.invalidate = invalidate
    this.baseY = carGroup.position.y
    this.excludedNodes = excludedNodes
    this.excludedNodesBaseY = new Map()

    // Store initial Y positions of excluded nodes
    excludedNodes.forEach(node => {
      this.excludedNodesBaseY.set(node, node.position.y)
    })
  }

  /**
   * Set suspension height in centimeters (offset from base position)
   * @param cm Height adjustment in centimeters (-5 to +10)
   */
  setHeight(cm: number) {
    const targetY = this.baseY + cm / 100
    const offset = cm / 100

    console.log('[SuspensionController] Setting height to', cm, 'cm, offset =', offset, ', excluded nodes:', this.excludedNodes.length)

    gsap.to(this.carGroup.position, {
      y: targetY,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => {
        // Apply inverse transform to excluded nodes (wheels stay grounded)
        this.excludedNodes.forEach(node => {
          const baseY = this.excludedNodesBaseY.get(node) ?? 0
          node.position.y = baseY - offset
        })
        this.invalidate()
      },
    })
  }

  /**
   * Apply preset suspension configuration
   * @param preset stock (0cm), lowered (-3cm), raised (+5cm)
   */
  setPreset(preset: SuspensionPreset) {
    const offsets: Record<SuspensionPreset, number> = {
      stock: 0,
      lowered: -3,
      raised: 5,
    }

    this.setHeight(offsets[preset])
  }

  /**
   * Update excluded nodes (e.g., when wheels are swapped)
   * @param nodes New array of nodes to exclude from suspension transform
   */
  updateExcludedNodes(nodes: THREE.Object3D[]) {
    console.log('[SuspensionController] Updating excluded nodes:', nodes.length, 'nodes')
    this.excludedNodes = nodes
    this.excludedNodesBaseY.clear()

    nodes.forEach(node => {
      console.log('[SuspensionController] Storing base Y for node:', node.name, 'Y =', node.position.y)
      this.excludedNodesBaseY.set(node, node.position.y)
    })
  }

  /**
   * Reset to stock height
   */
  reset() {
    this.setHeight(0)
  }
}
