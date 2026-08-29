'use client'

import type { PresentationConfig } from '@/lib/product/presentation'

const DEFAULTS = { key: 120, fill: 45, rim: 60, bounce: 6, ambient: 0.35 }

/**
 * Three-point studio rig, forked from CarLighting.
 *
 * Every `castShadow` and `shadow-*` prop is deliberately absent: this page
 * renders with no shadow maps at all. A shadow pass re-renders the scene from
 * the *light's* frustum, which ignores camera culling — dropping it is the
 * single biggest saving from the trimmed, front-facing-only room.
 */
export default function PresentationLighting({ config }: { config: PresentationConfig }) {
  const l = { ...DEFAULTS, ...config.lighting }

  return (
    <>
      {/* Key — main illumination, front-right */}
      <spotLight position={[5, 8, 5]} intensity={l.key} angle={0.5} penumbra={0.5} />

      {/* Fill — opens the shaded side */}
      <spotLight position={[-5, 5, 3]} intensity={l.fill} angle={0.6} penumbra={0.7} />

      {/* Rim — cool edge separation from the backdrop */}
      <spotLight position={[0, 4, -6]} intensity={l.rim} angle={0.4} penumbra={0.6} color="#88aaff" />

      {/* Floor bounce — sits low and in front so it throws warm light back up
          into the underside, which is what keeps the piece grounded now that
          contact shadows are gone. Not inside the piece: at furniture scale a
          lamp at seat height blows the surrounding floor out to white. */}
      <pointLight position={[0, -0.25, 1.1]} intensity={l.bounce} distance={4} decay={2} color="#ffeedd" />

      <ambientLight intensity={l.ambient} />
    </>
  )
}
