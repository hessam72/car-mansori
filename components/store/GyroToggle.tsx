'use client'
import { useState, useEffect } from 'react'
import { MdScreenRotation, MdScreenRotationAlt } from 'react-icons/md'

interface GyroToggleProps {
  onGyroChange: (enabled: boolean) => void
}

export function GyroToggle({ onGyroChange }: GyroToggleProps) {
  const [isGyroEnabled, setIsGyroEnabled] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt'>('prompt')

  useEffect(() => {
    // Check if DeviceOrientationEvent is supported
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      setIsSupported(true)
    }
  }, [])

  const requestPermission = async () => {
    if (!isSupported) return

    try {
      // iOS 13+ requires explicit permission
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as any).requestPermission()
        setPermissionState(permission)

        if (permission === 'granted') {
          setIsGyroEnabled(true)
          onGyroChange(true)
        } else {
          alert('Gyroscope permission denied')
        }
      } else {
        // Non-iOS or older browsers - permission not required
        setPermissionState('granted')
        setIsGyroEnabled(true)
        onGyroChange(true)
      }
    } catch (error) {
      console.error('Error requesting device orientation permission:', error)
      alert('Failed to enable gyroscope controls')
    }
  }

  const toggleGyro = () => {
    if (isGyroEnabled) {
      setIsGyroEnabled(false)
      onGyroChange(false)
    } else {
      requestPermission()
    }
  }

  // Don't render on desktop or unsupported devices
  if (!isSupported) return null

  return (
    <button
      onClick={toggleGyro}
      aria-pressed={isGyroEnabled}
      className={`fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border bg-black/40 backdrop-blur-md transition-colors duration-200 ${
        isGyroEnabled
          ? 'border-[#d4af37]/50 text-[#d4af37]'
          : 'border-white/10 text-white/70 hover:border-white/30 hover:text-white'
      }`}
      aria-label={isGyroEnabled ? 'Disable gyroscope controls' : 'Enable gyroscope controls'}
    >
      {isGyroEnabled ? <MdScreenRotationAlt size={18} /> : <MdScreenRotation size={18} />}
    </button>
  )
}
