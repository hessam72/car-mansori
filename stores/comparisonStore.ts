import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { MultiZonePaintConfig } from './carConfigStore'

export interface ConfigSnapshot {
  selectedParts: Record<string, string>
  paintConfig: MultiZonePaintConfig
  suspensionHeight: number
}

export interface ComparisonState {
  compareMode: boolean
  beforeSnapshot: ConfigSnapshot | null
  enableCompareMode: (snapshot: ConfigSnapshot) => void
  disableCompareMode: () => void
  updateSnapshot: (snapshot: ConfigSnapshot) => void
}

export const useComparisonStore = create<ComparisonState>()(
  devtools(
    (set) => ({
      compareMode: false,
      beforeSnapshot: null,

      enableCompareMode: (snapshot) =>
        set({
          compareMode: true,
          beforeSnapshot: {
            selectedParts: { ...snapshot.selectedParts },
            paintConfig: {
              body: { ...snapshot.paintConfig.body },
              trim: { ...snapshot.paintConfig.trim },
              interior: { ...snapshot.paintConfig.interior },
            },
            suspensionHeight: snapshot.suspensionHeight,
          },
        }),

      disableCompareMode: () =>
        set({
          compareMode: false,
          beforeSnapshot: null,
        }),

      updateSnapshot: (snapshot) =>
        set({
          beforeSnapshot: {
            selectedParts: { ...snapshot.selectedParts },
            paintConfig: {
              body: { ...snapshot.paintConfig.body },
              trim: { ...snapshot.paintConfig.trim },
              interior: { ...snapshot.paintConfig.interior },
            },
            suspensionHeight: snapshot.suspensionHeight,
          },
        }),
    }),
    { name: 'ComparisonStore' }
  )
)
