'use client'

import { useState, useEffect } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import PaintControls from './PaintControls'
import PartsGrid from './PartsGrid'
import partsConfig from '@/public/config/car-parts.json'
import { useCarConfig } from '@/stores/carConfigStore'
import './customizationPanel.css'
import {
   IoColorPalette, IoCarSport, IoClose, IoChevronBack
} from 'react-icons/io5'
import {
  GiCarWheel, GiWingCloak, GiCarDoor,
  GiMirrorMirror,
  GiSmokingPipe
} from 'react-icons/gi'
import { TbCarSuv } from 'react-icons/tb'
import { MdTune } from 'react-icons/md'

// Preload all parts in a category
function preloadCategory(categoryId: string) {
  const parts = partsConfig[categoryId as keyof typeof partsConfig] || []
  parts.forEach((part: any) => {
    if (part.model_path) {
      try {
        useLoader.preload(GLTFLoader, part.model_path)
      } catch (error) {
        console.warn(`[Preload] Failed to preload ${part.model_path}:`, error)
      }
    }
  })
}

const CATEGORIES = [
  { id: 'paint', name: 'Paint', icon: IoColorPalette },
  { id: 'wheels', name: 'Wheels', icon: GiCarWheel },
  { id: 'spoilers', name: 'Spoilers', icon: GiWingCloak },
  { id: 'hoods', name: 'Hoods', icon: IoCarSport },
  { id: 'bumpers', name: 'Bumpers', icon: GiCarDoor },
  { id: 'mirrors', name: 'Mirrors', icon: GiMirrorMirror },
  { id: 'exhaust', name: 'Exhaust', icon: GiSmokingPipe },
  { id: 'side-skirts', name: 'Side Skirts', icon: TbCarSuv },
]

export default function CustomizationPanel() {
  const [activeTab, setActiveTab] = useState('paint')
  const [isExpanded, setIsExpanded] = useState(true)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
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
    <>
      {/* Mobile FAB - Shows when collapsed */}
      <button
        onClick={() => setIsExpanded(true)}
        className={`
          fixed bottom-6 right-6 z-50 md:hidden
          w-14 h-14 rounded-full bg-blue-500 hover:bg-blue-600
          shadow-lg hover:shadow-xl
          flex items-center justify-center
          transition-all duration-300
          ${isExpanded ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
        aria-label="Open customization panel"
      >
        <MdTune className="text-white text-2xl" />
      </button>

      {/* Mobile Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Main Panel */}
      <div
        className={` cmpanel
          fixed z-50 bg-gray-900/95 backdrop-blur-xl shadow-2xl flex flex-col
          transition-all duration-300 ease-in-out

          ${isExpanded
            ? 'bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl md:rounded-none'
            : 'bottom-[-100%] left-0 right-0'
          }

          md:top-0 md:bottom-0 md:h-screen md:left-auto md:right-0
          ${isExpanded ? 'md:w-96' : 'md:w-16'}
        `}
      >
        {/* Mobile Drag Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* Header */}
        <div className={`
          p-4 border-b border-gray-700/50
          ${isExpanded ? 'md:p-6' : 'md:p-0 md:border-0'}
        `}>
          <div className="flex items-center justify-between">
            {isExpanded ? (
              <>
                <div className="flex-1">
                  <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                    Customize Car
                  </h2>
                  <div className="text-xs md:text-sm text-gray-400">
                    Total: <span className="text-lg md:text-xl font-bold text-blue-400">
                      ${totalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Minimize panel"
                  >
                    <IoClose className="text-gray-400 hover:text-white text-xl" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setIsExpanded(true)}
                className="hidden md:flex w-full py-6 items-center justify-center hover:bg-gray-800 transition-colors"
                aria-label="Expand panel"
              >
                <IoChevronBack className="text-gray-400 hover:text-white text-xl" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs - Only show when expanded */}
        {isExpanded && (
          <div className="flex overflow-x-auto border-b border-gray-700/50 bg-gray-800/50 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const IconComponent = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className={`
                    flex-shrink-0 px-3 md:px-4 py-3 text-xs md:text-sm font-medium
                    transition-all duration-200 whitespace-nowrap
                    flex items-center gap-2
                    ${
                      activeTab === cat.id
                        ? 'bg-gray-900 text-blue-400 border-b-2 border-blue-400'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/30'
                    }
                  `}
                >
                  <IconComponent className="text-base md:text-lg" />
                  <span className="hidden sm:inline">{cat.name}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Content Area - Only show when expanded */}
        {isExpanded && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 overscroll-contain" style={{ scrollBehavior: 'smooth' }}>
            {activeTab === 'paint' ? (
              <PaintControls />
            ) : (
              <PartsGrid category={activeTab} />
            )}
          </div>
        )}

        {/* Footer - Only show when expanded */}
        {isExpanded && (
          <div className="p-4 md:p-6 border-t border-gray-700/50 bg-gray-800/50">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full px-4 py-3 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-all font-medium text-sm md:text-base hover:shadow-lg"
            >
              Reset to Default
            </button>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm"
            onClick={() => setShowResetConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-[90%] max-w-md">
            <div className="bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-2">Reset Configuration?</h3>
              <p className="text-gray-400 text-sm mb-6">
                This will reset all customizations to default. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    useCarConfig.getState().resetConfig()
                    setShowResetConfirm(false)
                  }}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
