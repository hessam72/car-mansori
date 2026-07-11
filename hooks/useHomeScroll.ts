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

  // Throttle scroll updates to 60fps max
  const lastUpdateRef = useRef(0)

  // Track previous states to prevent redundant updates
  const prevStateRef = useRef({
    camera: 'home_initial',
    color: '#ff0000',
    wheel: 'wheel-stock',
    spoiler: 'spoiler-none'
  })

  useEffect(() => {
    const unsubscribe = scrollYProgress.on('change', (v) => {
      // Throttle to 16ms (60fps)
      const now = Date.now()
      if (now - lastUpdateRef.current < 16) return
      lastUpdateRef.current = now
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
      let newCamera: 'home_initial' | 'home_front_wheel' | 'home_spoiler' | 'home_finale' = prevStateRef.current.camera as any
      if (v < 0.25) {
        newCamera = 'home_initial'
      } else if (v >= 0.25 && v < 0.60) {
        newCamera = 'home_front_wheel'
      } else if (v >= 0.60 && v < 0.90) {
        newCamera = 'home_spoiler'
      } else if (v >= 0.90) {
        newCamera = 'home_finale'
      }
      if (newCamera !== prevStateRef.current.camera) {
        setPreset(newCamera)
        prevStateRef.current.camera = newCamera
      }

      // Bidirectional color changes: cycle through presets from 15-30%
      let newColor = prevStateRef.current.color
      if (v < 0.15) {
        newColor = '#ff0000'
      } else if (v >= 0.15 && v < 0.20) {
        newColor = '#0066ff'
      } else if (v >= 0.25) {
        newColor = '#f5f5f5'
      }
      if (newColor !== prevStateRef.current.color) {
        const configs = {
          '#ff0000': { color: '#ff0000', metalness: 0.9, roughness: 0.2, clearcoat: 1.0 },
          '#0066ff': { color: '#0066ff', metalness: 0.9, roughness: 0.3, clearcoat: 1.0 },
          '#f5f5f5': { color: '#f5f5f5', metalness: 0.8, roughness: 0.1, clearcoat: 1.0 }
        }
        setPaintConfig(configs[newColor as keyof typeof configs], 'body')
        prevStateRef.current.color = newColor
      }

      // Bidirectional wheel swap: stock2 from 35-70%, stock below 35%
      let newWheel = prevStateRef.current.wheel
      if (v >= 0.35 && v < 0.70) {
        newWheel = 'wheel-stock2'
      } else if (v < 0.35) {
        newWheel = 'wheel-stock'
      }
      if (newWheel !== prevStateRef.current.wheel) {
        selectPart('wheels', newWheel)
        prevStateRef.current.wheel = newWheel
      }

      // Bidirectional spoiler swap: add at 70%+, remove below 70%
      let newSpoiler = prevStateRef.current.spoiler
      if (v >= 0.70) {
        newSpoiler = 'spoiler-stock'
      } else if (v < 0.70) {
        newSpoiler = 'spoiler-none'
      }
      if (newSpoiler !== prevStateRef.current.spoiler) {
        selectPart('spoilers', newSpoiler)
        prevStateRef.current.spoiler = newSpoiler
      }
    })

    return unsubscribe
  }, [scrollYProgress, setPreset, setAutoRotate, selectPart])
}
