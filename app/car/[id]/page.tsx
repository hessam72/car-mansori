import cars from '@/public/config/cars.json'
import CarPageClient, { type Car } from './CarPageClient'

export default function CarPage({ params }: { params: { id: string } }) {
  const car = ((cars as Car[]).find((c) => c.id === params.id) as Car) || null
  return <CarPageClient car={car} />
}
