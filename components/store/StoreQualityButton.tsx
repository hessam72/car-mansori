'use client'

import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import QualitySelector from '@/components/car/QualitySelector'

const GHOST_BTN =
  'flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/70 backdrop-blur-md transition-colors duration-200 hover:border-white/30 hover:text-white'

/**
 * Graphics-quality entry for the walkable store — same ghost-button +
 * popover pattern as the /car TopBar, same QualitySelector content, same
 * persisted tier (shared localStorage via QualityContext).
 */
export function StoreQualityButton() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={rootRef} className="fixed right-16 top-4 z-50" dir="ltr">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`${GHOST_BTN} ${open ? 'border-[#d4af37]/50 text-[#d4af37]' : ''}`}
        aria-label="Graphics quality"
        aria-expanded={open}
        title="Graphics quality"
      >
        <SlidersHorizontal className="h-[18px] w-[18px]" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-60 rounded-2xl border border-white/10 bg-black/75 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <QualitySelector />
        </div>
      )}
    </div>
  )
}
