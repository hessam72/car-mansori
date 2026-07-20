'use client'
import { useEffect, useRef, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import nipplejs from 'nipplejs'

// Frame-loop scratch — never allocate (or mutate a shared basis) inside the
// movement update
const _forward = new THREE.Vector3()
const _right = new THREE.Vector3()
const _UP = new THREE.Vector3(0, 1, 0)

export function useJoystickControls(playerVelocity: React.RefObject<THREE.Vector3>) {
  const { camera } = useThree()
  const keysPressed = useRef<Record<string, boolean>>({})
  const joystickInput = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const setJoystickInput = useCallback((x: number, y: number) => {
    joystickInput.current = { x, y }
  }, [])

  /** Applies input to playerVelocity; returns whether any input is active */
  const updateMovement = (_delta: number): boolean => {
    const speed = 4 // units/second
    const keys = keysPressed.current

    // Get camera direction (ignore Y component for movement)
    camera.getWorldDirection(_forward)
    _forward.y = 0
    _forward.normalize()
    _right.crossVectors(_forward, _UP).normalize()

    // Reset horizontal velocity each frame (Rapier damping handles deceleration)
    if (playerVelocity.current) {
      playerVelocity.current.x = 0
      playerVelocity.current.z = 0
    }

    // addScaledVector never mutates the basis vectors — the old
    // add(forward.multiplyScalar(...)) chain corrupted them when opposing
    // keys (W+S / A+D) were held together
    let hasInput = false
    if (keys['w']) { playerVelocity.current?.addScaledVector(_forward, speed); hasInput = true }
    if (keys['s']) { playerVelocity.current?.addScaledVector(_forward, -speed); hasInput = true }
    if (keys['a']) { playerVelocity.current?.addScaledVector(_right, -speed); hasInput = true }
    if (keys['d']) { playerVelocity.current?.addScaledVector(_right, speed); hasInput = true }

    // Apply virtual joystick input
    const { x, y } = joystickInput.current
    if (x !== 0 || y !== 0) {
      playerVelocity.current?.addScaledVector(_right, x * speed)
      playerVelocity.current?.addScaledVector(_forward, y * speed)
      hasInput = true
    }
    return hasInput
  }

  return { updateMovement, setJoystickInput }
}

// Virtual joystick component for mobile
export function VirtualJoystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const zoneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!zoneRef.current) return

    const manager = nipplejs.create({
      zone: zoneRef.current,
      mode: 'static',
      position: { left: '80px', bottom: '80px' },
      color: '#2a2a2a',
      size: 120,
    })

    manager.on('move', (evt) => {
      if (!evt.data?.angle) return
      const angle = evt.data.angle.radian
      const force = Math.min(evt.data.force, 2) / 2
      const x = Math.cos(angle) * force
      const y = Math.sin(angle) * force
      onMove(x, y)
    })

    manager.on('end', () => onMove(0, 0))

    return () => manager.destroy()
  }, [onMove])

  return (
    <div
      ref={zoneRef}
      className="fixed bottom-0 right-0 w-40 h-40 pointer-events-auto z-50"
      style={{ touchAction: 'none' }}
    >
      <style jsx>{`
        div :global(.back) {
          background: rgba(20, 20, 20, 0.4) !important;
          border: 2px solid rgba(238, 194, 0, 0.67) !important;
        }
        div :global(.front) {
          background: rgba(255, 221, 0, 0.62) !important;
          border: 2px solid rgba(255, 255, 255, 0) !important;
        }
      `}</style>
    </div>
  )
}
