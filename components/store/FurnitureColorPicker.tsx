'use client'

import { useRef, useState } from 'react'
import { Billboard, Html } from '@react-three/drei'
import { useFurnitureConfig } from '@/stores/furnitureConfigStore'
import type { FurnitureColor } from '@/stores/furnitureConfigStore'
import * as THREE from 'three'

interface FurnitureColorPickerProps {
  position: [number, number, number]
  colors: FurnitureColor[]
  currentColor: string
}

export function FurnitureColorPicker({
  position,
  colors,
  currentColor,
}: FurnitureColorPickerProps) {
  const { setColor } = useFurnitureConfig()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const handleColorClick = (colorHex: string) => {
    setColor(colorHex)
  }

  return (
    <Billboard position={position} follow={true} lockX={false} lockY={false} lockZ={false}>
      <Html
        center
        distanceFactor={3}
        style={{
          pointerEvents: 'auto',
          userSelect: 'none',
        }}
      >
        <div className="flex gap-3 p-3 bg-black/70 backdrop-blur-sm rounded-full border border-white/20">
          {colors.map((color, index) => {
            const isActive = color.hex === currentColor
            const isHovered = hoveredIndex === index

            return (
              <button
                key={color.hex}
                onClick={() => handleColorClick(color.hex)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="relative group"
                style={{
                  width: isActive ? '48px' : '40px',
                  height: isActive ? '48px' : '40px',
                  transition: 'all 0.3s ease',
                }}
                title={color.name}
              >
                {/* Color circle */}
                <div
                  className="w-full h-full rounded-full border-2 transition-all duration-300"
                  style={{
                    backgroundColor: color.hex,
                    borderColor: isActive ? '#fff' : isHovered ? '#fff' : 'rgba(255,255,255,0.3)',
                    boxShadow: isActive
                      ? '0 0 20px rgba(255,255,255,0.5)'
                      : isHovered
                      ? '0 0 12px rgba(255,255,255,0.3)'
                      : 'none',
                    transform: isHovered && !isActive ? 'scale(1.1)' : 'scale(1)',
                  }}
                />

                {/* Active indicator */}
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-full border-2 border-white animate-ping"
                    style={{ animationDuration: '2s' }}
                  />
                )}

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                    {color.name}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </Html>
    </Billboard>
  )
}
