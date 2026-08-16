'use client'
import { useEffect, useState } from 'react'
import type { PartialSunConfig } from './types'

type SunConfigFile = { sun?: PartialSunConfig }

/**
 * Loads a JSON sun block at runtime so values tuned with ?sundebug=1 can be
 * pasted into a file instead of recompiled into the bundle.
 *
 * Drop the config anywhere your static server serves it (e.g. /public) and
 * pass the URL. Skip this hook entirely if you'd rather import the JSON.
 */
export function useSunConfig(url = '/config/sun.json') {
  const [sun, setSun] = useState<PartialSunConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`sun config ${res.status} at ${url}`)
        return res.json() as Promise<SunConfigFile>
      })
      .then((data) => {
        if (cancelled) return
        setSun(data.sun ?? null)
        setLoading(false)
      })
      .catch((err: Error) => {
        if (cancelled) return
        setError(err.message)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [url])

  return { sun, loading, error }
}
