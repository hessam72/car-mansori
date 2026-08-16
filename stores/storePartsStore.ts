import { create } from 'zustand'
import { PART_KEYS } from '@/lib/DoorController'

/**
 * Open/closed state for the panels of the car the showroom is currently focused
 * on.
 *
 * Deliberately separate from stores/carConfigStore.ts. That one is a
 * module-level singleton owned by /car, so sharing it would have the two routes
 * fighting over one `openParts` — and /car additionally resets it on mount.
 *
 * The state is flat rather than keyed by car because panels close when the
 * drawer does, so only one car is ever open at a time. `productKey` records
 * which car the record below belongs to, which is what lets a stale toggle from
 * a car we have already left be ignored.
 */

/**
 * Every part shut. A *complete* record — see the note on `openParts`.
 *
 * Exported because closing a car we have already navigated away from happens
 * imperatively, outside this store's own state.
 */
export const allPartsClosed = (): Record<string, boolean> =>
  Object.fromEntries(PART_KEYS.map((key) => [key, false]))

const allClosed = allPartsClosed

export interface StorePartsState {
  /** products.json key of the focused car, or null when nothing is focused */
  productKey: string | null
  /**
   * Always carries every key in PART_KEYS, never a subset.
   * DoorController.applyOpenState only touches the keys it is handed, so a
   * sparse record would quietly fail to close the parts it omitted.
   */
  openParts: Record<string, boolean>
  /** Parts this car's GLB actually has, from DoorController.availableParts */
  availableParts: string[]

  /** Point the state at a car, starting it shut. Pass null on unfocus. */
  focusCar: (productKey: string | null) => void
  setAvailableParts: (parts: string[]) => void
  togglePart: (partKey: string) => void
  openAllParts: () => void
  closeAllParts: () => void
}

export const useStoreParts = create<StorePartsState>()((set) => ({
  productKey: null,
  openParts: allClosed(),
  availableParts: [],

  // Re-focusing the car we are already on must not clear availableParts:
  // CarPartsController only republishes it when selectedFurnitureId *changes*,
  // so clearing it here would leave the Parts tab claiming the car has none
  focusCar: (productKey) =>
    set((state) =>
      state.productKey === productKey
        ? { openParts: allClosed() }
        : { productKey, openParts: allClosed(), availableParts: [] }
    ),

  setAvailableParts: (availableParts) => set({ availableParts }),

  togglePart: (partKey) =>
    set((state) => ({
      openParts: { ...state.openParts, [partKey]: !state.openParts[partKey] },
    })),

  // Before the model loads availableParts is empty; opening everything then
  // would swing panels the GLB may not have, so an empty list opens nothing
  openAllParts: () =>
    set((state) => ({
      openParts: Object.fromEntries(
        PART_KEYS.map((key) => [key, state.availableParts.includes(key)])
      ),
    })),

  closeAllParts: () => set({ openParts: allClosed() }),
}))
