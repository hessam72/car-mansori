'use client'

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePresentation } from '@/stores/presentationStore'

/**
 * `?debug=1` only.
 *
 * Two things this page is easy to get silently wrong:
 *  - a missing `invalidate()` guard leaves the demand loop pinned at 60fps,
 *    which looks identical on screen but drains a phone. The FPS line must
 *    read 0 whenever nothing is animating.
 *  - a layer that forgets to dispose its cloned materials leaks on every cover
 *    swap. The memory line must come back to the same numbers.
 */
export default function PresentationDiagnostics() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const frames = useRef(0)
  useFrame(() => {
    frames.current += 1
  })

  useEffect(() => {
    const report = () => {
      const stack = scene.getObjectByName('furniture-stack')
      const box = new THREE.Box3()
      if (stack) box.setFromObject(stack)
      const round = (v: THREE.Vector3) => v.toArray().map((n) => +n.toFixed(2))

      // Where the piece actually lands on screen, as a fraction from the top.
      // 0 = top edge, 1 = bottom. This is the number to check against how much
      // of the screen the bottom sheet is covering.
      const screenY = (x: number, y: number, z: number) =>
        +((1 - new THREE.Vector3(x, y, z).project(camera).y) / 2).toFixed(3)
      const c = box.getCenter(new THREE.Vector3())
      console.log(
        `[presentation] fps ${(frames.current / 2).toFixed(1)} · geometries ${gl.info.memory.geometries}` +
          ` · textures ${gl.info.memory.textures} · programs ${gl.info.programs?.length ?? 0}`
      )
      // The two numbers for landing the piece on the photographed floor without
      // pushing it behind the sheet: where its base sits on screen, and where
      // the sheet's top edge is. base < sheetTop means it is clear.
      const coverage = usePresentation.getState().sheetCoverage
      const base = screenY(c.x, box.min.y, c.z)
      const sheetTop = +(1 - coverage).toFixed(3)
      console.log(
        `[presentation] camera ${round(camera.position as THREE.Vector3).join('/')}` +
          ` · piece ${round(box.min).join('/')} → ${round(box.max).join('/')}` +
          ` · screenY top ${screenY(c.x, box.max.y, c.z)} base ${base}` +
          ` · sheetTop ${sheetTop}${base > sheetTop ? ' ⚠ base is behind the sheet' : ''}`
      )
      frames.current = 0
    }

    const interval = window.setInterval(report, 2000)
    return () => window.clearInterval(interval)
  }, [gl, scene, camera])

  return null
}
