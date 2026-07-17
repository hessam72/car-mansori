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
import { useCameraStore } from '@/stores/cameraStore'
import { useQuality } from '@/contexts/QualityContext'

interface CarTuningSceneProps {
  modelPath: string
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
        dpr={settings.dpr}
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
