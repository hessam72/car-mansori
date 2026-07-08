'use client'

import { useState } from 'react'
import { useCameraStore, CAMERA_PRESETS, PresetName } from '@/stores/cameraStore'
import { RotateCcw, Home, ChevronRight, ChevronLeft } from 'lucide-react'
import {
  MdOutlineViewInAr,
  MdOutlineZoomIn,
  MdArrowUpward
} from 'react-icons/md'
import { TbCarSuv } from 'react-icons/tb'
import { IoCarSportOutline } from 'react-icons/io5'

const presetIcons: Record<PresetName, React.ComponentType<{ className?: string }>> = {
  front: () => <IoCarSportOutline className="w-5 h-5" style={{ transform: 'rotate(0deg)' }} />,
  rear: () => <IoCarSportOutline className="w-5 h-5" style={{ transform: 'rotate(180deg)' }} />,
  sideLeft: () => <TbCarSuv className="w-5 h-5" style={{ transform: 'scaleX(-1)' }} />,
  sideRight: () => <TbCarSuv className="w-5 h-5" />,
  top: () => <MdArrowUpward className="w-5 h-5" />,
  detail: () => <MdOutlineZoomIn className="w-5 h-5" />,
  home: () => <MdOutlineViewInAr className="w-5 h-5" />
}

export default function CameraPresets() {
  const { activePreset, setPreset, autoRotate, setAutoRotate } = useCameraStore()
  const [isExpanded, setIsExpanded] = useState(false)

  const presets: PresetName[] = ['front', 'rear', 'sideLeft', 'sideRight', 'top', 'detail']

  return (
    <>
      {/* Mobile FAB - Bottom Left */}
      <button
        onClick={() => setIsExpanded(true)}
        className={`
          fixed bottom-6 left-6 z-40 md:hidden
          w-14 h-14 rounded-full
          bg-gradient-to-br from-gray-800 to-gray-900
          hover:from-gray-700 hover:to-gray-800
          shadow-[0_8px_24px_rgba(0,0,0,0.5)]
          hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)]
          border border-white/20
          backdrop-blur-xl
          flex items-center justify-center
          transition-all duration-300
          ${isExpanded ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
        `}
        aria-label="Open camera controls"
      >
        <MdOutlineViewInAr className="text-white text-2xl" />
      </button>

      {/* Mobile Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Main Panel */}
      <div
        className={`
          fixed z-40 flex flex-col
          transition-all duration-300 ease-in-out
          bg-black/40 backdrop-blur-3xl
          border-r border-white/20
          shadow-[0_8px_32px_rgba(0,0,0,0.3)]

          ${isExpanded
            ? 'bottom-0 left-0 right-0 max-h-[70vh] rounded-t-3xl md:rounded-none md:max-h-none'
            : 'bottom-[-100%] left-0 right-0'
          }

          md:top-0 md:bottom-0 md:h-screen md:right-auto md:left-0
          ${isExpanded ? 'md:w-48' : 'md:w-12'}
        `}
      >
        {/* Mobile Drag Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
        </div>

        {/* Header - Desktop Only */}
        <div className="hidden md:flex items-center justify-center py-4 border-b border-white/10">
          {isExpanded ? (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
              aria-label="Collapse panel"
            >
              <ChevronLeft className="text-white/80 hover:text-white w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setIsExpanded(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
              aria-label="Expand panel"
            >
              <ChevronRight className="text-white/80 hover:text-white w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-2">
          {/* Mobile: Horizontal Layout */}
          <div className="md:hidden space-y-4">
            {/* Controls */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  autoRotate
                    ? 'bg-blue-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                <RotateCcw className="w-5 h-5" />
                <span>Auto Rotate</span>
              </button>

              <button
                onClick={() => setPreset('home')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all"
              >
                <Home className="w-5 h-5" />
                <span>Reset</span>
              </button>
            </div>

            {/* Camera Presets */}
            <div className="grid grid-cols-2 gap-3">
              {presets.map((preset) => {
                const IconComponent = presetIcons[preset]
                return (
                  <button
                    key={preset}
                    onClick={() => {
                      setPreset(preset)
                      setIsExpanded(false)
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      activePreset === preset
                        ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                        : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                    }`}
                  >
                    <IconComponent />
                    {CAMERA_PRESETS[preset].label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Desktop: Vertical Layout */}
          <div className="hidden md:flex flex-col gap-2">
            {/* Auto Rotate */}
            <button
            style={{display:'grid' , justifyContent:'center' , alignItems:'center'}}
              onClick={() => setAutoRotate(!autoRotate)}
              className={`px-3 py-2.5 rounded-lg transition-all ${
                autoRotate
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white/60 hover:bg-white/20'
              } ${isExpanded ? 'flex items-center gap-3' : ''}`}
              title="Auto Rotate"
            >
              <RotateCcw className={`w-5 h-5 ${isExpanded ? '' : 'mx-auto'}`} />
              {isExpanded && <span className="text-sm font-medium">Auto Rotate</span>}
            </button>

            {/* Reset */}
            <button
            style={{display:'grid' , justifyContent:'center' , alignItems:'center'}}
              onClick={() => setPreset('home')}
              className={`px-3 py-2.5 rounded-lg bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all ${isExpanded ? 'flex items-center gap-3' : ''}`}
              title="Reset Camera"
            >
              <Home className={`w-5 h-5 ${isExpanded ? '' : 'mx-auto'}`} />
              {isExpanded && <span className="text-sm font-medium">Reset</span>}
            </button>

            <div className="my-2 h-px bg-white/10" />

            {/* Camera Presets */}
            {presets.map((preset) => {
              const IconComponent = presetIcons[preset]
              return (
                <button
                  key={preset}
                  onClick={() => setPreset(preset)}
                  className={`px-3 py-2.5 rounded-lg transition-all ${
                    activePreset === preset
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  } ${isExpanded ? 'flex items-center gap-3' : ''}`}
                  title={CAMERA_PRESETS[preset].label}
                >
                  <div style={{display:'grid' , justifyContent:'center' , alignItems:'center'}} className={isExpanded ? '' : 'mx-auto'}>
                    <IconComponent />
                  </div>
                  {isExpanded && <span className="text-sm font-medium">{CAMERA_PRESETS[preset].label}</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
