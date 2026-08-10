'use client'

import { useState } from 'react'
import { motion, PanInfo } from 'framer-motion'
import { X } from 'lucide-react'

interface FurnitureColor {
  name: string
  hex: string
}

interface ProductData {
  id: string
  name: string
  category?: string
  type?: string
  dimensions?: string
  material?: string
  weight?: string
  seatingCapacity?: string
  shelves?: string
  colors?: FurnitureColor[]
  fabricType?: string
  detailedDescription?: string
  fabricMaterials?: string[]
  glbPath?: string
  usdzPath?: string
}

interface ProductDrawerProps {
  product: ProductData | null
  onClose: () => void
  onViewAR?: () => void
}

type Tab = 'colors' | 'details' | 'fabric' | 'dimensions'

export default function ProductDrawer({ product, onClose, onViewAR }: ProductDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('colors')

  if (!product) return null

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose()
    }
  }

  const tabs = [
    { id: 'colors' as Tab, label: 'انتخاب رنگ' },
    { id: 'details' as Tab, label: 'جزییات' },
    { id: 'fabric' as Tab, label: 'جنس پارچه' },
    { id: 'dimensions' as Tab, label: 'ابعاد' }
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-4xl
                   bg-[var(--surface-3)] rounded-t-3xl shadow-2xl
                   max-h-[85vh] md:max-h-[75vh] flex flex-col"
        style={{
          boxShadow: '0 -4px 24px rgba(212, 175, 55, 0.15)'
        }}
      >
        {/* Drag Handle (Mobile) */}
        <div className="flex justify-center pt-4 pb-2 md:hidden">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] font-['Shabnam']">
            {product.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-6 h-6 text-[var(--text-primary)]" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 py-4 border-b border-white/10 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-['Shabnam'] transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--gold-primary)] text-black font-bold'
                  : 'bg-white/5 text-[var(--text-primary)] hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {activeTab === 'colors' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)] font-['Shabnam'] mb-4">
                رنگ‌های موجود
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {product.colors?.map((color) => (
                  <div
                    key={color.hex}
                    className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div
                      className="w-20 h-20 rounded-full border-4 border-[var(--gold-primary)]/40 hover:border-[var(--gold-primary)] transition-all shadow-lg"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-sm text-[var(--text-primary)] font-['Shabnam']">
                      {color.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)] font-['Shabnam'] mb-4">
                توضیحات محصول
              </h3>
              <p className="text-[var(--text-primary)]/80 leading-relaxed font-['Shabnam'] text-base">
                {product.detailedDescription || 'توضیحات موجود نیست'}
              </p>
            </div>
          )}

          {activeTab === 'fabric' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)] font-['Shabnam'] mb-4">
                جنس پارچه و مواد اولیه
              </h3>
              <div className="bg-white/5 rounded-xl p-4 mb-4">
                <p className="text-[var(--gold-primary)] font-semibold font-['Shabnam'] mb-2">
                  جنس اصلی:
                </p>
                <p className="text-[var(--text-primary)] font-['Shabnam']">
                  {product.fabricType || 'موجود نیست'}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-[var(--gold-primary)] font-semibold font-['Shabnam']">
                  مواد تشکیل‌دهنده:
                </p>
                <ul className="space-y-2">
                  {product.fabricMaterials?.map((material, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 text-[var(--text-primary)] font-['Shabnam']"
                    >
                      <span className="text-[var(--gold-primary)] mt-1">•</span>
                      {material}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'dimensions' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)] font-['Shabnam'] mb-4">
                مشخصات فنی
              </h3>
              <div className="grid gap-3">
                {[
                  { label: 'ابعاد', value: product.dimensions },
                  { label: 'جنس', value: product.material },
                  { label: 'وزن', value: product.weight },
                  { label: 'دسته‌بندی', value: product.category },
                  { label: 'نوع', value: product.type },
                  product.seatingCapacity && { label: 'ظرفیت نشستن', value: product.seatingCapacity },
                  product.shelves && { label: 'تعداد قفسه', value: product.shelves }
                ].filter(Boolean).map((spec) => (
                  <div
                    key={spec!.label}
                    className="flex justify-between items-center p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-[var(--gold-primary)] font-semibold font-['Shabnam']">
                      {spec!.label}:
                    </span>
                    <span className="text-[var(--text-primary)] font-['Shabnam']">
                      {spec!.value || 'موجود نیست'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AR Button */}
        {onViewAR && (
          <div className="p-6 border-t border-white/10">
            <button
              onClick={onViewAR}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-warm)]
                       text-black font-bold text-lg font-['Shabnam']
                       hover:shadow-lg hover:shadow-[var(--gold-primary)]/30
                       transition-all duration-300 hover:scale-[1.02]"
            >
              مشاهده در واقعیت افزوده
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
}
