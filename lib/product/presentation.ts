import presentationConfig from '@/public/config/furniture-presentation.json'
import productsConfig from '@/public/config/products.json'
import type { ProductData } from '@/components/store/ProductInteraction'

/** The three independently colourable parts of a piece. Unlike the showroom's
 *  keyword matching, the zone is implied by which layer GLB a mesh came from —
 *  only `soft` needs a name rule, to split cushions from the fixed fibre base. */
export type PresentationZone = 'wood' | 'cover' | 'cushion'

export interface ZoneSwatch {
  id: string
  name: string
  hex: string
  /** Wood tones carry their own roughness; fabric swatches inherit it from the cover variant */
  roughness?: number
}

export interface CoverVariant {
  id: string
  name: string
  path: string
  thumbnail?: string
  priceDelta?: number
  material?: { roughness?: number; metalness?: number; clearcoat?: number }
}

export interface LayerMeta {
  path: string
  label: string
  desc?: string
  /** Substring tested against mesh.name to pick the colourable subset of this layer */
  zoneMatch?: string
}

export interface CoverLayerMeta {
  label: string
  desc?: string
  default: string
  variants: CoverVariant[]
}

export interface PresentationConfig {
  room: { path: string; hdr: string; envIntensity?: number; floorY?: number }
  layers: { frame: LayerMeta; soft: LayerMeta; cover: CoverLayerMeta }
  palettes: Record<PresentationZone, ZoneSwatch[]>
  /**
   * Framing is expressed as angles and ratios, never absolute metres. The rig
   * derives the actual distance from the piece's measured bounds and the live
   * canvas aspect — a fixed distance frames a portrait phone and a desktop
   * window completely differently, because `fov` is vertical.
   */
  camera: {
    /** Orbit angle around Y, degrees. 0 looks straight at the front. */
    azimuthDeg: number
    /** Height angle above the piece's centre, degrees. */
    elevationDeg: number
    /** Vertical field of view. */
    fov: number
    near?: number
    far?: number
    /** Multiplier on the just-fits distance; >1 leaves breathing room. */
    padding?: number
    /** Dolly clamps, as multiples of the framed distance. */
    minZoom?: number
    maxZoom?: number
    /** Pushes the piece up-screen by this fraction of the *viewport height*,
     *  clearing the bottom sheet. Expressed against the viewport rather than
     *  the model so the same value frames a tall wardrobe and a low table
     *  alike. Implemented by aiming below the piece's centre. */
    screenLift?: number
  }
  lighting?: { key: number; fill: number; rim: number; bounce: number; ambient: number }
  explode?: { gap: number; durationMs: number }
  wipe?: { durationMs: number }
}

const CONFIGS = presentationConfig as unknown as Record<string, PresentationConfig>
const PRODUCTS = productsConfig as unknown as Record<string, ProductData>

/** Every product key that has a presentation entry — the SSG param source. */
export function presentationKeys(): string[] {
  return Object.keys(CONFIGS).filter((key) => key in PRODUCTS)
}

export function hasPresentation(key: string | null | undefined): boolean {
  return !!key && key in CONFIGS && key in PRODUCTS
}

export interface ResolvedPresentation {
  key: string
  product: ProductData
  config: PresentationConfig
}

/** Joins showroom catalogue metadata with the 3D presentation config. */
export function resolvePresentation(key: string): ResolvedPresentation | null {
  const config = CONFIGS[key]
  const product = PRODUCTS[key]
  if (!config || !product) return null
  return { key, product, config }
}

export function findCoverVariant(config: PresentationConfig, id: string | null): CoverVariant | null {
  if (!id) return null
  return config.layers.cover.variants.find((v) => v.id === id) ?? null
}

/** Base price plus the active cover's delta. */
export function totalPrice(product: ProductData, variant: CoverVariant | null): number {
  return (product.price ?? 0) + (variant?.priceDelta ?? 0)
}

/** Every GLB the page needs before it can render anything meaningful. */
export function requiredAssets(config: PresentationConfig): string[] {
  const cover = findCoverVariant(config, config.layers.cover.default)
  return [config.layers.frame.path, config.layers.soft.path, cover?.path, config.room.path].filter(
    (p): p is string => !!p
  )
}
