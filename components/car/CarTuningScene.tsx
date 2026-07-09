'use client'

import { Canvas } from '@react-three/fiber'
import { Environment, Stats } from '@react-three/drei'
import { ACESFilmicToneMapping } from 'three'
import { ReflectiveFloor } from '@/components/store/ReflectiveFloor'
import { PostProcessing } from '@/components/store/PostProcessing'
import CarLighting from './CarLighting'
import ConfigurableCar from './ConfigurableCar'
import CameraControls from './CameraControls'
import CameraPresets from './CameraPresets'
import InteriorLookControls from './InteriorLookControls'
import PartClickDetector from './PartClickDetector'
import PartsTogglePanel from './PartsTogglePanel'
import { useCameraStore } from '@/stores/cameraStore'

interface CarTuningSceneProps {
  modelPath: string
}

export default function CarTuningScene({ modelPath }: CarTuningSceneProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const initialPosition: [number, number, number] = isMobile ? [8, 3.2, 8] : [5, 2, 5]
  const { activePreset } = useCameraStore()

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          canvas + div {
            left: 20% !important;
            top: 0 !important;
            transform: scale(2.5) !important;
            transform-origin: top left !important;
            width: auto !important;
            height: auto !important;
          }
        `
      }} />
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

        {/* Part Click Detection */}
        <PartClickDetector />
 
        {/* FPS Monitor */}
        <Stats showPanel={0} />
      </Canvas>

      {/* Camera Presets UI */}
      <CameraPresets />

      {/* Parts Toggle Panel */}
      <PartsTogglePanel />
      </div>
    </>
  )
}
