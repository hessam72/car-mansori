'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { DoorController } from '@/lib/DoorController'

/**
 * Visualises what the hinge solver decided, for `?hinges=1` on /car/[id].
 *
 * Each pivot gets an AxesHelper oriented to the car frame — red is the
 * passenger side, green is up, blue points at the rear — plus a box around the
 * part it drives. If a part opens the wrong way, this shows immediately whether
 * the cause is a mislocated hinge or a misread car frame.
 */
export function HingeDebug({ controller }: { controller: DoorController | null }) {
  const { scene, invalidate } = useThree()

  useEffect(() => {
    if (!controller) return

    const added: THREE.Object3D[] = []
    const frame = controller.carFrame
    const pivots = controller.debugPivots

    // Size the gizmos off the hinged panels — not the whole scene, which would
    // include the floor and blow the scale up
    const partsBox = new THREE.Box3()
    for (const { node } of pivots) partsBox.expandByObject(node)
    const gizmoSize = partsBox.isEmpty()
      ? 0.5
      : Math.max(partsBox.getSize(new THREE.Vector3()).length() * 0.15, 0.2)

    for (const { key, pivot, node } of pivots) {
      const axes = new THREE.AxesHelper(gizmoSize)
      axes.name = `${key}__axes`
      // Draw over the bodywork so a hinge buried inside a panel is still visible
      const material = axes.material as THREE.Material
      material.depthTest = false
      axes.renderOrder = 999
      pivot.add(axes)
      added.push(axes)

      // Captured closed — these are the extents the hinge was solved from, so
      // they deliberately stay put while the part swings
      const box = new THREE.Box3().setFromObject(node)
      const boxHelper = new THREE.Box3Helper(box, new THREE.Color('#d4af37'))
      boxHelper.name = `${key}__box`
      scene.add(boxHelper)
      added.push(boxHelper)
    }

    const round = (v: THREE.Vector3) => v.toArray().map((n) => +n.toFixed(3))
    console.log('[HingeDebug] car frame source:', frame.source)
    console.table({
      forward: round(frame.forward),
      right: round(frame.right),
      up: round(frame.up),
    })
    console.table(
      Object.fromEntries(
        pivots.map(({ key, pivot }) => [
          key,
          { hinge: round(pivot.getWorldPosition(new THREE.Vector3())).join(', ') },
        ])
      )
    )

    invalidate()

    return () => {
      for (const helper of added) {
        helper.removeFromParent()
        if (helper instanceof THREE.Box3Helper || helper instanceof THREE.AxesHelper) {
          helper.dispose()
        }
      }
      invalidate()
    }
  }, [controller, scene, invalidate])

  return null
}

/** True when the page URL asks for the hinge gizmos, e.g. /car/sample-car?hinges=1 */
export function isHingeDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('hinges')
}
