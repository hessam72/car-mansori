'use client'

import { useCarConfig } from '@/stores/carConfigStore'
import partsConfig from '@/public/config/car-parts.json'
import { IoCheckmark } from 'react-icons/io5'
import { MdImageNotSupported } from 'react-icons/md'

interface PartsGridProps {
  category: string
}

export default function PartsGrid({ category }: PartsGridProps) {
  const selectedParts = useCarConfig((s) => s.selectedParts)
  const selectPart = useCarConfig((s) => s.selectPart)

  const parts = partsConfig[category as keyof typeof partsConfig] || []

  if (parts.length === 0) {
    return (
      <div className="text-center py-12">
        <MdImageNotSupported className="text-gray-500 text-5xl mx-auto mb-3" />
        <p className="text-gray-300 text-sm">No parts available for this category</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {parts.map((part: any) => {
        const isSelected = selectedParts[category] === part.id

        return (
          <button
            key={part.id}
            onClick={() => selectPart(category, part.id)}
            className={`
              group relative p-3 rounded-xl border transition-all backdrop-blur-sm
              ${
                isSelected
                  ? 'border-blue-400/50 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-[0_4px_16px_rgba(59,130,246,0.3)]'
                  : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
              }
            `}
          >
            {/* Thumbnail */}
            <div className="aspect-square mb-2 bg-black/20 rounded-lg overflow-hidden border border-white/5">
              {part.thumbnail ? (
                <img
                  src={part.thumbnail}
                  alt={part.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                  <MdImageNotSupported className="text-3xl mb-1" />
                  <span className="text-xs">No Image</span>
                </div>
              )}
            </div>

            {/* Name */}
            <div className="text-xs md:text-sm font-medium text-gray-200 mb-1 line-clamp-1">
              {part.name}
            </div>

            {/* Price */}
            <div className={`text-xs font-bold ${part.price === 0 ? 'text-emerald-400' : 'text-blue-400'}`}>
              {part.price === 0 ? 'Stock' : `$${part.price.toLocaleString()}`}
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.5)] border border-blue-400/30">
                <IoCheckmark className="text-white text-base" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
