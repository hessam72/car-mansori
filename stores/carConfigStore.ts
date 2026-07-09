import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type PaintZone = 'body' | 'trim' | 'interior'

export interface PaintConfig {
  color: string
  metalness: number
  roughness: number
  clearcoat: number
}

export type MultiZonePaintConfig = Record<PaintZone, PaintConfig>

export interface CarConfigState {
  selectedParts: Record<string, string>
  paintConfig: MultiZonePaintConfig
  activeZone: PaintZone
  loadingParts: Record<string, boolean>
  partLoadErrors: Record<string, string>
  openParts: Record<string, boolean>
  selectPart: (category: string, partId: string) => void
  setPaintConfig: (config: Partial<PaintConfig>, zone?: PaintZone) => void
  setActiveZone: (zone: PaintZone) => void
  copyZoneToAll: (sourceZone: PaintZone) => void
  setPartLoading: (category: string, isLoading: boolean) => void
  setPartError: (category: string, error: string | null) => void
  togglePart: (partName: string) => void
  openAllParts: () => void
  closeAllParts: () => void
  getTotalPrice: () => number
  resetConfig: (defaultParts?: Record<string, string>) => void
}

const defaultPaintConfig: MultiZonePaintConfig = {
  body: {
    color: '#ff0000',
    metalness: 0.9,
    roughness: 0.3,
    clearcoat: 1.0,
  },
  trim: {
    color: '#000000',
    metalness: 0.5,
    roughness: 0.7,
    clearcoat: 0.3,
  },
  interior: {
    color: '#1a1a1a',
    metalness: 0.1,
    roughness: 0.9,
    clearcoat: 0.0,
  },
}

export const useCarConfig = create<CarConfigState>()(
  devtools(
    (set, get) => ({
      selectedParts: {},
      paintConfig: defaultPaintConfig,
      activeZone: 'body',
      loadingParts: {},
      partLoadErrors: {},
      openParts: {
        car_door_left: false,
        car_door_right: false,
        car_door_back_left: false,
        car_door_back_right: false,
        car_caput: false,
        car_trunk: false,
      },

      selectPart: (category, partId) =>
        set((state) => ({
          selectedParts: { ...state.selectedParts, [category]: partId },
        })),

      setPartLoading: (category, isLoading) =>
        set((state) => ({
          loadingParts: { ...state.loadingParts, [category]: isLoading },
        })),

      setPartError: (category, error) =>
        set((state) => ({
          partLoadErrors: error
            ? { ...state.partLoadErrors, [category]: error }
            : Object.fromEntries(
                Object.entries(state.partLoadErrors).filter(([k]) => k !== category)
              ),
        })),

      setPaintConfig: (config, zone) =>
        set((state) => {
          const targetZone = zone || state.activeZone
          return {
            paintConfig: {
              ...state.paintConfig,
              [targetZone]: { ...state.paintConfig[targetZone], ...config },
            },
          }
        }),

      setActiveZone: (zone) =>
        set({ activeZone: zone }),

      copyZoneToAll: (sourceZone) =>
        set((state) => {
          const sourceConfig = state.paintConfig[sourceZone]
          return {
            paintConfig: {
              body: { ...sourceConfig },
              trim: { ...sourceConfig },
              interior: { ...sourceConfig },
            },
          }
        }),

      togglePart: (partName) => {
        console.log('[carConfigStore] togglePart called:', partName)
        set((state) => {
          const newState = !state.openParts[partName]
          console.log(`  → ${partName}: ${state.openParts[partName]} → ${newState}`)
          return {
            openParts: {
              ...state.openParts,
              [partName]: newState,
            },
          }
        })
      },

      openAllParts: () => {
        console.log('[carConfigStore] openAllParts called')
        set((state) => ({
          openParts: Object.fromEntries(
            Object.keys(state.openParts).map((key) => [key, true])
          ),
        }))
      },

      closeAllParts: () => {
        console.log('[carConfigStore] closeAllParts called')
        set((state) => ({
          openParts: Object.fromEntries(
            Object.keys(state.openParts).map((key) => [key, false])
          ),
        }))
      },

      getTotalPrice: () => {
        // Will be implemented with part price lookup from car-parts.json
        const { selectedParts } = get()
        // TODO: Load car-parts.json and calculate total
        return 0
      },

      resetConfig: (defaultParts = {}) =>
        set({
          selectedParts: defaultParts,
          paintConfig: defaultPaintConfig,
          activeZone: 'body',
          loadingParts: {},
          partLoadErrors: {},
          openParts: {
            car_door_left: false,
            car_door_right: false,
            car_door_back_left: false,
            car_door_back_right: false,
            car_caput: false,
            car_trunk: false,
          },
        }),
    }),
    { name: 'CarConfigStore' }
  )
)
