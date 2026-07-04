import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface PaintConfig {
  color: string
  metalness: number
  roughness: number
  clearcoat: number
}

export interface CarConfigState {
  selectedParts: Record<string, string>
  paintConfig: PaintConfig
  selectPart: (category: string, partId: string) => void
  setPaintConfig: (config: Partial<PaintConfig>) => void
  getTotalPrice: () => number
  resetConfig: (defaultParts?: Record<string, string>) => void
}

const defaultPaintConfig: PaintConfig = {
  color: '#ff0000',
  metalness: 0.9,
  roughness: 0.3,
  clearcoat: 1.0,
}

export const useCarConfig = create<CarConfigState>()(
  devtools(
    (set, get) => ({
      selectedParts: {},
      paintConfig: defaultPaintConfig,

      selectPart: (category, partId) =>
        set((state) => ({
          selectedParts: { ...state.selectedParts, [category]: partId },
        })),

      setPaintConfig: (config) =>
        set((state) => ({
          paintConfig: { ...state.paintConfig, ...config },
        })),

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
        }),
    }),
    { name: 'CarConfigStore' }
  )
)
