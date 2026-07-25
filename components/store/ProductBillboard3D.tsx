'use client'

import { Billboard, Text, RoundedBox } from '@react-three/drei'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import * as THREE from 'three'

interface ProductData {
  id: string
  name_fa: string
  engine: string
  horsepower: string
  torque: string
  acceleration: string
  topSpeed: string
  transmission: string
  billboardPosition: [number, number, number]
}

interface ProductBillboard3DProps {
  product: ProductData | null
  onClose: () => void
}

export default function ProductBillboard3D({ product, onClose }: ProductBillboard3DProps) {
  const router = useRouter()
  const groupRef = useRef<THREE.Group>(null)

  if (!product) return null

  const handleCustomize = () => {
    router.push('/car/sample-car')
  }

  return (
    <Billboard
      position={product.billboardPosition}
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      <group ref={groupRef}>
        {/* Background panel */}
        <RoundedBox args={[3.5, 4, 0.1]} radius={0.1} position={[0, 0, -0.05]}>
          <meshStandardMaterial color="#1a1a1a" opacity={0.95} transparent />
        </RoundedBox>

        {/* Border */}
        <RoundedBox args={[3.6, 4.1, 0.08]} radius={0.12} position={[0, 0, -0.06]}>
          <meshStandardMaterial color="#ff0000" opacity={0.8} transparent />
        </RoundedBox>

        {/* Close button */}
        <group position={[1.5, 1.8, 0.1]} onClick={onClose}>
          <RoundedBox args={[0.3, 0.3, 0.05]} radius={0.05}>
            <meshStandardMaterial color="#ff0000" />
          </RoundedBox>
          <Text
            position={[0, 0, 0.03]}
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            ×
          </Text>
        </group>

        {/* Title */}
        <Text
          position={[0, 1.6, 0]}
          fontSize={0.25}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={3}
          textAlign="center"
        >
          {product.name_fa}
        </Text>

        {/* Specs */}
        <Text
          position={[-1.5, 1.1, 0]}
          fontSize={0.15}
          color="#cccccc"
          anchorX="left"
          anchorY="top"
          maxWidth={3}
          lineHeight={1.4}
        >
          {`موتور: ${product.engine}\nقدرت: ${product.horsepower}\nگشتاور: ${product.torque}\nشتاب: ${product.acceleration}\nسرعت نهایی: ${product.topSpeed}\nگیربکس: ${product.transmission}`}
        </Text>

        {/* Customize button */}
        <group position={[0, -1.4, 0.1]} onClick={handleCustomize}>
          <RoundedBox args={[2.5, 0.5, 0.1]} radius={0.1}>
            <meshStandardMaterial color="#ff0000" />
          </RoundedBox>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            سفارشی‌سازی
          </Text>
        </group>
      </group>
    </Billboard>
  )
}
