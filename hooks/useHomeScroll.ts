import { useEffect, useRef } from 'react'
import { MotionValue } from 'framer-motion'
import { useCameraStore } from '@/stores/cameraStore'
import { useCarConfig } from '@/stores/carConfigStore'

export function useHomeScroll(scrollYProgress: MotionValue<number>) {
  const { setPreset, setAutoRotate } = useCameraStore()
  const { selectPart } = useCarConfig()

  // Track which actions have been triggered to prevent repeats
  const triggeredRef = useRef({
    wheelSwap: false,
    spoilerAdd: false,
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

      // Part swaps at specific scroll ranges
      if (v >= 0.35 && v < 0.45 && !triggeredRef.current.wheelSwap) {
        selectPart('wheels', 'wheel-stock2')
        triggeredRef.current.wheelSwap = true
      }

      if (v >= 0.70 && v < 0.80 && !triggeredRef.current.spoilerAdd) {
        selectPart('spoilers', 'spoiler-stock')
        triggeredRef.current.spoilerAdd = true
      }
    })

    return unsubscribe
  }, [scrollYProgress, setPreset, setAutoRotate, selectPart])
}
