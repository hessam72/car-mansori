import { useState, useEffect, useRef } from 'react'
import { MotionValue } from 'framer-motion'
import { useFrame, useThree } from '@react-three/fiber'

// Time-based flicker sequence (time in seconds, intensity 0→1)
const FLICKER_KEYFRAMES = [
  { time: 0.00, intensity: 0.0 },   // Complete darkness
  { time: 0.08, intensity: 0.0 },   // Still dark
  { time: 0.10, intensity: 0.9 },   // First flash
  { time: 0.18, intensity: 0.0 },   // Off
  { time: 0.22, intensity: 0.8 },   // Second flash
  { time: 0.35, intensity: 0.1 },   // Dim
  { time: 0.42, intensity: 0.9 },   // Bright
  { time: 0.52, intensity: 0.3 },   // Dip
  { time: 0.60, intensity: 1.0 },   // Full
  { time: 0.75, intensity: 0.6 },   // Oscillate
  { time: 0.88, intensity: 0.95 },  // Almost stable
  { time: 1.05, intensity: 0.75 },  // Minor dip
  { time: 1.25, intensity: 1.0 },   // Stable
  { time: 1.50, intensity: 1.0 },   // Fully stable
]

const FLICKER_DURATION = 1.5 // Total flicker animation duration in seconds

// Per-light timing offsets in seconds (creates "rolling" gallery effect)
const LIGHT_OFFSETS = {
  key: 0.0,      // Key light turns on first
  fill: 0.12,    // Fill follows
  bounce: 0.18,  // Ground bounce
  rim: 0.22,     // Rim light last
}

/**
 * Maps scroll threshold to time-based light flicker animation
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
  const flickerStartTime = useRef<number | null>(null)
  const isFlickering = useRef(false)
  const hasFlickered = useRef(false)

  const invalidate = useThree((state) => state.invalidate)

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

  useFrame((state) => {
    const scroll = scrollYProgress.get()
    const currentTime = state.clock.elapsedTime

    // Calculate intensity for each light with timing offset
    const getIntensityAtTime = (elapsedSeconds: number): number => {
      // Clamp to animation duration
      const clampedTime = Math.max(0, Math.min(FLICKER_DURATION, elapsedSeconds))

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

    // Below threshold: darkness, reset flicker state
    if (scroll < 0.05) {
      flickerStartTime.current = null
      isFlickering.current = false
      hasFlickered.current = false
      setIntensities({ key: 0, fill: 0, rim: 0, bounce: 0, ambient: 0 })
      return
    }

    // Above threshold: trigger flicker if not already started
    if (scroll >= 0.05 && !hasFlickered.current) {
      if (!isFlickering.current) {
        // Start flicker animation
        flickerStartTime.current = currentTime
        isFlickering.current = true
      }

      // Calculate elapsed time since flicker started
      const elapsedTime = currentTime - (flickerStartTime.current ?? currentTime)

      // Reduced motion: instant fade instead of flicker
      if (prefersReducedMotion.current) {
        const fadeProgress = Math.min(elapsedTime / 0.5, 1) // 0.5s fade
        const intensity = fadeProgress
        const ambient = fadeProgress * 0.3
        setIntensities({ key: intensity, fill: intensity, rim: intensity, bounce: intensity, ambient })

        if (fadeProgress >= 1) {
          hasFlickered.current = true
          isFlickering.current = false
        }
        return
      }

      // Time-based flicker animation
      if (elapsedTime < FLICKER_DURATION) {
        // Still flickering - force continuous rendering
        invalidate()

        const ambientIntensity = Math.min(elapsedTime / FLICKER_DURATION, 1) * 0.3

        setIntensities({
          key: getIntensityAtTime(elapsedTime + LIGHT_OFFSETS.key),
          fill: getIntensityAtTime(elapsedTime + LIGHT_OFFSETS.fill),
          bounce: getIntensityAtTime(elapsedTime + LIGHT_OFFSETS.bounce),
          rim: getIntensityAtTime(elapsedTime + LIGHT_OFFSETS.rim),
          ambient: ambientIntensity,
        })
      } else {
        // Flicker complete: full brightness
        hasFlickered.current = true
        isFlickering.current = false
        setIntensities({ key: 1, fill: 1, rim: 1, bounce: 1, ambient: 0.3 })
      }
    }

    // Already flickered: stay at full brightness
    if (hasFlickered.current) {
      setIntensities({ key: 1, fill: 1, rim: 1, bounce: 1, ambient: 0.3 })
    }
  })

  return intensities
}
