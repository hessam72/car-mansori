'use client'

import { useEffect, useState } from 'react'
import { usePhotoMode } from '@/stores/photoModeStore'

const isDesktop = () =>
  typeof window !== 'undefined' &&
  window.innerWidth >= 1024 &&
  !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)

/**
 * DOM chrome for photo mode: desktop-only entry button plus the overlay
 * (progress, save, exit) shown while the path tracer is working. The overlay
 * blocks scene/tuning interaction so the traced snapshot stays consistent.
 */
export default function PhotoModeUI() {
  const [desktop, setDesktop] = useState(false)
  const active = usePhotoMode((s) => s.active)
  const status = usePhotoMode((s) => s.status)
  const buildProgress = usePhotoMode((s) => s.buildProgress)
  const samples = usePhotoMode((s) => s.samples)
  const setActive = usePhotoMode((s) => s.setActive)
  const requestSave = usePhotoMode((s) => s.requestSave)

  useEffect(() => {
    setDesktop(isDesktop())
  }, [])

  if (!desktop) return null

  if (!active) {
    return (
      <button
        onClick={() => setActive(true)}
        className="fixed bottom-48 right-8 px-5 py-3 bg-black/70 hover:bg-black/90 text-white font-semibold rounded-xl shadow-lg border border-white/20 transition-all flex items-center gap-2 z-10"
        title="Path-traced beauty shot"
      >
        📷 Photo Mode
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 text-white px-6 py-3 rounded-xl border border-white/10">
        <span className="font-mono text-sm">
          {status === 'building'
            ? `Building scene… ${Math.round(buildProgress * 100)}%`
            : `Refining ${samples} samples`}
        </span>
        <button
          onClick={requestSave}
          disabled={status !== 'rendering'}
          className="px-4 py-1.5 bg-white text-black rounded-lg text-sm font-semibold disabled:opacity-40"
        >
          Save PNG
        </button>
        <button
          onClick={() => setActive(false)}
          className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold"
        >
          Exit
        </button>
      </div>
    </div>
  )
}
