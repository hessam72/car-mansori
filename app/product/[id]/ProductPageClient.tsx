'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useEnvironment, useGLTF } from '@react-three/drei'
import { QualityProvider } from '@/contexts/QualityContext'
import { useAssetProbe } from '@/hooks/useAssetProbe'
import { usePresentation, type ZonePaintConfig } from '@/stores/presentationStore'
import { useShop } from '@/stores/storeShopStore'
import { findCatalogItemBySceneObject } from '@/lib/store/catalog'
import catalog from '@/public/config/catalog.json'
import { isARCapable } from '@/lib/device-utils'
import {
  requiredAssets,
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
  const cover = config.layers.cover.variants.find((v) => v.id === config.layers.cover.default)
  const surface = { metalness: cover?.material?.metalness ?? 0, clearcoat: cover?.material?.clearcoat ?? 0 }
  const first = (zone: 'wood' | 'cover' | 'cushion') => config.palettes[zone]?.[0]

  return {
    wood: {
      color: first('wood')?.hex ?? '#c8a06a',
      roughness: first('wood')?.roughness ?? 0.55,
      metalness: 0,
      clearcoat: 0,
    },
    cover: {
      color: first('cover')?.hex ?? '#36454f',
      roughness: cover?.material?.roughness ?? 0.6,
      ...surface,
    },
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

  useEffect(() => {
    setArSupported(isARCapable())
  }, [])

  useEffect(() => {
    initProduct(key, defaultPaint(config), config.layers.cover.default)
    return () => reset()
  }, [key, config, initProduct, reset])

  // Warm drei's cache before the scene mounts, then pull the non-default cover
  // variants on idle so a swap never suspends mid-wipe.
  useEffect(() => {
    if (state !== 'ready') return
    assets.forEach((path) => useGLTF.preload(path))
    useEnvironment.preload({ files: config.room.hdr })

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
    assets.forEach((path) => useGLTF.clear(path))
    setLayerError(null)
    setProbeKey((n) => n + 1)
  }, [assets])

  const handleLayerError = useCallback((category: string, error: Error) => {
    setLayerError(`${category}: ${error.message}`)
  }, [])

  return (
    <QualityProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-[var(--surface-0)]">
        {state === 'ready' && <PresentationScene config={config} onLayerError={handleLayerError} />}

        {state === 'checking' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-persian text-[11px] tracking-[0.4em] text-[var(--gold-primary)]/60">
              در حال آماده‌سازی نما
            </span>
          </div>
        )}

        <PresentationTopBar productName={product.name} catalogId={catalogId} />

        {state === 'ready' && (
          <ProductSheet
            presentation={presentation}
            arAvailable={arSupported && !!product.glbPath}
            onViewAR={() => setShowAR(true)}
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

        {showAR && product.glbPath && (
          <ARProductViewer
            glbPath={product.glbPath}
            usdzPath={product.usdzPath ?? ''}
            productName={product.name}
            onClose={() => setShowAR(false)}
          />
        )}
      </div>
    </QualityProvider>
  )
}
