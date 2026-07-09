'use client'

import { useCarConfig } from '@/stores/carConfigStore'

const partLabels: Record<string, string> = {
  car_door_left: 'Left Door',
  car_door_right: 'Right Door',
  car_door_back_left: 'Left Rear',
  car_door_back_right: 'Right Rear',
  car_caput: 'Hood',
  car_trunk: 'Trunk',
}

export default function PartsTogglePanel() {
  const openParts = useCarConfig((s) => s.openParts)
  const togglePart = useCarConfig((s) => s.togglePart)
  const openAllParts = useCarConfig((s) => s.openAllParts)
  const closeAllParts = useCarConfig((s) => s.closeAllParts)

  const allOpen = Object.values(openParts).every((v) => v)
  const allClosed = Object.values(openParts).every((v) => !v)

  const handleToggle = (partName: string) => {
    console.log('[PartsTogglePanel] Button clicked:', partName)
    togglePart(partName)
  }

  const handleOpenAll = () => {
    console.log('[PartsTogglePanel] Open All clicked')
    openAllParts()
  }

  const handleCloseAll = () => {
    console.log('[PartsTogglePanel] Close All clicked')
    closeAllParts()
  }

  return (
    <div className="fixed bottom-8 right-8 z-20 flex flex-col gap-3">
      {/* Individual part toggles */}
      <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl">
        <h3 className="text-white text-sm font-semibold mb-3 opacity-80">Car Parts</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(partLabels).map(([partName, label]) => (
            <button
              key={partName}
              onClick={() => handleToggle(partName)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                openParts[partName]
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                  : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Open/Close All buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleOpenAll}
          disabled={allOpen}
          className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
            allOpen
              ? 'bg-gray-600/50 text-white/40 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/30'
          }`}
        >
          Open All
        </button>
        <button
          onClick={handleCloseAll}
          disabled={allClosed}
          className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
            allClosed
              ? 'bg-gray-600/50 text-white/40 cursor-not-allowed'
              : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
          }`}
        >
          Close All
        </button>
      </div>
    </div>
  )
}
