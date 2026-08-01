'use client'

import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector2, Object3D, Vector3 } from 'three'

interface FurnitureColor {
  name: string
  hex: string
}

export interface ProductData {
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

interface ProductInteractionProps {
  onProductClick: (
    product: ProductData | null,
    position?: [number, number, number],
    clickedObject?: Object3D
  ) => void
}

export default function ProductInteraction({ onProductClick }: ProductInteractionProps) {
  const { camera, scene, gl } = useThree()
  const raycaster = useRef(new Raycaster())
  const pointer = useRef(new Vector2())
  const [products, setProducts] = useState<Record<string, ProductData>>({})

  // Load products config
  useEffect(() => {
    fetch('/config/products.json')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error('Failed to load products:', err))
  }, [])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Normalize pointer coordinates
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1

      // Update raycaster
      raycaster.current.setFromCamera(pointer.current, camera)

      // Find intersections
      const intersects = raycaster.current.intersectObjects(scene.children, true)

      if (intersects.length > 0) {
        // Get clicked object
        let targetObject: Object3D | null = intersects[0].object

        // Search up the hierarchy for a product name
        let foundProduct: ProductData | null = null
        while (targetObject && !foundProduct) {
          const objectName = targetObject.name.toLowerCase()

          // Check if this object matches any product
          for (const [productKey, productData] of Object.entries(products)) {
            if (objectName.includes(productKey.toLowerCase()) ||
                objectName.includes(productData.category)) {
              foundProduct = productData
              break
            }
          }

          targetObject = targetObject.parent
        }

        if (foundProduct) {
          // Get world position of the clicked object
          const worldPosition = new Vector3()
          intersects[0].object.getWorldPosition(worldPosition)
          const position: [number, number, number] = [
            worldPosition.x,
            worldPosition.y,
            worldPosition.z
          ]

          // Find the root object of the furniture (top-level parent before scene)
          let rootObject = intersects[0].object
          while (rootObject.parent && rootObject.parent.type !== 'Scene') {
            rootObject = rootObject.parent
          }

          onProductClick(foundProduct, position, rootObject)
        }
      }
    }

    gl.domElement.addEventListener('click', handleClick)
    return () => gl.domElement.removeEventListener('click', handleClick)
  }, [camera, scene, gl, products, onProductClick])

  return null
}
