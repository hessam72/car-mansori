'use client'

import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr } from '@react-three/drei'
import { NeutralToneMapping } from 'three'

// Color-accurate paint rendering: Khronos PBR Neutral keeps brand colors
// on-hue (ACESFilmic pushed pure red toward orange). Swap here for look-dev
// (AgXToneMapping = filmic alternative, also hue-stable).
const TONE_MAPPING = NeutralToneMapping
const TONE_MAPPING_EXPOSURE = 1.0
import { ReflectiveFloor } from '@/components/store/ReflectiveFloor'
import { PostProcessing } from '@/components/store/PostProcessing'
import CarGroundShadows from './CarGroundShadows'
import CarLighting from './CarLighting'
import CarStudioEnvironment from './CarStudioEnvironment'
import ConfigurableCar from './ConfigurableCar'
import CameraControls from './CameraControls'
import CameraPresets from './CameraPresets'
import InteriorLookControls from './InteriorLookControls'
import PartClickDetector from './PartClickDetector'
import PartsTogglePanel from './PartsTogglePanel'
import PerformanceMonitor from './PerformanceMonitor'
import PhotoMode from './PhotoMode'
import ShadowFreeze from './ShadowFreeze'
import { useCameraStore } from '@/stores/cameraStore'
import { useQuality } from '@/contexts/QualityContext'

interface CarTuningSceneProps {
  modelPath: string
}

// Above ~4.5MP the extra pixels are invisible for this scene but the
// fill-rate cost (× MSAA, × post) is very real on 4K/5K screens. Caps the
// tier's max DPR to the budget; never clamps below native (1).
const PIXEL_BUDGET = 4.5e6
function clampDprToBudget(dpr: [number, number]): [number, number] {
  if (typeof window === 'undefined') return dpr
  const area = window.innerWidth * window.innerHeight
  const budgetMax = Math.max(1, Math.sqrt(PIXEL_BUDGET / area))
  return [dpr[0], Math.max(dpr[0], Math.min(dpr[1], budgetMax))]
}

export default function CarTuningScene({ modelPath }: CarTuningSceneProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const initialPosition: [number, number, number] = isMobile ? [8, 3.2, 8] : [5, 2, 5]
  const { activePreset } = useCameraStore()
  const { settings } = useQuality()

  return (
    <div className="w-full h-screen">
      <Canvas
        shadows
        frameloop="demand"
        dpr={clampDprToBudget(settings.dpr)}
        gl={{
          // The EffectComposer renders offscreen, so canvas MSAA never applies —
          // AA lives in the composer (multisampling/SMAA per quality tier)
          antialias: false,
          powerPreference: 'high-performance',
          toneMapping: TONE_MAPPING,
          toneMappingExposure: TONE_MAPPING_EXPOSURE,
        }}
        camera={{
          position: initialPosition,
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
      >
        {/* Drops DPR while the camera moves (OrbitControls regress), restores when idle */}
        {settings.adaptiveDpr && <AdaptiveDpr pixelated />}

        {/* Shadow maps re-render only when shadow content can change */}
        <ShadowFreeze />

        {/* Studio environment: EXR base + Lightformer highlight rig */}
        <CarStudioEnvironment />

        {/* Studio Lighting */}
        <CarLighting />

        {/* Reflective Floor */}
        <ReflectiveFloor resolution={settings.floorReflectionResolution} />

        {/* Ground contact shadows (contact or accumulative per quality tier) */}
        <CarGroundShadows />

        {/* Configurable Car with Part Swapping */}
        <ConfigurableCar modelPath={modelPath} />

        {/* Post Processing */}
        <PostProcessing />

        {/* Camera Controls */}
        <CameraControls />

        {/* Interior Look Controls */}
        {activePreset === 'interior' && <InteriorLookControls />}

        {/* Part Click Detection */}
        <PartClickDetector />

        {/* Path-traced photo mode (desktop button in PhotoModeUI) */}
        <PhotoMode />

        {/* Performance Monitor */}
        {/* <PerformanceMonitor /> */}
      </Canvas>

      {/* Camera Presets UI */}
      <CameraPresets />

      {/* Parts Toggle Panel */}
      <PartsTogglePanel />
    </div>
  )
}
