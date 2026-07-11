import { useState, useEffect, useRef } from 'react'
import { MotionValue } from 'framer-motion'
import { useFrame } from '@react-three/fiber'

// Precomputed flicker sequence (time in normalized units 0→1, intensity 0→1)
const FLICKER_KEYFRAMES = [
  { time: 0.00, intensity: 0.0 },   // Complete darkness
  { time: 0.05, intensity: 0.0 },   // Still dark
  { time: 0.055, intensity: 0.9 },  // First flash
  { time: 0.12, intensity: 0.0 },   // Off
  { time: 0.14, intensity: 0.8 },   // Second flash
  { time: 0.22, intensity: 0.1 },   // Dim
  { time: 0.25, intensity: 0.9 },   // Bright
  { time: 0.32, intensity: 0.3 },   // Dip
  { time: 0.36, intensity: 1.0 },   // Full
  { time: 0.45, intensity: 0.6 },   // Oscillate
  { time: 0.52, intensity: 0.95 },  // Almost stable
  { time: 0.60, intensity: 0.75 },  // Minor dip
  { time: 0.70, intensity: 1.0 },   // Stable
  { time: 1.00, intensity: 1.0 },   // Fully stable
]

// Per-light timing offsets (creates "rolling" gallery effect)
const LIGHT_OFFSETS = {
  key: 0.0,      // Key light turns on first
  fill: 0.08,    // Fill follows
  bounce: 0.12,  // Ground bounce
  rim: 0.15,     // Rim light last
}

/**
 * Maps scroll progress to light intensity with realistic flicker effect
 *
 * @param scrollYProgress - Framer Motion scroll value (0→1)
 * @returns Intensity multipliers for each light type (0→1)
 */
export function useLightFlicker(scrollYProgress: MotionValue<number>) {
  const [intensities, setIntensities] = useState({
    key: 0,
    fill: 0,
    rim: 0,
    bounce: 0,
    ambient: 0,
  })

  const prefersReducedMotion = useRef(false)

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.current = mediaQuery.matches

    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion.current = e.matches
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useFrame(() => {
    const scroll = scrollYProgress.get()

    // Outside flicker range: instant full brightness
    if (scroll > 0.15) {
      setIntensities({ key: 1, fill: 1, rim: 1, bounce: 1, ambient: 0.3 })
      return
    }

    // Before flicker starts: complete darkness
    if (scroll < 0.05) {
      setIntensities({ key: 0, fill: 0, rim: 0, bounce: 0, ambient: 0 })
      return
    }

    // Reduced motion: smooth fade instead of flicker
    if (prefersReducedMotion.current) {
      const fadeProgress = (scroll - 0.05) / 0.10 // 0→1 over 5-15% range
      const intensity = Math.min(fadeProgress, 1)
      const ambient = intensity * 0.3
      setIntensities({ key: intensity, fill: intensity, rim: intensity, bounce: intensity, ambient })
      return
    }

    // Map scroll 5-15% to animation time 0→1
    const normalizedTime = (scroll - 0.05) / 0.10

    // Calculate intensity for each light with timing offset
    const getIntensityAtTime = (time: number): number => {
      // Clamp time to 0-1
      const clampedTime = Math.max(0, Math.min(1, time))

      // Find surrounding keyframes
      let lowerFrame = FLICKER_KEYFRAMES[0]
      let upperFrame = FLICKER_KEYFRAMES[FLICKER_KEYFRAMES.length - 1]

      for (let i = 0; i < FLICKER_KEYFRAMES.length - 1; i++) {
        if (clampedTime >= FLICKER_KEYFRAMES[i].time && clampedTime <= FLICKER_KEYFRAMES[i + 1].time) {
          lowerFrame = FLICKER_KEYFRAMES[i]
          upperFrame = FLICKER_KEYFRAMES[i + 1]
          break
        }
      }

      // Linear interpolation between keyframes
      const frameSpan = upperFrame.time - lowerFrame.time
      if (frameSpan === 0) return lowerFrame.intensity

      const localProgress = (clampedTime - lowerFrame.time) / frameSpan
      return lowerFrame.intensity + (upperFrame.intensity - lowerFrame.intensity) * localProgress
    }

    // Apply per-light offsets
    // Ambient: smooth fade (no flicker) - maps scroll 5-15% to intensity 0→0.3
    const ambientIntensity = normalizedTime * 0.3

    setIntensities({
      key: getIntensityAtTime(normalizedTime + LIGHT_OFFSETS.key),
      fill: getIntensityAtTime(normalizedTime + LIGHT_OFFSETS.fill),
      bounce: getIntensityAtTime(normalizedTime + LIGHT_OFFSETS.bounce),
      rim: getIntensityAtTime(normalizedTime + LIGHT_OFFSETS.rim),
      ambient: ambientIntensity,
    })
  })

  return intensities
}
