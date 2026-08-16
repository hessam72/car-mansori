'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

/** Covers a shadow re-render + a ~1.2s animation even at 120Hz */
const DEFAULT_WINDOW_FRAMES = 150

type Props = {
  /**
   * Anything that changes what the shadow map should contain — moved props,
   * opened doors, swapped meshes, quality changes. Each change reopens a
   * re-render window. Static scenes can pass [].
   */
  deps?: unknown[]
  /** Rendered frames to keep updating after each dep change. */
  windowFrames?: number
}

/**
 * Shadow maps normally re-render every frame, but a static light over static
 * geometry is a wasted 2048² depth pass per frame. This freezes shadow updates
 * (shadowMap.autoUpdate = false) and re-enables them only for a frame-counted
 * window after events that actually change shadow content.
 *
 * Only mount this if your sun AND your casters are static. A moving sun (a
 * day/night cycle) must NOT use it.
 */
export default function ShadowFreeze({ deps = [], windowFrames = DEFAULT_WINDOW_FRAMES }: Props) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const pendingRef = useRef(windowFrames)

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    return () => {
      gl.shadowMap.autoUpdate = true
    }
  }, [gl])

  useEffect(() => {
    pendingRef.current = windowFrames
    invalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, windowFrames, invalidate])

  useFrame(() => {
    if (pendingRef.current > 0) {
      pendingRef.current -= 1
      gl.shadowMap.needsUpdate = true
      invalidate()
    }
  })

  return null
}
