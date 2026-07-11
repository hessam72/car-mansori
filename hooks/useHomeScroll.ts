import { useEffect, useRef } from 'react'
import { MotionValue } from 'framer-motion'
import { useCameraStore } from '@/stores/cameraStore'
import { useCarConfig } from '@/stores/carConfigStore'

export function useHomeScroll(scrollYProgress: MotionValue<number>) {
  const { setPreset, setAutoRotate } = useCameraStore()
  const { selectPart, setPaintConfig } = useCarConfig()

  // Track auto-rotate state only (parts are range-based)
  const triggeredRef = useRef({
    autoRotate: false
  })

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      // Auto-rotate control: enable at 90%, disable below 85% threshold
      if (v >= 0.90) {
        if (!triggeredRef.current.autoRotate) {
          setAutoRotate(true)
          triggeredRef.current.autoRotate = true
        }
      } else if (v < 0.85) {
        if (triggeredRef.current.autoRotate) {
          setAutoRotate(false)
          triggeredRef.current.autoRotate = false
        }
      }

      // Camera movements based on scroll progress
      if (v < 0.25) {
        setPreset('home_initial')
      } else if (v >= 0.25 && v < 0.60) {
        setPreset('home_front_wheel')
      } else if (v >= 0.60 && v < 0.90) {
        setPreset('home_spoiler')
      } else if (v >= 0.90) {
        setPreset('home_finale')
      }

      // Bidirectional color changes: cycle through presets from 15-30%
      if (v < 0.15) {
        setPaintConfig({ color: '#ff0000', metalness: 0.9, roughness: 0.2, clearcoat: 1.0 }, 'body')
      } else if (v >= 0.15 && v < 0.20) {
        setPaintConfig({ color: '#0066ff', metalness: 0.9, roughness: 0.3, clearcoat: 1.0 }, 'body')
      } else if (v >= 0.25 ) {
        setPaintConfig({ color: '#f5f5f5', metalness: 0.8, roughness: 0.1, clearcoat: 1.0 }, 'body')
    
      }

      // Bidirectional wheel swap: stock2 from 35-70%, stock below 35%
      if (v >= 0.35 && v < 0.70) {
        selectPart('wheels', 'wheel-stock2')
      } else if (v < 0.35) {
        selectPart('wheels', 'wheel-stock')
      }

      // Bidirectional spoiler swap: add at 70%+, remove below 70%
      if (v >= 0.70) {
        selectPart('spoilers', 'spoiler-stock')
      } else if (v < 0.70) {
        selectPart('spoilers', 'spoiler-none')
      }
    })

    return unsubscribe
  }, [scrollYProgress, setPreset, setAutoRotate, selectPart])
}
