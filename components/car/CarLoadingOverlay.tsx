'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useProgress } from '@react-three/drei'

interface CarLoadingOverlayProps {
  carName: string
  carNameFa?: string
}

/**
 * Branded first-paint overlay for the configurator. Tracks the drei loading
 * manager (scene chunk, car GLB, part GLBs, studio EXR) via useProgress —
 * the viewport is never a bare black canvas while assets stream.
 */
export default function CarLoadingOverlay({ carName, carNameFa }: CarLoadingOverlayProps) {
  const { progress, active } = useProgress()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return
    if (!active && progress >= 100) {
      // Small grace period absorbs the first-frame shader compile
      const t = setTimeout(() => setDone(true), 400)
      return () => clearTimeout(t)
    }
    if (!active && progress === 0) {
      // Fully warm cache — nothing will ever hit the loading manager
      const t = setTimeout(() => setDone(true), 2500)
      return () => clearTimeout(t)
    }
  }, [active, progress, done])

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="car-loader"
          exit={{ opacity: 0, transition: { duration: 0.8, ease: 'easeInOut' } }}
          className="fixed inset-0 z-[160] flex flex-col items-center justify-center gap-7 bg-[#060608]"
          aria-label="Loading 3D configurator"
        >
          <div className="flex flex-col items-center gap-2 text-center px-6">
            <span className="text-[10px] tracking-[0.45em] uppercase text-[#d4af37]/70">
              Configurator
            </span>
            <h2 className="text-2xl md:text-3xl font-extralight tracking-[0.2em] uppercase text-white">
              {carName}
            </h2>
            {carNameFa && (
              <p className="text-sm text-white/35" dir="rtl">
                {carNameFa}
              </p>
            )}
          </div>

          <div className="w-64 h-px bg-white/10 overflow-hidden">
            <motion.div
              className="h-full"
              style={{ background: 'linear-gradient(to right, #b8860b, #d4af37, #f5e6b8)' }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'easeOut', duration: 0.3 }}
            />
          </div>

          <p className="text-[11px] tracking-[0.35em] text-white/40 tabular-nums">
            {Math.round(progress)}%
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
