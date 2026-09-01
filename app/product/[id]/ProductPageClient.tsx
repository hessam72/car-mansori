'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useEnvironment, useGLTF, useTexture } from '@react-three/drei'
import { QualityProvider } from '@/contexts/QualityContext'
import { useAssetProbe } from '@/hooks/useAssetProbe'
import { usePresentation, type ZonePaintConfig } from '@/stores/presentationStore'
import { useShop } from '@/stores/storeShopStore'
import { findCatalogItemBySceneObject } from '@/lib/store/catalog'
import catalog from '@/public/config/catalog.json'
import { isARCapable, supportsBlobAR } from '@/lib/device-utils'
import {
  emptyExportSources,
  exportConfiguredGLB,
  exportSignature,
  type ExportSources,
} from '@/lib/three/exportConfigured'
import {
  coverSurface,
  findCoverVariant,
  isMatte,
  needsEnvironment,
  presentationQuality,
  requiredAssets,
  roomMode,
  type PresentationConfig,
  type ResolvedPresentation,
} from '@/lib/product/presentation'
import ProductSheet from '@/components/product/ProductSheet'
import PresentationTopBar from '@/components/product/PresentationTopBar'
import MissingAssetsNotice from '@/components/product/MissingAssetsNotice'
import PresentationLoading from '@/components/product/PresentationLoading'
import type { Catalog } from '@/lib/store/catalog'

// Must run before any preload in this chunk — drei otherwise reaches for its
// CDN decoder. Same reason CarPageClient sets it at module scope.
useGLTF.setDecoderPath('/draco/')

const PresentationScene = dynamic(() => import('@/components/product/PresentationScene'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[var(--surface-0)]" />,
})

const ARProductViewer = dynamic(() => import('@/components/store/ARProductViewer'), { ssr: false })

/** Seeds every zone from the first swatch of its palette, so the piece opens in
 *  a real, sellable finish rather than whatever the GLB happened to ship with. */
function defaultPaint(config: PresentationConfig): ZonePaintConfig {
  const cover = findCoverVariant(config, config.layers.cover.default)
  // Same helper selectCover uses, so the opening finish and every later swap
  // are described the same way.
  const surface = coverSurface(config, cover)
  const first = (zone: 'wood' | 'cover' | 'cushion') => config.palettes[zone]?.[0]

  return {
    wood: {
      color: first('wood')?.hex ?? '#c8a06a',
      roughness: first('wood')?.roughness ?? 0.55,
      metalness: 0,
      clearcoat: 0,
    },
    cover: { color: first('cover')?.hex ?? '#36454f', ...surface },
    cushion: {
      color: first('cushion')?.hex ?? '#e8e0d2',
      roughness: 0.8,
      metalness: 0,
      clearcoat: 0,
    },
  }
}

