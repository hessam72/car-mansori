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

  constructor(carGroup: THREE.Group, invalidate: () => void) {
    this.carGroup = carGroup
    this.invalidate = invalidate
    this.baseY = carGroup.position.y
  }

  /**
   * Set suspension height in centimeters (offset from base position)
   * @param cm Height adjustment in centimeters (-5 to +10)
   */
  setHeight(cm: number) {
    const targetY = this.baseY + cm / 100

    gsap.to(this.carGroup.position, {
      y: targetY,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => this.invalidate(),
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
   * Reset to stock height
   */
  reset() {
    this.setHeight(0)
  }
}
