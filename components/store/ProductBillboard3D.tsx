'use client'

import { Billboard, Text, RoundedBox } from '@react-three/drei'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import ARProductViewer from './ARProductViewer'

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
  glbPath?: string
  usdzPath?: string
  billboardPosition: [number, number, number]
}

interface ProductBillboard3DProps {
  product: ProductData | null
  onClose: () => void
}

export default function ProductBillboard3D({ product, onClose }: ProductBillboard3DProps) {
  const router = useRouter()
  const groupRef = useRef<THREE.Group>(null)
  const [showAR, setShowAR] = useState(false)

  if (!product) return null

  const handleViewInAR = () => {
    setShowAR(true)
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
        {/* Glass background panel */}
        <RoundedBox args={[4, 4.5, 0.08]} radius={0.15} position={[0, 0, -0.05]}>
          <meshPhysicalMaterial
            color="#0a0a0a"
            metalness={0.9}
            roughness={0.9}
            opacity={.9}
            transparent
            clearcoat={0.2}
            clearcoatRoughness={0.5}
          />
        </RoundedBox>

        {/* Subtle border accent */}
        <RoundedBox args={[4.05, 4.55, 0.06]} radius={0.16} position={[0, 0, -0.06]}>
          <meshStandardMaterial
            color="#d4af37"
            metalness={0.4}
            roughness={0.5}
            opacity={0.3}
            transparent
            emissive="#d4af37"
            emissiveIntensity={0.15}
          />
        </RoundedBox>

        {/* Close button */}
        <group position={[1.7, 2.05, 0.1]} onClick={onClose}>
          <RoundedBox args={[0.35, 0.35, 0.05]} radius={0.08}>
            <meshPhysicalMaterial
              color="#1a1a1a"
              metalness={0.2}
              roughness={0.7}
              clearcoat={0.1}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.03]}
            fontSize={0.22}
            color="#d4af37"
            anchorX="center"
            anchorY="middle"
          >
            ×
          </Text>
        </group>

        {/* Title */}
        <Text
          position={[0, 1.8, 0]}
          fontSize={0.28}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={3.5}
          textAlign="center"
          letterSpacing={0.05}
        >
          {product.name}
        </Text>

        {/* Divider line */}
        <mesh position={[0, 1.5, 0]}>
          <planeGeometry args={[3, 0.01]} />
          <meshBasicMaterial color="#d4af37" opacity={0.4} transparent />
        </mesh>

        {/* Specs - left column */}
        <Text
          position={[-1.7, 1.15, 0]}
          fontSize={0.13}
          color="#999999"
          anchorX="left"
          anchorY="top"
          maxWidth={1.5}
          lineHeight={1.6}
        >
          {'DIMENSIONS\nMATERIAL\nWEIGHT'}
        </Text>

        <Text
          position={[-0.2, 1.15, 0]}
          fontSize={0.13}
          color="#ffffff"
          anchorX="left"
          anchorY="top"
          maxWidth={1.8}
          lineHeight={1.6}
        >
          {`${product.dimensions || 'N/A'}\n${product.material || 'N/A'}\n${product.weight || 'N/A'}`}
        </Text>

        {/* Specs - right section */}
        <Text
          position={[-1.7, 0.2, 0]}
          fontSize={0.13}
          color="#999999"
          anchorX="left"
          anchorY="top"
          maxWidth={1.5}
          lineHeight={1.6}
        >
          {product.seatingCapacity ? 'SEATING\nCATEGORY\nTYPE' : product.shelves ? 'SHELVES\nCATEGORY\nTYPE' : 'CATEGORY\nTYPE\nCOLORS'}
        </Text>

        <Text
          position={[-0.2, 0.2, 0]}
          fontSize={0.13}
          color="#ffffff"
          anchorX="left"
          anchorY="top"
          maxWidth={1.8}
          lineHeight={1.6}
        >
          {product.seatingCapacity
            ? `${product.seatingCapacity}\n${product.category || 'N/A'}\n${product.type || 'N/A'}`
            : product.shelves
            ? `${product.shelves}\n${product.category || 'N/A'}\n${product.type || 'N/A'}`
            : `${product.category || 'N/A'}\n${product.type || 'N/A'}\n${product.colors?.length || 0} options`}
        </Text>

        {/* View in AR button */}
        <group position={[0, -1.6, 0.1]} onClick={handleViewInAR}>
          <RoundedBox args={[3, 0.55, 0.1]} radius={0.12}>
            <meshPhysicalMaterial
              color="#d4af37"
              metalness={0.9}
              roughness={0.3}
              clearcoat={0.3}
              emissive="#d4af37"
              emissiveIntensity={0.25}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.18}
            color="#0a0a0a"
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.1}
            fontWeight={700}
          >
            VIEW IN AR
          </Text>
        </group>
      </group>

      {/* AR Product Viewer */}
      {showAR && product.glbPath && (
        <ARProductViewer
          glbPath={product.glbPath}
          usdzPath={product.usdzPath}
          productName={product.name}
          onClose={() => setShowAR(false)}
        />
      )}
    </Billboard>
  )
}
