'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export type ModelFile = {
  priority: number
  quality: 'low' | 'high'
  url: string
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

/** Orthographic shadow-camera frustum for the window sun (world units) */
export type SunShadowConfig = {
  left: number
  right: number
  top: number
  bottom: number
  near: number
  far: number
  bias: number
  normalBias: number
}

/** drei SoftShadows (PCSS) parameters */
export type SoftShadowConfig = {
  /** Light-source size — larger = softer penumbra */
  size: number
  /** PCF samples — quality vs cost */
  samples: number
  /** Depth focus of the softening */
  focus: number
}

/** Per-store "sun through a window" directional light + PCSS soft shadows */
export type SunConfig = {
  /** Master on/off for the whole sun + shadow feature (per store) */
  enabled: boolean
  position: [number, number, number]
  target: [number, number, number]
  intensity: number
  color: string
  soft: SoftShadowConfig
  shadow: SunShadowConfig
}

export type StoreConfig = {
  id: string
  files: ModelFile[]
  /** Optional window-sunlight config; missing → feature off. Merged over DEFAULT_SUN. */
  sun?: DeepPartial<SunConfig>
}

export type StoresData = {
  stores: StoreConfig[]
}

export function useStoreConfig() {
  const searchParams = useSearchParams()
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storeId = searchParams.get('id') || 'mall'

    fetch('/config/stores.json')
      .then((res) => res.json())
      .then((data: StoresData) => {
        const store = data.stores.find((s) => s.id === storeId)
        if (!store) {
          throw new Error(`Store "${storeId}" not found`)
        }
        setConfig(store)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [searchParams])

  return { config, loading, error }
}
