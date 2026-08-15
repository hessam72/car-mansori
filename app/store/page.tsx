'use client'
import dynamic from 'next/dynamic'
import { QualityProvider } from '@/contexts/QualityContext'

const StoreScene = dynamic(() => import('@/components/store/Scene'), {
  ssr: false,
})

export default function StorePage() {
  return (
    // Same provider (and persisted tier) as /car — one quality choice
    // drives both 3D experiences
    <QualityProvider>
      {/* The root layout is lang="fa" dir="rtl" for the Persian landing/about
          pages; the showroom is English, so it flips direction on its own subtree */}
      <div dir="ltr" lang="en" className="h-screen w-screen overflow-hidden">
        <StoreScene />
      </div>
    </QualityProvider>
  )
}
