'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useGLTF, useTexture } from '@react-three/drei'
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
  requiredAssets,
  roomMode,
  type PresentationConfig,
  type ResolvedPresentation,
} from '@/lib/product/presentation'
import ProductSheet from '@/components/product/ProductSheet'
import PresentationTopBar from '@/components/product/PresentationTopBar'
import MissingAssetsNotice from '@/components/product/MissingAssetsNotice'
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

  const initProduct = usePresentation((s) => s.initProduct)
  const reset = usePresentation((s) => s.reset)
  const addToCart = useShop((s) => s.addToCart)

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
    initProduct(key, defaultPaint(config), config.layers.cover.default)
    return () => reset()
  }, [key, config, initProduct, reset])

  // Warm drei's cache before the scene mounts, then pull the non-default cover
  // variants on idle so a swap never suspends mid-wipe.
  useEffect(() => {
    if (state !== 'ready') return
    // Only the GLBs go through drei's loader cache; the backdrop is a plain
    // texture, and there is no HDR to warm now that the scene has no IBL.
    assets
      .filter((path) => path.endsWith('.glb'))
      .forEach((path) => useGLTF.preload(path))
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

  return (
    <QualityProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-[var(--surface-0)]">
        {state === 'ready' && (
          <PresentationScene config={config} onLayerError={handleLayerError} sources={sources} />
        )}

        {state === 'checking' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-persian text-[11px] tracking-[0.4em] text-[var(--gold-primary)]/60">
              در حال آماده‌سازی نما
            </span>
          </div>
        )}

        {/* The AR overlay owns the screen and carries its own close button —
            the back link here would leave the page outright. */}
        {!showAR && <PresentationTopBar productName={product.name} catalogId={catalogId} />}

        {state === 'ready' && (
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
