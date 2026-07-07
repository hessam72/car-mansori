import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import * as THREE from 'three'

export type PresetName = 'front' | 'rear' | 'sideLeft' | 'sideRight' | 'top' | 'detail'

export interface CameraPreset {
  position: [number, number, number]
  target: [number, number, number]
  name: string
  label: string
}

export const CAMERA_PRESETS: Record<PresetName, CameraPreset> = {
  front: {
    position: [0, 1.2, 5],
    target: [0, 0.5, 0],
    name: 'front',
    label: 'Front View'
  },
  rear: {
    position: [0, 1.2, -5],
    target: [0, 0.5, 0],
    name: 'rear',
    label: 'Rear View'
  },
  sideLeft: {
    position: [-5, 1.2, 0],
    target: [0, 0.5, 0],
    name: 'sideLeft',
    label: 'Left Side'
  },
  sideRight: {
    position: [5, 1.2, 0],
    target: [0, 0.5, 0],
    name: 'sideRight',
    label: 'Right Side'
  },
  top: {
    position: [0, 6, 0],
    target: [0, 0, 0],
    name: 'top',
    label: 'Top View'
  },
  detail: {
    position: [2, 1, 3],
    target: [0, 0.5, 0],
    name: 'detail',
    label: 'Detail View'
  }
}

interface CameraState {
  activePreset: PresetName | null
  autoRotate: boolean
  autoRotateSpeed: number
  targetPosition: THREE.Vector3 | null
  targetLookAt: THREE.Vector3 | null

  // Actions
  setPreset: (preset: PresetName) => void
  setAutoRotate: (enabled: boolean) => void
  setAutoRotateSpeed: (speed: number) => void
  clearTransition: () => void
}

export const useCameraStore = create<CameraState>()(
  devtools(
    (set) => ({
      activePreset: null,
      autoRotate: false,
      autoRotateSpeed: 2.0,
      targetPosition: null,
      targetLookAt: null,

      setPreset: (preset: PresetName) => {
        const config = CAMERA_PRESETS[preset]
        set({
          activePreset: preset,
          targetPosition: new THREE.Vector3(...config.position),
          targetLookAt: new THREE.Vector3(...config.target)
        })
      },

      setAutoRotate: (enabled: boolean) => {
        set({ autoRotate: enabled })
      },

      setAutoRotateSpeed: (speed: number) => {
        set({ autoRotateSpeed: speed })
      },

      clearTransition: () => {
        set({
          targetPosition: null,
          targetLookAt: null
        })
      }
    }),
    { name: 'CameraStore' }
  )
)
