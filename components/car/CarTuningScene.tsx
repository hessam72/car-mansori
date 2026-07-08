'use client'

import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { ACESFilmicToneMapping } from 'three'
import { ReflectiveFloor } from '@/components/store/ReflectiveFloor'
import { PostProcessing } from '@/components/store/PostProcessing'
import CarLighting from './CarLighting'
import ConfigurableCar from './ConfigurableCar'
import CameraControls from './CameraControls'
import CameraPresets from './CameraPresets'
import InteriorLookControls from './InteriorLookControls'
import { useCameraStore } from '@/stores/cameraStore'

interface CarTuningSceneProps {
  modelPath: string
}

export default function CarTuningScene({ modelPath }: CarTuningSceneProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const initialPosition: [number, number, number] = isMobile ? [8, 3.2, 8] : [5, 2, 5]
  const { activePreset } = useCameraStore()

  return (
    <div className="w-full h-screen">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        camera={{
          position: initialPosition,
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
      >
        {/* HDRI Environment */}
        <Environment
          files="/hdr/main_hdr.exr"
          background={false}
          environmentIntensity={0.8}
        />

        {/* Studio Lighting */}
        <CarLighting />

        {/* Reflective Floor */}
        <ReflectiveFloor />

        {/* Configurable Car with Part Swapping */}
        <ConfigurableCar modelPath={modelPath} />

        {/* Post Processing */}
        <PostProcessing />

        {/* Camera Controls */}
        <CameraControls />

        {/* Interior Look Controls */}
        {activePreset === 'interior' && <InteriorLookControls />}
      </Canvas>

      {/* Camera Presets UI */}
      <CameraPresets />
    </div>
  )
}
