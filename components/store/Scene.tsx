'use client'
import { Canvas, useLoader } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Suspense, useMemo } from 'react'
import { Physics } from '@react-three/rapier'
import { useStoreConfig } from './hooks/useStoreConfig'
import { ModelLoader } from './ModelLoader'
import { usePhysics } from './PhysicsSystem'
import { usePlayerController } from './PlayerController'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { VirtualJoystick } from './Joystick'
import { usePOVCamera } from './POVCamera'
import { ReflectiveFloor } from './ReflectiveFloor'
import { PostProcessing } from './PostProcessing'
import { ShadowSystem } from './ShadowSystem'
import { SunLight } from './SunLight'
import { LampLights } from './LampLights'
import { useState, useEffect, useCallback, useRef } from 'react'
import ProductInteraction, { type ProductData } from './ProductInteraction'
import ProductBillboard3D from './ProductBillboard3D'
import { FurnitureColorPicker } from './FurnitureColorPicker'
import { FurnitureColorApplier } from './FurnitureColorApplier'
import { useFurnitureConfig } from '@/stores/furnitureConfigStore'
import { LoadingScreen } from './LoadingScreen'
import { ModelsLoadingIndicator } from './ModelsLoadingIndicator'
import { AudioPlayer } from './AudioPlayer'
import { GyroToggle } from './GyroToggle'
import { SceneTransition } from './SceneTransition'
import { CameraTransition } from './CameraTransition'
import { ParticleReveal } from './ParticleReveal'
import { StoreQualityButton } from './StoreQualityButton'
import { ActivityGovernor, markStoreActivity } from './activityGovernor'
import { PerfLadder } from '@/components/three/PerfLadder'
import { clampDprToBudget } from '@/lib/three/dprBudget'
import { useQuality } from '@/contexts/QualityContext'
import { PartErrorBoundary } from '@/components/car/PartErrorBoundary'

// Demand frameloop with idle physics pause — the /car performance model
// adapted for a walkable scene. Kill-switch: set to false to restore
// frameloop="always" + variable timestep (all other quality wiring stays).
const IDLE_DEMAND = true

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black text-red-500">
      <div className="text-center">
        <div className="text-xl mb-2">Error</div>
        <div>{message}</div>
      </div>
    </div>
  )
}

function PhysicsManager({
  onSetJoystickInput,
  gyroEnabled
}: {
  onSetJoystickInput: (callback: (x: number, y: number) => void) => void
  gyroEnabled: boolean
}) {
  const physics = usePhysics()
  const { setJoystickInput } = usePlayerController(physics)
  usePOVCamera({ gyroEnabled })

  useEffect(() => {
    onSetJoystickInput(() => (x: number, y: number) => setJoystickInput(x, y))
  }, [setJoystickInput, onSetJoystickInput])

  return (
    <RigidBody
      ref={physics.rigidBodyRef}
      type="dynamic"
      position={[0, 2, 5]}
      enabledRotations={[false, true, false]}
      lockRotations
      linearDamping={2.5}
      angularDamping={10}
      canSleep={false}
    >
      <CapsuleCollider args={[0.6, 0.35]} />
    </RigidBody>
  )
}

type LoadingPhase = 'loading' | 'transitioning' | 'ready'

