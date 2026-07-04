'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import CustomizationPanel from '@/components/car/CustomizationPanel'
import { useCarConfig } from '@/stores/carConfigStore'

const CarTuningScene = dynamic(() => import('@/components/car/CarTuningScene'), {
  ssr: false,
})

interface Car {
  id: string
  name: string
  name_fa: string
  model_path: string
  specs: {
    engine: string
    horsepower: number
    torque: string
    top_speed: string
  }
}

export default function CarPage() {
  const params = useParams()
  const [car, setCar] = useState<Car | null>(null)
  const [loading, setLoading] = useState(true)
  const resetConfig = useCarConfig((s) => s.resetConfig)

  useEffect(() => {
    fetch('/config/cars.json')
      .then((res) => res.json())
      .then((cars: Car[]) => {
        const foundCar = cars.find((c) => c.id === params.id)
        setCar(foundCar || null)
        setLoading(false)

        // Initialize default parts (stock parts)
        if (foundCar) {
          resetConfig({
            wheels: 'wheel-stock',
            spoilers: 'spoiler-stock',
            hoods: 'hood-stock',
            bumpers: 'bumper-front-stock',
            mirrors: 'mirror-stock',
            exhaust: 'exhaust-stock',
            'side-skirts': 'skirts-none',
          })
        }
      })
      .catch((err) => {
        console.error('Failed to load car config:', err)
        setLoading(false)
      })
  }, [params.id, resetConfig])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    )
  }

  if (!car) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-black text-white">
        Car not found
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden relative">
      <CarTuningScene modelPath={car.model_path} />

      {/* Car Info Overlay */}
      <div className="absolute top-8 left-8 text-white pointer-events-none z-5">
        <h1 className="text-4xl font-bold mb-2">{car.name}</h1>
        <p className="text-xl text-gray-300">{car.name_fa}</p>
      </div>

      {/* Specs Overlay */}
      <div className="absolute bottom-8 left-8 text-white bg-black/50 p-6 rounded-lg backdrop-blur-sm z-5">
        <h2 className="text-xl font-bold mb-4">Specifications</h2>
        <div className="space-y-2 text-sm">
          <div>
            <span className="text-gray-400">Engine:</span> {car.specs.engine}
          </div>
          <div>
            <span className="text-gray-400">Power:</span> {car.specs.horsepower} HP
          </div>
          <div>
            <span className="text-gray-400">Torque:</span> {car.specs.torque}
          </div>
          <div>
            <span className="text-gray-400">Top Speed:</span> {car.specs.top_speed}
          </div>
        </div>
      </div>

      {/* Customization Panel */}
      <CustomizationPanel />
    </div>
  )
}
