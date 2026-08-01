import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export interface FurnitureColor {
  name: string
  hex: string
}

export interface FurnitureItem {
  id: string
  name: string
  colors: FurnitureColor[]
  glbPath: string
  usdzPath: string
}

export interface FurnitureConfigState {
  selectedFurnitureId: string | null
  currentColor: string | null
  colorTransitioning: boolean
  colorInitialized: boolean

  selectFurniture: (furnitureId: string, defaultColor?: string) => void
  setColor: (colorHex: string) => void
  initializeColor: () => void
  setColorTransitioning: (transitioning: boolean) => void
  resetConfig: () => void
}

export const useFurnitureConfig = create<FurnitureConfigState>()(
  devtools(
    (set) => ({
      selectedFurnitureId: null,
      currentColor: null,
      colorTransitioning: false,
      colorInitialized: false,

      selectFurniture: (furnitureId, defaultColor) =>
        set({
          selectedFurnitureId: furnitureId,
          currentColor: defaultColor || null,
          colorInitialized: false,
        }),

      setColor: (colorHex) =>
        set({
          currentColor: colorHex,
          colorTransitioning: true,
        }),

      initializeColor: () =>
        set({ colorInitialized: true }),

      setColorTransitioning: (transitioning) =>
        set({ colorTransitioning: transitioning }),

      resetConfig: () =>
        set({
          selectedFurnitureId: null,
          currentColor: null,
          colorTransitioning: false,
          colorInitialized: false,
        }),
    }),
    { name: 'FurnitureConfigStore' }
  )
)
