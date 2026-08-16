'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { DoorController } from '@/lib/DoorController'
import { findSceneObject, describeSceneNames } from '@/lib/store/sceneObject'
import { useFurnitureConfig } from '@/stores/furnitureConfigStore'
import { useStoreParts, allPartsClosed } from '@/stores/storePartsStore'
import { markStoreActivity } from './activityGovernor'
import type { ProductData } from './ProductInteraction'

/**
 * Door/hood/trunk opening for the showroom, driven from the product drawer.
 *
 * The whole room — cars included — is one GLB, so unlike /car there is no
 * per-car model to hand the controller. Instead each car is a named subtree,
 * and DoorController scopes its `getObjectByName` lookups to whatever root it
 * is given: point it at one car and it finds that car's panels and wheel
 * empties, never its neighbours'.
 *
 * Headless, and mounted inside the Canvas. Mirrors FurnitureColorApplier, which
 * resolves the focused object the same way.
 */

interface CarPartsControllerProps {
  /** products.json, for the optional per-car `parts` tuning */
  products: Record<string, ProductData>
}

export default function CarPartsController({ products }: CarPartsControllerProps) {
  const scene = useThree((s) => s.scene)
  const invalidate = useThree((s) => s.invalidate)

  const selectedFurnitureId = useFurnitureConfig((s) => s.selectedFurnitureId)
  const openParts = useStoreParts((s) => s.openParts)
  const setAvailableParts = useStoreParts((s) => s.setAvailableParts)

  /** One controller per car, built on first focus and kept for the session */
  const controllers = useRef(new Map<string, DoorController>())
  const activeKey = useRef<string | null>(null)

  // Repaint, and hold the demand loop open. invalidate() alone would draw the
  // tween, but ActivityGovernor parks the loop 1500ms after the last input and
  // a drawer button click never reaches the canvas' wake handler — so without
  // the activity stamp a long animation can stall with physics paused.
  const wake = useCallback(() => {
    markStoreActivity()
    invalidate()
  }, [invalidate])

  useEffect(() => {
    const previous = activeKey.current

    // Leaving a car with panels open: shut them behind us. Closing the drawer
    // goes through the store instead, but switching straight to another car
    // never touches closeProduct.
    if (previous && previous !== selectedFurnitureId) {
      controllers.current.get(previous)?.applyOpenState(allPartsClosed())
    }
    activeKey.current = selectedFurnitureId

    if (!selectedFurnitureId) return

    let controller = controllers.current.get(selectedFurnitureId)

    if (!controller) {
      // Same tolerant resolver the camera flight and the paint use, so all
      // three agree on which object a product means
      const car = findSceneObject(scene, [selectedFurnitureId])
      if (!car) {
        console.warn(
          `[CarPartsController] "${selectedFurnitureId}" not found in the room. Scene names:`,
          describeSceneNames(scene)
        )
        setAvailableParts([])
        return
      }

      try {
        controller = new DoorController(car, wake, partsOptionsFor(products, selectedFurnitureId))
      } catch (error) {
        console.error('[CarPartsController] DoorController init failed:', error)
        setAvailableParts([])
        return
      }
      controllers.current.set(selectedFurnitureId, controller)
    }

    setAvailableParts(controller.availableParts)
  }, [selectedFurnitureId, scene, wake, products, setAvailableParts])

  // Drive the focused car, exactly as ConfigurableCar does on /car
  useEffect(() => {
    if (!selectedFurnitureId) return
    controllers.current.get(selectedFurnitureId)?.applyOpenState(openParts)
  }, [openParts, selectedFurnitureId])

  // Controllers outlive focus on purpose: dispose() re-homes panels with
  // Object3D.attach(), which preserves world transform, so tearing one down
  // mid-swing would strand that panel open with nothing left to close it.
  // Closing is a state change that animates out; teardown only happens here.
  useEffect(() => {
    const cache = controllers.current
    return () => {
      for (const controller of cache.values()) controller.dispose()
      cache.clear()
    }
  }, [])

  return null
}

/**
 * The car's hinge tuning. products.json is keyed by scene-object name while the
 * focus key may be the product id, and the two are not guaranteed to match — so
 * fall back to an id scan rather than silently dropping the config.
 */
function partsOptionsFor(products: Record<string, ProductData>, key: string) {
  const direct = products[key]
  if (direct) return direct.parts
  return Object.values(products).find((p) => p.id === key)?.parts
}