export default function ProductPageClient({ presentation }: { presentation: ResolvedPresentation }) {
  const { key, product, config } = presentation
  const [showAR, setShowAR] = useState(false)
  const [arSupported, setArSupported] = useState(false)
  /** False only on Android without WebXR, where Scene Viewer is the sole AR
   *  path and it refuses blob URLs — there AR falls back to the static asset. */
  const [liveARPossible, setLiveARPossible] = useState(true)
  const [arBuilding, setArBuilding] = useState(false)
  const [arError, setArError] = useState(false)
  const [arUrl, setArUrl] = useState<string | null>(null)
  const [probeKey, setProbeKey] = useState(0)
  /** A GLB that exists but fails to parse never reaches the probe — the error
   *  boundaries in the scene report it here so it still gets a way out. */
  const [layerError, setLayerError] = useState<string | null>(null)
  /** Raised by the scene once the piece and room are actually drawn — the probe
   *  below only proves the files exist. */
  const [sceneReady, setSceneReady] = useState(false)

  const initProduct = usePresentation((s) => s.initProduct)
  const reset = usePresentation((s) => s.reset)
  const addToCart = useShop((s) => s.addToCart)

  /**
   * Tier, pinned from the manifest instead of guessed from the viewport.
   *
   * Resolved on the client only — reading `innerWidth` during render would
   * disagree with the server's HTML — so the first paint uses the manifest's
   * desktop tier and a phone with a `quality.mobile` override settles onto it
   * before the canvas mounts behind the splash.
   */
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    // matchMedia rather than a resize listener: this only ever needs to know
    // which side of the breakpoint we are on, and a resize handler would
    // re-render the page on every frame of a window drag.
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  const qualityPreset = useMemo(
    () => presentationQuality(config, narrow ? 0 : 1280),
    [config, narrow]
  )

  const assets = useMemo(() => requiredAssets(config), [config])
  const { state, missing } = useAssetProbe(useMemo(() => assets, [assets, probeKey]))

  const catalogId = useMemo(() => {
    const item = findCatalogItemBySceneObject(catalog as Catalog, key)
    return item?.id ?? null
  }, [key])

  /** Written by FurnitureStack with the raw cached GLTFs — the AR export lives
   *  out here, outside the Canvas, and has no other way to reach them. */
  const sources = useRef<ExportSources>(emptyExportSources())
  /** The last built model, keyed by the config that produced it. Re-opening AR
   *  without touching a swatch reuses it instead of re-serialising. */
  const arCache = useRef<{ signature: string; url: string } | null>(null)

  useEffect(() => {
    setArSupported(isARCapable())
    supportsBlobAR().then(setLiveARPossible)
  }, [])

  // Object URLs outlive React state, so the last one has to be released by hand.
  useEffect(
    () => () => {
      if (arCache.current) URL.revokeObjectURL(arCache.current.url)
      arCache.current = null
    },
    []
  )

  /**
   * Serialise what is on screen — chosen cover variant, all three zone colours —
   * and hand model-viewer the result. With no `ios-src` alongside it, Quick Look
   * gets a USDZ generated from this same file, so iOS matches Android.
   */
  const openAR = useCallback(async () => {
    if (!liveARPossible) {
      setShowAR(true)
      return
    }

    const { paint, coverId } = usePresentation.getState()
    const signature = exportSignature(paint, coverId)

    if (arCache.current?.signature === signature) {
      setArUrl(arCache.current.url)
      setShowAR(true)
      return
    }

    setArBuilding(true)
    setArError(false)
    try {
      const blob = await exportConfiguredGLB(
        sources.current,
        paint,
        findCoverVariant(config, coverId),
        { softMatch: config.layers.soft?.zoneMatch, matte: isMatte(config) }
      )
      const url = URL.createObjectURL(blob)
      if (arCache.current) URL.revokeObjectURL(arCache.current.url)
      arCache.current = { signature, url }
      setArUrl(url)
      setShowAR(true)

      if (new URLSearchParams(window.location.search).has('debug')) {
        console.log(`[AR] configured GLB ${(blob.size / 1048576).toFixed(1)} MB`)
      }
      if (blob.size > 40 * 1048576) {
        console.warn('[AR] configured GLB exceeds 40MB — Quick Look may struggle')
      }
    } catch (error) {
      console.error('[AR] export failed', error)
      setArError(true)
    } finally {
      setArBuilding(false)
    }
  }, [config, liveARPossible])

  useEffect(() => {
    initProduct(key, defaultPaint(config), config.layers.cover.default, config.layers.startStep ?? 1)
    return () => reset()
  }, [key, config, initProduct, reset])

  // Warm drei's cache before the scene mounts, then pull the non-default cover
  // variants on idle so a swap never suspends mid-wipe.
  useEffect(() => {
    if (state !== 'ready') return
    // Only the GLBs go through drei's loader cache; the backdrop image is a
    // plain texture and the HDR has its own loader.
    assets
      .filter((path) => path.endsWith('.glb'))
      .forEach((path) => useGLTF.preload(path))
    if (needsEnvironment(config) && config.room.hdr) {
      useEnvironment.preload({ files: config.room.hdr })
    }
    // Only the backdrop actually in use — a manifest can carry both an image
    // and a room GLB so `room.mode` can switch between them.
    if (roomMode(config) === 'image' && config.room.image) useTexture.preload(config.room.image)

    const rest = config.layers.cover.variants
      .filter((v) => v.id !== config.layers.cover.default)
      .map((v) => v.path)
    const warm = () => rest.forEach((path) => useGLTF.preload(path))

    const idle = (window as any).requestIdleCallback
    const handle = idle ? idle(warm) : window.setTimeout(warm, 1500)
    return () => {
      const cancel = (window as any).cancelIdleCallback
      if (idle && cancel) cancel(handle)
      else window.clearTimeout(handle as number)
    }
  }, [state, assets, config])

  const retry = useCallback(() => {
    assets.filter((path) => path.endsWith('.glb')).forEach((path) => useGLTF.clear(path))
    setLayerError(null)
    setProbeKey((n) => n + 1)
  }, [assets])

  const handleLayerError = useCallback((category: string, error: Error) => {
    setLayerError(`${category}: ${error.message}`)
  }, [])

  // Failsafe. The splash is dismissed by the scene reporting itself drawn, and
  // an asset that resolves but never measures — a frame GLB with no geometry,
  // say — would otherwise leave it up for good. A half-dressed scene beats a
  // splash that never lifts.
  useEffect(() => {
    if (state !== 'ready' || sceneReady) return
    const t = window.setTimeout(() => {
      console.warn('[presentation] scene never reported ready — revealing anyway')
      setSceneReady(true)
    }, 20000)
    return () => window.clearTimeout(t)
  }, [state, sceneReady])

  return (
    <QualityProvider preset={qualityPreset}>
      <div className="relative h-screen w-screen overflow-hidden bg-[var(--surface-0)]">
        {state === 'ready' && (
          <PresentationScene
            config={config}
            onLayerError={handleLayerError}
            onReady={() => setSceneReady(true)}
            sources={sources}
          />
        )}

        {/* Covers the probe *and* the streaming behind it. The canvas has to be
            mounted and rendering to load its own assets, so the splash is held
            over it and faded, rather than shown in its place. */}
        {!layerError && state !== 'missing' && (
          <PresentationLoading productName={product.name} ready={state === 'ready' && sceneReady} />
        )}

        {/* The AR overlay owns the screen and carries its own close button —
            the back link here would leave the page outright. */}
        {!showAR && <PresentationTopBar productName={product.name} catalogId={catalogId} />}

        {state === 'ready' && sceneReady && (
          <ProductSheet
            presentation={presentation}
            // Not gated on the device: the viewer is a 3D preview of the
            // configured piece everywhere, and AR is the extra it adds when the
            // device supports it. `arCapable` only steers the copy.
            arAvailable={liveARPossible || !!product.glbPath}
            arCapable={arSupported}
            arLive={liveARPossible}
            arBuilding={arBuilding}
            arError={arError}
            hidden={showAR}
            onViewAR={openAR}
            onAddToCart={() => addToCart(catalogId ?? product.id)}
          />
        )}

        {(state === 'missing' || layerError) && (
          <MissingAssetsNotice
            productName={product.name}
            kind={layerError ? 'error' : 'missing'}
            missing={layerError ? [layerError] : missing}
            onRetry={retry}
          />
        )}

        {showAR && (arUrl || product.glbPath) && (
          <ARProductViewer
            // The configured build when we have one; `ios-src` is deliberately
            // left off so Quick Look regenerates from it instead of the stale
            // catalogue USDZ. WebXR first, so Android never reaches Scene
            // Viewer with a blob it cannot fetch.
            glbPath={arUrl ?? product.glbPath!}
            usdzPath={arUrl ? undefined : product.usdzPath}
            arModes={arUrl ? 'webxr quick-look scene-viewer' : undefined}
            arScale="fixed"
            productName={product.name}
            onClose={() => setShowAR(false)}
          />
        )}
      </div>
    </QualityProvider>
  )
}
