'use client'

import Link from 'next/link'
import { ChevronRight, Heart } from 'lucide-react'
import { useShop } from '@/stores/storeShopStore'

interface Props {
  productName: string
  /** Catalogue id — likes and the cart are keyed on those, not the scene key. */
  catalogId: string | null
}

export default function PresentationTopBar({ productName, catalogId }: Props) {
  const liked = useShop((s) => s.liked)
  const toggleLike = useShop((s) => s.toggleLike)
  const isLiked = !!catalogId && liked.includes(catalogId)

  return (
    <div
      dir="rtl"
      className="font-persian pointer-events-none fixed inset-x-0 top-0 z-[100] flex items-center
                 justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <Link
        href="/store"
        aria-label="بازگشت به شوروم"
        className="glass pointer-events-auto flex h-10 items-center gap-1.5 rounded-full px-3
                   text-[13px] text-[var(--text-primary)] transition-colors
                   hover:text-[var(--gold-primary)]"
      >
        <ChevronRight className="h-4 w-4" />
        شوروم
      </Link>

      <span
        className="glass pointer-events-none max-w-[45%] truncate rounded-full px-4 py-2
                   text-[12px] text-[var(--text-secondary)]"
      >
        {productName}
      </span>

      {catalogId ? (
        <button
          onClick={() => toggleLike(catalogId)}
          aria-label={isLiked ? 'حذف از علاقه‌مندی' : 'افزودن به علاقه‌مندی'}
          aria-pressed={isLiked}
          className="glass pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full
                     text-[var(--text-secondary)] transition-colors hover:text-[var(--gold-primary)]"
        >
          <Heart className={`h-4 w-4 ${isLiked ? 'fill-[var(--gold-primary)] text-[var(--gold-primary)]' : ''}`} />
        </button>
      ) : (
        <span className="h-10 w-10" aria-hidden />
      )}
    </div>
  )
}