export default function Scene() {
  const { config, loading, error } = useStoreConfig()
  const { settings } = useQuality()
  const [joystickCallback, setJoystickCallback] = useState<((x: number, y: number) => void) | null>(null)
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('loading')
  const [loadedCount, setLoadedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null)
  const [selectedObjectPosition, setSelectedObjectPosition] = useState<[number, number, number] | null>(null)
  const [gyroEnabled, setGyroEnabled] = useState(false)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [modelsKey, setModelsKey] = useState(0)

  const { selectFurniture, initializeColor, currentColor } = useFurnitureConfig()

  // Sustained-FPS ladder scale (same mechanism as /car)
  const [perfScale, setPerfScale] = useState(1)
  const dpr = useMemo<[number, number]>(() => {
    const [min, max] = clampDprToBudget(settings.dpr)
    return [min, Math.max(min, +(max * perfScale).toFixed(2))]
  }, [settings.dpr, perfScale])

  // Demand-loop idle state: physics pauses while parked
  const [idle, setIdle] = useState(false)
  const r3fRef = useRef<RootState | null>(null)

  // DOM-side wake: stamp activity and kick one frame; the governor keeps
  // the loop alive from there
  const wake = useCallback(() => {
    markStoreActivity()
    r3fRef.current?.invalidate()
  }, [])

  useEffect(() => {
    if (!IDLE_DEMAND) return
    window.addEventListener('keydown', wake)
    return () => window.removeEventListener('keydown', wake)
  }, [wake])

  const handleModelsLoaded = useCallback(() => {
    setLoadingPhase('transitioning')
  }, [])

  const handleTransitionComplete = useCallback(() => {
    setLoadingPhase('ready')
  }, [])

  const handleGalleryError = useCallback((_category: string, err: Error) => {
    setGalleryError(err.message || 'Failed to load the gallery model')
  }, [])

  const handleJoystickMove = useCallback((x: number, y: number) => {
    markStoreActivity()
    joystickCallback?.(x, y)
  }, [joystickCallback])

  const retryGallery = useCallback(() => {
    // Purge the cached rejections, then remount the loader block
    config?.files.forEach((f) => useLoader.clear(GLTFLoader, f.url))
    setLoadedCount(0)
    setGalleryError(null)
    setModelsKey((k) => k + 1)
    wake()
  }, [config, wake])

  useEffect(() => {
    if (config) {
      setTotalCount(config.files.length)
    }
  }, [config])

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen message={error} />
  if (!config) return <ErrorScreen message="No store config found" />

  return (
    <>
      {/* Pointer input (look-drag, product clicks) wakes the demand loop */}
      <div
        className="h-full w-full"
        onPointerDownCapture={wake}
        onPointerMoveCapture={(e) => {
          if (e.buttons !== 0) wake()
        }}
      >
      <Canvas
        shadows
        style={{ touchAction: 'none' }}
        frameloop={IDLE_DEMAND ? 'demand' : 'always'}
        dpr={dpr}
        gl={{
          // AA lives in the EffectComposer (multisampling/SMAA per quality
          // tier) — canvas MSAA was paid for but never displayed
          antialias: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.3,
        }}
        camera={{ position: [0, 2, 5], fov: 60, near: 0.1, far: 200 }}
        onCreated={(state) => {
          r3fRef.current = state
        }}
      >
        <Physics
          gravity={[0, -30, 0]}
          timeStep={IDLE_DEMAND ? 1 / 60 : 'vary'}
          paused={IDLE_DEMAND && idle && loadingPhase === 'ready'}
        >
          {/* Sustained-FPS ladder + adaptive DPR during movement/look input
              (shared with the /car scene) */}
          <PerfLadder onScale={setPerfScale} adaptive={settings.adaptiveDpr} />

          {/* Demand-loop governor: frames flow while there is input or a
              transition; the loop parks (0 GPU) when the player stands still */}
          <ActivityGovernor
            forceActive={!IDLE_DEMAND || loadingPhase !== 'ready' || gyroEnabled}
            onIdleChange={setIdle}
          />

          {/* HDRI lighting — cubemap resolution follows the quality tier */}
          <Suspense fallback={null}>
            <Environment
              files="/hdr/main_hdr.exr"
              background={false}
              environmentIntensity={1}
              resolution={settings.envResolution}
            />
          </Suspense>

          {/* Vitrine spotlight — kept shadowless on purpose (PCSS is global) */}
          <pointLight position={[0, 7, -1.5]} intensity={18} distance={12} decay={.7} color="#ffffff" />

          {/* Sun through the window + PCSS soft shadows — per-store on/off in
              stores.json. SoftShadows patches the global shadow shader chunk;
              mounting it here (Canvas is up only after config resolves) means
              GLB materials stream in and compile against the patched chunk. */}
          {config.sun?.enabled && (
            <>
              <ShadowSystem
                size={config.sun.soft?.size ?? 20}
                samples={config.sun.soft?.samples ?? 16}
                focus={config.sun.soft?.focus ?? 0}
              />
              <SunLight sun={config.sun} />
            </>
          )}

          {/* Lamps — meshes named *lamp* become real point lights + emissive
              glow. Glow is all-tier; real lights/shadows follow the quality tier.
              Re-collects anchors on gallery retry via modelsKey. */}
          <LampLights active={loadingPhase !== 'loading'} revision={modelsKey} config={config.lamps} />

          {/* Load models from config. A 404ing/corrupt gallery GLB is caught
              here instead of blanking the page. */}
          <Suspense fallback={null} key={modelsKey}>
            <PartErrorBoundary category="gallery" onError={handleGalleryError}>
              <ModelLoader files={config.files} onModelsLoaded={handleModelsLoaded} onProgress={setLoadedCount} />
            </PartErrorBoundary>
          </Suspense>

          {/* Scene transition effects */}
          <SceneTransition
            isTransitioning={loadingPhase === 'transitioning'}
            onComplete={handleTransitionComplete}
          />
          <CameraTransition
            isTransitioning={loadingPhase === 'transitioning'}
            targetPosition={[24, 2.8, 12]}
          />
          <ParticleReveal isTransitioning={loadingPhase === 'transitioning'} />

          {/* Physics system - only after transition ready */}
          {loadingPhase === 'ready' && <PhysicsManager onSetJoystickInput={setJoystickCallback} gyroEnabled={gyroEnabled} />}

          {/* Product click interaction */}
          {loadingPhase === 'ready' && (
            <ProductInteraction
              onProductClick={(product, position) => {
                setSelectedProduct(product)
                setSelectedObjectPosition(position || null)
                if (product && product.colors && product.colors.length > 0) {
                  selectFurniture(product.id, product.colors[0].hex)
                  initializeColor()
                }
              }}
            />
          )}

          {/* Product billboard - 3D popup */}
          {loadingPhase === 'ready' && (
            <ProductBillboard3D
              product={selectedProduct}
              onClose={() => {
                setSelectedProduct(null)
                setSelectedObjectPosition(null)
              }}
            />
          )}

          {/* Furniture color picker - 3D floating circles */}
          {loadingPhase === 'ready' &&
            selectedProduct &&
            selectedProduct.colors &&
            selectedProduct.colors.length > 0 &&
            selectedObjectPosition && (
              <FurnitureColorPicker
                position={[
                  selectedObjectPosition[0],
                  selectedObjectPosition[1] + 2, // Float 2 units above object
                  selectedObjectPosition[2],
                ]}
                colors={selectedProduct.colors}
                currentColor={currentColor || selectedProduct.colors[0].hex}
              />
            )}

          {/* Furniture color applier - applies colors to scene furniture */}
          {loadingPhase === 'ready' && <FurnitureColorApplier />}

          {/* Reflective Floor — resolution/off-switch follow the quality tier
              (the reflection pass re-renders the scene every drawn frame) */}
          <ReflectiveFloor
            opacity={.1}
            size={30}
            mixStrength={.4}
            blur={0.5

            }
            roughness={.8}
            resolution={settings.floorReflectionResolution}
            enabled={settings.floorReflectionsEnabled}
            receiveShadow={config.sun?.enabled ?? false}
          />  
           {/* <ReflectiveFloor
            opacity={1}
            size={20}
            mixStrength={.9}
            blur={0}
            roughness={1}
            resolution={settings.floorReflectionResolution}
            enabled={settings.floorReflectionsEnabled}
            receiveShadow={config.sun?.enabled ?? false}
          /> */}

          {/* Post-Processing (tier-driven; SSGI lazy on ultra opt-in) */}
          <PostProcessing />
        </Physics>
      </Canvas>
      </div>

      {/* Loading indicator while models load */}
      {loadingPhase !== 'ready' && !galleryError && (
        <ModelsLoadingIndicator
          fadeOut={loadingPhase === 'transitioning'}
          loadedCount={loadedCount}
          totalCount={totalCount}
        />
      )}

      {/* Gallery model failed — styled recovery instead of a dead black stage */}
      {galleryError && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-[#060608]/95 px-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.45em] text-[#d4af37]/70">Gallery</p>
          <h2 className="text-xl font-extralight uppercase tracking-[0.2em] text-white">
            Gallery could not be loaded
          </h2>
          <p className="max-w-sm text-sm text-white/40">{galleryError}</p>
          <button
            onClick={retryGallery}
            className="mt-2 rounded-full border border-white/15 px-6 py-2.5 text-xs uppercase tracking-[0.2em] text-white/70 transition-colors hover:border-white/40 hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      {/* Virtual joystick for mobile - only after ready */}
      {loadingPhase === 'ready' && joystickCallback && (
        <VirtualJoystick onMove={handleJoystickMove} />
      )}

      {/* Background audio */}
      <AudioPlayer />

      {/* Graphics quality — same tiers/persistence as /car */}
      <StoreQualityButton />

      {/* Gyroscope controls */}
      {loadingPhase === 'ready' && <GyroToggle onGyroChange={setGyroEnabled} />}

      {/* Bottom-left logo */}
      <div style={{
    left:' 1rem',
    maxWidth: '12rem',
    height: 'auto',
    bottom: '1rem',

      }} className="fixed bottom-6 left-6 md:bottom-8 md:left-8 z-10 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/Lumina-full.png"
          alt="OC Jewelry"
          className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-300"
          style={{
            filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))",
          }}
        />
      </div>
    </>
  )
}
