'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface StoreSidebarProps {
  open: boolean
  onClose: () => void
  returnFocusTo?: React.RefObject<HTMLElement>
}

/**
 * Right-hand slide-in panel. Focus handling mirrors components/landing/MobileMenu.tsx
 * minus the Lenis scroll-lock — /store never scrolls.
 */
export default function StoreSidebar({ open, onClose, returnFocusTo }: StoreSidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!nodes?.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      returnFocusTo?.current?.focus()
    }
  }, [open, onClose, returnFocusTo])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/55"
          />

          <motion.aside
            dir="rtl"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="منوی فروشگاه"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 320, mass: 0.8 }}
            className="glass font-persian fixed inset-y-0 right-0 z-[71] flex w-[78%] max-w-[320px]
                       flex-col rounded-l-[24px] px-5
                       pt-[max(1rem,env(safe-area-inset-top))]
                       pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex h-11 items-center justify-between">
              <span className="text-[13px] font-bold tracking-tight text-[var(--gold-primary)]">
                شهر امید
              </span>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="بستن منو"
                className="grid h-9 w-9 place-items-center rounded-full text-[var(--text-muted)]
                           transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1" />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
