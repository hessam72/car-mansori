'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface InteriorLookControlsProps {
  sensitivity?: number
  pitchLimit?: number
}

export default function InteriorLookControls({
  sensitivity = 0.003,
  pitchLimit = Math.PI / 3 // 60 degrees
}: InteriorLookControlsProps) {
  const { camera, gl, invalidate } = useThree()
  const isDragging = useRef(false)
  const previousPosition = useRef({ x: 0, y: 0 })
  const rotation = useRef({ yaw: 0, pitch: 0 })
  const smoothedRotation = useRef({ yaw: 0, pitch: 0 })

  // Apply camera rotation on every frame with smooth lerping
  useFrame(() => {
    // Lerp for smooth camera movement
    const lerpFactor = 0.15
    smoothedRotation.current.yaw += (rotation.current.yaw - smoothedRotation.current.yaw) * lerpFactor
    smoothedRotation.current.pitch += (rotation.current.pitch - smoothedRotation.current.pitch) * lerpFactor

    // Calculate look direction from smoothed rotation
    const direction = new THREE.Vector3()
    direction.x = Math.sin(smoothedRotation.current.yaw) * Math.cos(smoothedRotation.current.pitch)
    direction.y = Math.sin(smoothedRotation.current.pitch)
    direction.z = Math.cos(smoothedRotation.current.yaw) * Math.cos(smoothedRotation.current.pitch)
    direction.normalize()

    // Update camera lookAt target
    const lookAtTarget = new THREE.Vector3()
    lookAtTarget.addVectors(camera.position, direction.multiplyScalar(5))
    camera.lookAt(lookAtTarget)
    invalidate()
  })

  useEffect(() => {
    const domElement = gl.domElement

    const handlePointerDown = (e: PointerEvent | TouchEvent) => {
      isDragging.current = true
      const point = 'touches' in e ? e.touches[0] : e
      previousPosition.current = { x: point.clientX, y: point.clientY }
      domElement.style.cursor = 'grabbing'
    }

    const handlePointerMove = (e: PointerEvent | TouchEvent) => {
      if (!isDragging.current) return

      const point = 'touches' in e ? e.touches[0] : e
      const deltaX = point.clientX - previousPosition.current.x
      const deltaY = point.clientY - previousPosition.current.y

      // Update rotation (reversed: drag left = look right, drag up = look down)
      rotation.current.yaw += deltaX * sensitivity
      rotation.current.pitch += deltaY * sensitivity

      // Apply pitch limit only (allow 360° yaw)
      rotation.current.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, rotation.current.pitch))

      previousPosition.current = { x: point.clientX, y: point.clientY }
    }

    const handlePointerUp = () => {
      isDragging.current = false
      domElement.style.cursor = 'grab'
    }

    // Set initial cursor
    domElement.style.cursor = 'grab'

    // Add event listeners
    domElement.addEventListener('pointerdown', handlePointerDown)
    domElement.addEventListener('pointermove', handlePointerMove)
    domElement.addEventListener('pointerup', handlePointerUp)
    domElement.addEventListener('pointerleave', handlePointerUp)

    // Touch events
    domElement.addEventListener('touchstart', handlePointerDown, { passive: true })
    domElement.addEventListener('touchmove', handlePointerMove, { passive: true })
    domElement.addEventListener('touchend', handlePointerUp)

    return () => {
      domElement.style.cursor = 'auto'
      domElement.removeEventListener('pointerdown', handlePointerDown)
      domElement.removeEventListener('pointermove', handlePointerMove)
      domElement.removeEventListener('pointerup', handlePointerUp)
      domElement.removeEventListener('pointerleave', handlePointerUp)
      domElement.removeEventListener('touchstart', handlePointerDown)
      domElement.removeEventListener('touchmove', handlePointerMove)
      domElement.removeEventListener('touchend', handlePointerUp)
    }
  }, [camera, gl, sensitivity, pitchLimit])

  return null
}
