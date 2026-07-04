'use client'

import { useCarConfig } from '@/stores/carConfigStore'
import partsConfig from '@/public/config/car-parts.json'

interface PartsGridProps {
  category: string
}

export default function PartsGrid({ category }: PartsGridProps) {
  const selectedParts = useCarConfig((s) => s.selectedParts)
  const selectPart = useCarConfig((s) => s.selectPart)

  const parts = partsConfig[category as keyof typeof partsConfig] || []

  if (parts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No parts available for this category
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {parts.map((part: any) => {
        const isSelected = selectedParts[category] === part.id

        return (
          <button
            key={part.id}
            onClick={() => selectPart(category, part.id)}
            className={`
              group relative p-3 rounded-lg border-2 transition-all
              ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }
            `}
          >
            {/* Thumbnail */}
            <div className="aspect-square mb-2 bg-gray-100 rounded-lg overflow-hidden">
              {part.thumbnail ? (
                <img
                  src={part.thumbnail}
                  alt={part.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                  No Image
                </div>
              )}
            </div>

            {/* Name */}
            <div className="text-sm font-medium text-gray-900 mb-1">
              {part.name}
            </div>

            {/* Price */}
            <div className="text-xs font-semibold text-blue-600">
              {part.price === 0 ? 'Stock' : `$${part.price.toLocaleString()}`}
            </div>

            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
