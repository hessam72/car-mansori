'use client'

import { useState, useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import PaintControls from './PaintControls'
import PartsGrid from './PartsGrid'
import partsConfig from '@/public/config/car-parts.json'
import { useCarConfig } from '@/stores/carConfigStore'

// Preload all parts in a category
function preloadCategory(categoryId: string) {
  const parts = partsConfig[categoryId as keyof typeof partsConfig] || []
  parts.forEach((part: any) => {
    if (part.model_path) {
      useLoader.preload(GLTFLoader, part.model_path)
    }
  })
}

const CATEGORIES = [
  { id: 'paint', name: 'Paint', icon: '🎨' },
  { id: 'wheels', name: 'Wheels', icon: '⚙️' },
  { id: 'spoilers', name: 'Spoilers', icon: '✈️' },
  { id: 'hoods', name: 'Hoods', icon: '🚗' },
  { id: 'bumpers', name: 'Bumpers', icon: '🛡️' },
  { id: 'mirrors', name: 'Mirrors', icon: '🪞' },
  { id: 'exhaust', name: 'Exhaust', icon: '💨' },
  { id: 'side-skirts', name: 'Side Skirts', icon: '📏' },
]

export default function CustomizationPanel() {
  const [activeTab, setActiveTab] = useState('paint')
  const selectedParts = useCarConfig((s) => s.selectedParts)

  // Calculate total price
  const totalPrice = Object.entries(selectedParts).reduce((total, [category, partId]) => {
    const parts = partsConfig[category as keyof typeof partsConfig] || []
    const part = parts.find((p: any) => p.id === partId)
    return total + (part?.price || 0)
  }, 0)

  // Preload current category parts immediately on tab change
  useEffect(() => {
    if (activeTab !== 'paint') {
      preloadCategory(activeTab)
    }
  }, [activeTab])

  // Prefetch adjacent categories during idle time
  useEffect(() => {
    const categories = CATEGORIES.filter((c) => c.id !== 'paint' && c.id !== activeTab).map(
      (c) => c.id
    )

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleCallback = window.requestIdleCallback(
        () => {
          categories.forEach((cat) => preloadCategory(cat))
        },
        { timeout: 2000 }
      )

      return () => window.cancelIdleCallback(idleCallback)
    }
  }, [activeTab])

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-10 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Customize Car</h2>
        <div className="text-sm text-gray-600">
          Total: <span className="text-xl font-bold text-blue-600">${totalPrice.toLocaleString()}</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`
              flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap
              ${
                activeTab === cat.id
                  ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }
            `}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'paint' ? (
          <PaintControls />
        ) : (
          <PartsGrid category={activeTab} />
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <button
          onClick={() => useCarConfig.getState().resetConfig()}
          className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Reset to Default
        </button>
      </div>
    </div>
  )
}
