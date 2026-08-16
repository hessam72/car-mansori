/** Orthographic shadow-camera frustum for the window sun (world units) */
export type SunShadowConfig = {
  left: number
  right: number
  top: number
  bottom: number
  near: number
  far: number
  bias: number
  normalBias: number
}

/** drei SoftShadows (PCSS) parameters */
export type SoftShadowConfig = {
  /** Light-source size — larger = softer penumbra. NOT a world dimension. */
  size: number
  /** PCF samples — quality vs cost */
  samples: number
  /** Depth focus of the softening */
  focus: number
}

/** "Sun through a window" directional light + PCSS soft shadows */
export type SunConfig = {
  /** Master on/off for the whole sun + shadow feature */
  enabled: boolean
  position: [number, number, number]
  target: [number, number, number]
  intensity: number
  color: string
  soft: SoftShadowConfig
  shadow: SunShadowConfig
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

/** What a scene's JSON may specify — every field optional, merged over DEFAULT_SUN */
export type PartialSunConfig = DeepPartial<SunConfig>
