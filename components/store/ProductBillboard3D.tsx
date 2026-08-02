'use client'

import { Billboard, Text, RoundedBox } from '@react-three/drei'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

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
  onViewAR?: () => void
}

export default function ProductBillboard3D({ product, onClose, onViewAR }: ProductBillboard3DProps) {
  const router = useRouter()
  const groupRef = useRef<THREE.Group>(null)
  const arButtonRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  // Animate AR button glow
  useFrame((state) => {
    if (arButtonRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.075 + 0.225
      arButtonRef.current.scale.setScalar(hovered ? 1.05 : 1)
      // @ts-ignore
      arButtonRef.current.children[0].material.emissiveIntensity = pulse
    }
  })

  if (!product) return null

  const handleViewInAR = () => {
    onViewAR?.()
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
        {/* Shadow layer */}
        <RoundedBox args={[4.1, 4.6, 0.02]} radius={0.17} position={[0.05, -0.05, -0.12]}>
          <meshBasicMaterial color="#05080e" opacity={0.1} transparent />
        </RoundedBox>

        {/* Outer border glow */}
        <RoundedBox args={[4.08, 4.58, 0.06]} radius={0.16} position={[0, 0, -0.07]}>
          <meshStandardMaterial
            color="#1f2d45"
            metalness={0.5}
            roughness={0.6}
            opacity={0.4}
            transparent
            emissive="#1f2d45"
            emissiveIntensity={0.2}
          />
        </RoundedBox>

        {/* Inner border */}
        <RoundedBox args={[4.04, 4.54, 0.06]} radius={0.15} position={[0, 0, -0.06]}>
          <meshStandardMaterial
            color="#172236"
            metalness={0.6}
            roughness={0.5}
            opacity={0.5}
            transparent
          />
        </RoundedBox>

        {/* Glass background panel with gradient effect */}
        <RoundedBox args={[4, 4.5, 0.08]} radius={0.15} position={[0, 0, -0.05]}>
          <meshPhysicalMaterial
            color="#0a1120"
            metalness={0.8}
            roughness={0.7}
            opacity={0.95}
            transparent
            clearcoat={0.4}
            clearcoatRoughness={0.3}
            transmission={0.05}
            thickness={0.5}
          />
        </RoundedBox>

        {/* Corner accents */}
        {[
          [-1.85, 2.1],
          [1.85, 2.1],
          [-1.85, -2.1],
          [1.85, -2.1],
        ].map(([x, y], i) => (
          <mesh key={i} position={[x, y, 0.01]}>
            <boxGeometry args={[0.15, 0.15, 0.02]} />
            <meshStandardMaterial color="#05080e" metalness={0.9} roughness={0.4} />
          </mesh>
        ))}

        {/* Depth lines (sides) */}
        <mesh position={[-1.95, 0, 0]}>
          <planeGeometry args={[0.02, 4.3]} />
          <meshBasicMaterial color="#101a2c" opacity={0.6} transparent />
        </mesh>
        <mesh position={[1.95, 0, 0]}>
          <planeGeometry args={[0.02, 4.3]} />
          <meshBasicMaterial color="#101a2c" opacity={0.6} transparent />
        </mesh>

        {/* Close button */}
        <group position={[1.7, 2.15, 0.1]} onClick={onClose}>
          <RoundedBox args={[0.35, 0.35, 0.05]} radius={0.08}>
            <meshPhysicalMaterial
              color="#101a2c"
              metalness={0.3}
              roughness={0.6}
              clearcoat={0.2}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.03]}
            fontSize={0.22}
          color="#ffffff"
            anchorX="center"
            anchorY="middle"
            font="/fonts/baloo/BalooBhaijaan2-VariableFont_wght.ttf"
          >
            ×
          </Text>
        </group>

        {/* Title */}
        <Text
          position={[0, 1.6, 0]}
          fontSize={0.32}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={3.5}
          textAlign="center"
          // letterSpacing={0.08}
          font="/fonts/shabnam/Shabnam-Bold-FD.ttf"
          // font="/fonts/baloo/BalooBhaijaan2-VariableFont_wght.ttf"
        >
          {product.name}
        </Text>

        {/* Title glow effect */}
        <Text
          position={[0, 1.6, -0.01]}
          fontSize={0.32}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          maxWidth={3.5}
          textAlign="center"
          // letterSpacing={0.08}
          fillOpacity={0.1}
          font="/fonts/shabnam/Shabnam-Bold-FD.ttf"
        >
          {product.name}
        </Text>

        {/* Divider line */}
        <mesh position={[0, 1.3, 0]}>
          <planeGeometry args={[3, 0.015]} />
          <meshBasicMaterial color="#1f2d45" opacity={0.6} transparent />
        </mesh>

        {/* Specs - right column (RTL) */}
        <Text
          position={[1.7, 1.0, 0]}
          fontSize={0.13}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
          maxWidth={1.5}
          lineHeight={1.8}
          // letterSpacing={0.08}
          fillOpacity={0.7}
          font="/fonts/shabnam/Shabnam-Bold-FD.ttf"
        >
          {'ابعاد\nجنس\nوزن'}
        </Text>

        <Text
          position={[0.2, 1.0, 0]}
          fontSize={0.13}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
          maxWidth={1.8}
          lineHeight={1.8}
          // letterSpacing={0.08}
          font="/fonts/baloo/BalooBhaijaan2-VariableFont_wght.ttf"
        >
          {`${product.dimensions || 'موجود نیست'}\n${product.material || 'موجود نیست'}\n${product.weight || 'موجود نیست'}`}
        </Text>

        {/* Specs - second section (RTL) */}
        <Text
          position={[1.7, 0.0, 0]}
          fontSize={0.13}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
          maxWidth={1.5}
          lineHeight={1.8}
          // letterSpacing={0.08}
          fillOpacity={0.7}
          font="/fonts/shabnam/Shabnam-Bold-FD.ttf"
        >
          {product.seatingCapacity ? 'ظرفیت نشستن\nدسته‌بندی\nنوع' : product.shelves ? 'تعداد قفسه\nدسته‌بندی\nنوع' : 'دسته‌بندی\nنوع\nرنگ‌ها'}
        </Text>

        <Text
          position={[0.2, 0.0, 0]}
          fontSize={0.13}
          color="#ffffff"
          anchorX="right"
          anchorY="top"
          maxWidth={1.8}
          lineHeight={1.8}
          // letterSpacing={0.08}
          font="/fonts/baloo/BalooBhaijaan2-VariableFont_wght.ttf"
        >
          {product.seatingCapacity
            ? `${product.seatingCapacity}\n${product.category || 'موجود نیست'}\n${product.type || 'موجود نیست'}`
            : product.shelves
            ? `${product.shelves}\n${product.category || 'موجود نیست'}\n${product.type || 'موجود نیست'}`
            : `${product.category || 'موجود نیست'}\n${product.type || 'موجود نیست'}\n${product.colors?.length || 0} گزینه`}
        </Text>

        {/* View in AR button */}
        <group
          ref={arButtonRef}
          position={[0, -1.6, 0.1]}
          onClick={handleViewInAR}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <RoundedBox args={[3, 0.55, 0.1]} radius={0.12}>
            <meshPhysicalMaterial
              color="#172236"
              metalness={0.7}
              roughness={0.4}
              clearcoat={0.4}
              emissive="#101a2c"
              emissiveIntensity={0.225}
              transmission={0.03}
              thickness={0.3}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.19}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            // letterSpacing={0.1}
            fontWeight={700}
          font="/fonts/shabnam/Shabnam-Bold-FD.ttf"
          >
            مشاهده در واقعیت افزوده
          </Text>
        </group>
      </group>
    </Billboard>
  )
}
