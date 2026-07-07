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
        <MdImageNotSupported className="text-gray-600 text-5xl mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No parts available for this category</p>
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
              group relative p-3 rounded-xl border-2 transition-all
              ${
                isSelected
                  ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                  : 'border-gray-700 hover:border-gray-600 bg-gray-800/50 hover:bg-gray-800'
              }
            `}
          >
            {/* Thumbnail */}
            <div className="aspect-square mb-2 bg-gray-900 rounded-lg overflow-hidden">
              {part.thumbnail ? (
                <img
                  src={part.thumbnail}
                  alt={part.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
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
            <div className={`text-xs font-bold ${part.price === 0 ? 'text-green-400' : 'text-blue-400'}`}>
              {part.price === 0 ? 'Stock' : `$${part.price.toLocaleString()}`}
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <IoCheckmark className="text-white text-base" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
