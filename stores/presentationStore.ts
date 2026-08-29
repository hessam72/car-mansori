import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { PresentationZone } from '@/lib/product/presentation'

/** Mirrors PaintConfig in carConfigStore so the lerp code is a direct port. */
export interface ZonePaint {
  color: string
  metalness: number
  roughness: number
  clearcoat: number
}

export type ZonePaintConfig = Record<PresentationZone, ZonePaint>

/** Cumulative reveal: 0 = frame only, 1 = + soft parts, 2 = + cover. */
export type LayerStep = 0 | 1 | 2

/** Where the cover layer is in its clip-wipe timeline. */
export type CoverPhase = 'hidden' | 'wipeIn' | 'idle' | 'wipeOut'

export const LAYER_STEPS: LayerStep[] = [0, 1, 2]

export interface PresentationState {
  productKey: string | null
  paint: ZonePaintConfig
  activeZone: PresentationZone
  /** The variant currently mounted. */
  coverId: string | null
  /** Requested while a swap wipe is running. */
  pendingCoverId: string | null
  coverPhase: CoverPhase

  layerStep: LayerStep
  exploded: boolean
  layerErrors: Record<string, string>

  /** Fraction of the viewport height the bottom sheet covers. The camera rig
   *  lifts the piece by half of it so "centred" means centred in the part of
   *  the screen the viewer can actually see. */
  sheetCoverage: number

  initProduct: (key: string, paint: ZonePaintConfig, coverId: string) => void
  setPaint: (partial: Partial<ZonePaint>, zone?: PresentationZone) => void
  setActiveZone: (zone: PresentationZone) => void

  selectCover: (id: string) => void
  commitCover: () => void
  finishWipe: () => void

  setLayerStep: (step: LayerStep) => void
  toggleExplode: () => void
  setLayerError: (layer: string, message: string | null) => void
  setSheetCoverage: (fraction: number) => void
  reset: () => void
}

const EMPTY_PAINT: ZonePaint = { color: '#ffffff', metalness: 0, roughness: 0.6, clearcoat: 0 }

const INITIAL = {
  productKey: null,
  paint: { wood: EMPTY_PAINT, cover: EMPTY_PAINT, cushion: EMPTY_PAINT } as ZonePaintConfig,
  activeZone: 'cover' as PresentationZone,
  coverId: null,
  pendingCoverId: null,
  coverPhase: 'hidden' as CoverPhase,
  layerStep: 0 as LayerStep,
  exploded: false,
  layerErrors: {} as Record<string, string>,
  sheetCoverage: 0,
}

export const usePresentation = create<PresentationState>()(
  devtools(
    (set, get) => ({
      ...INITIAL,

      initProduct: (key, paint, coverId) =>
        set({ ...INITIAL, productKey: key, paint, coverId, coverPhase: 'hidden' }),

      setPaint: (partial, zone) => {
        const target = zone ?? get().activeZone
        set((state) => ({
          paint: { ...state.paint, [target]: { ...state.paint[target], ...partial } },
        }))
      },

      setActiveZone: (activeZone) => set({ activeZone }),

      // The cover is mounted whenever layerStep === 2 or a wipe-out is still
      // playing; `coverPhase` alone decides what the clip plane is doing.
      selectCover: (id) => {
        const { coverId, coverPhase } = get()
        if (id === coverId && (coverPhase === 'idle' || coverPhase === 'wipeIn')) return
        if (coverPhase === 'hidden' || !coverId) {
          set({ coverId: id, pendingCoverId: null, coverPhase: 'wipeIn' })
          return
        }
        set({ pendingCoverId: id, coverPhase: 'wipeOut' })
      },

      commitCover: () => {
        const { pendingCoverId } = get()
        // A wipe-out with nothing pending means we stepped back off the cover.
        // Keep coverId so returning to step 2 re-reveals the same variant.
        if (!pendingCoverId) {
          set({ coverPhase: 'hidden' })
          return
        }
        set({ coverId: pendingCoverId, pendingCoverId: null, coverPhase: 'wipeIn' })
      },

      finishWipe: () => set({ coverPhase: 'idle' }),

      setLayerStep: (step) => {
        const { layerStep, coverPhase, exploded } = get()
        if (step === layerStep || exploded) return
        if (step === 2) {
          set({
            layerStep: step,
            pendingCoverId: null,
            coverPhase: coverPhase === 'idle' ? 'idle' : 'wipeIn',
          })
          return
        }
        if (layerStep === 2 && coverPhase !== 'hidden') {
          // Stays mounted through the wipe-out; commitCover() hides it.
          set({ layerStep: step, pendingCoverId: null, coverPhase: 'wipeOut' })
          return
        }
        set({ layerStep: step })
      },

      toggleExplode: () =>
        set((state) => {
          if (state.exploded) return { exploded: false }
          // You cannot fan apart layers you have not revealed.
          return {
            exploded: true,
            layerStep: 2 as LayerStep,
            pendingCoverId: null,
            coverPhase: state.coverPhase === 'hidden' ? ('wipeIn' as CoverPhase) : state.coverPhase,
          }
        }),

      setLayerError: (layer, message) =>
        set((state) => {
          const next = { ...state.layerErrors }
          if (message) next[layer] = message
          else delete next[layer]
          return { layerErrors: next }
        }),

      setSheetCoverage: (fraction) => {
        // Quantised: this drives a camera re-frame, and the sheet's height
        // animation would otherwise fire a store write every frame.
        const next = Math.round(Math.min(Math.max(fraction, 0), 0.9) * 40) / 40
        if (next !== get().sheetCoverage) set({ sheetCoverage: next })
      },

      reset: () => set(INITIAL),
    }),
    { name: 'PresentationStore' }
  )
)
