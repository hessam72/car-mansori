'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface InteriorLookControlsProps {
  sensitivity?: number
  pitchLimit?: number
  yawLimit?: number
}

export default function InteriorLookControls({
  sensitivity = 0.002,
  pitchLimit = Math.PI / 3, // 60 degrees
  yawLimit = Math.PI * 2 / 3 // 120 degrees
}: InteriorLookControlsProps) {
  const { camera, gl } = useThree()
  const isDragging = useRef(false)
  const previousPosition = useRef({ x: 0, y: 0 })
  const rotation = useRef({ yaw: 0, pitch: 0 })
  const baseDirection = useRef(new THREE.Vector3(0, 0, 1)) // Forward

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

      // Update rotation
      rotation.current.yaw -= deltaX * sensitivity
      rotation.current.pitch -= deltaY * sensitivity

      // Apply limits
      rotation.current.pitch = Math.max(-pitchLimit, Math.min(pitchLimit, rotation.current.pitch))
      rotation.current.yaw = Math.max(-yawLimit, Math.min(yawLimit, rotation.current.yaw))

      // Calculate new look direction
      const direction = new THREE.Vector3()
      direction.x = Math.sin(rotation.current.yaw) * Math.cos(rotation.current.pitch)
      direction.y = Math.sin(rotation.current.pitch)
      direction.z = Math.cos(rotation.current.yaw) * Math.cos(rotation.current.pitch)
      direction.normalize()

      // Update camera lookAt target
      const lookAtTarget = new THREE.Vector3()
      lookAtTarget.addVectors(camera.position, direction.multiplyScalar(5))
      camera.lookAt(lookAtTarget)

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
  }, [camera, gl, sensitivity, pitchLimit, yawLimit])

  return null
}
