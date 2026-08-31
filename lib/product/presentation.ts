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

/** What stands behind the piece: a photograph, or a modelled room. */
export type RoomMode = 'image' | 'model' | 'none'

export interface PresentationRoom {
  /**
   * Which backdrop to render. Both `image` and `path` can be filled in at once
   * and this is the switch between them — flipping a product from a photograph
   * to a modelled room is a one-word edit. Omit it and whichever of the two is
   * present wins, image first.
   */
  mode?: 'image' | 'model'
  /** Backdrop GLB, used when `mode` is "model". */
  path?: string
  /** Backdrop photograph, used when `mode` is "image" — see PresentationBackdrop. */
  image?: string
  /** How far behind the piece the backdrop plane sits, in metres. Together with
   *  `imageOffsetY` this is how the photographed floor is lined up with the
   *  piece; there is no way to solve that in code. */
  imageDistance?: number
  /** Slides the backdrop photograph up/down, in metres. Raising it brings the
   *  photographed floor line up to meet the piece without moving the piece. */
  imageOffsetY?: number
  /**
   * Seat the room GLB's floor at `floorY`, instead of trusting its authored
   * origin. On by default, and the single most important knob here.
   *
   * `/store` does exactly this to every model it loads — ModelLoader sets
   * `clone.position.y = -box.min.y` — and so does the furniture on this page
   * (FurnitureStack's `centerOffset`). The room was the one thing rendered at
   * whatever origin Blender happened to export, so a GLB whose origin sits at
   * its geometric centre, or at a corner, lands metres away from where the
   * camera is looking. That camera is solved from the *piece's* bounds and
   * cannot walk out of trouble the way /store's player can, so it ends up
   * inside a wall or above the roof and the screen goes black.
   */
  alignFloor?: boolean
  /** Moves the room GLB after `alignFloor`, in metres. For the horizontal
   *  placement floor-alignment cannot solve — a room modelled off to one side. */
  offset?: [number, number, number]
  /** Uniform scale on the room GLB, for a model exported in the wrong unit. */
  scale?: number
  /**
   * Render every room mesh from both sides.
   *
   * The escape hatch for a room authored to be seen from outside: with the
   * camera indoors, single-sided walls facing away are culled and the room is
   * invisible or half-there. `/store` applies a narrower version of this to
   * ceiling meshes, which is kept unconditionally.
   */
  doubleSide?: boolean
  hdr?: string
  envIntensity?: number
  /**
   * The world height the model is seated at. Note this will **not** visually
   * move the piece: the camera frames on the piece's measured centre, so it
   * follows `floorY` and the piece stays put on screen. Use `pieceOffsetY`.
   */
  floorY?: number
  /**
   * Moves the piece up (positive) or down on screen, in metres.
   *
   * Deliberately excluded from the camera's framing, which is the whole point —
   * this is the dial for landing the piece on the photographed floor. Push it
   * down too far and it goes behind the bottom sheet; raising `imageOffsetY`
   * instead brings the floor line up to the piece and keeps that clearance.
   */
  pieceOffsetY?: number
  /** Strip every reflection: no IBL, `envMapIntensity` 0, `clearcoat` 0.
   *  On by default — the HDR was tinting the colours the user picks. */
  matte?: boolean
}

/**
 * Room-scale accent lighting, for when the backdrop is a modelled room.
 *
 * The studio rig is authored in absolute metres around a piece at the origin —
 * fixtures at 5–8m with `decay: 2`, in cones under 35° wide. That lights a sofa
 * in a void perfectly and leaves a room almost entirely unlit: anything outside
 * those cones sees only ambient, and inverse-square drops what does reach the
 * walls to nothing. So every value here is a *multiplier* on a rig solved from
 * the room's measured bounds, never a distance — a 3m room and a 9m one both
 * come out lit without re-tuning by hand.
 */
export interface GalleryLighting {
  /** Defaults to on whenever the backdrop is a modelled room. */
  enabled?: boolean
  /** Ceiling track fixtures. Each one is a real light in every material's
   *  shader loop, so this is capped at 6 and 3 is usually plenty. */
  spots?: number
  /** Multiplier on the solved track intensity. 0 turns the track off. */
  track?: number
  /** Multiplier on the back-wall wash. 0 turns it off. */
  wash?: number
  /** Cone half-angle of a track fixture, radians. Wider = flatter, softer. */
  angle?: number
  /** Fixture colour. Gallery track is warm white by convention. */
  color?: string
}

export interface ResolvedGallery {
  enabled: boolean
  spots: number
  track: number
  wash: number
  angle: number
  color: string
}

/** Gallery rig settings with every default filled in. */
export function galleryLighting(config: PresentationConfig): ResolvedGallery {
  const g = config.lighting?.gallery ?? {}
  return {
    enabled: g.enabled ?? roomMode(config) === 'model',
    spots: Math.max(0, Math.min(Math.round(g.spots ?? 3), 6)),
    track: g.track ?? 1,
    wash: g.wash ?? 1,
    angle: g.angle ?? 0.6,
    color: g.color ?? '#fff2df',
  }
}

export interface PresentationConfig {
  room: PresentationRoom
  /** `soft` is optional: a product can ship as frame + cover alone. */
  layers: { frame: LayerMeta; soft?: LayerMeta; cover: CoverLayerMeta }
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
  lighting?: {
    key: number
    fill: number
    rim: number
    bounce: number
    ambient: number
    hemi?: number
    gallery?: GalleryLighting
  }
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

/**
 * The surface character a cover variant imposes on the `cover` zone.
 *
 * One source of truth: the paint store, CoverLayer and the AR export all have
 * to agree, and they did not — the store kept the *default* variant's
 * roughness after a swap, so useZonePaint damped velvet straight back to
 * leather's 0.45 and the wool read as leather.
 */
export function coverSurface(
  config: PresentationConfig,
  variant: CoverVariant | null
): { roughness: number; metalness: number; clearcoat: number } {
  return {
    roughness: variant?.material?.roughness ?? 0.6,
    metalness: variant?.material?.metalness ?? 0,
    clearcoat: isMatte(config) ? 0 : variant?.material?.clearcoat ?? 0,
  }
}

/** Whether reflections are stripped for this product. Defaults to on. */
export function isMatte(config: PresentationConfig): boolean {
  return config.room.matte !== false
}

/**
 * Whether the scene needs an HDR environment loaded.
 *
 * Matte does not mean "no environment": it means the furniture takes none, and
 * that is enforced per-material. A modelled room is authored to be lit by an
 * environment, so it needs one whether or not the furniture is matte.
 */
export function needsEnvironment(config: PresentationConfig): boolean {
  return !!config.room.hdr && (!isMatte(config) || roomMode(config) === 'model')
}

/**
 * The backdrop actually in play.
 *
 * An explicit `mode` wins, but only if that mode's asset is configured — a
 * `mode: "model"` with no `path` falls back rather than rendering nothing, so a
 * half-finished manifest still shows the piece.
 */
export function roomMode(config: PresentationConfig): RoomMode {
  const { mode, image, path } = config.room
  if (mode === 'image' && image) return 'image'
  if (mode === 'model' && path) return 'model'
  if (image) return 'image'
  if (path) return 'model'
  return 'none'
}

/** Every asset the page needs before it can render anything meaningful. The
 *  backdrop is whichever of image/GLB this product actually uses. */
export function requiredAssets(config: PresentationConfig): string[] {
  const cover = findCoverVariant(config, config.layers.cover.default)
  const mode = roomMode(config)
  // Probe only the backdrop in use — an unused `path` left in the manifest for
  // easy switching must not block the page.
  const backdrop = mode === 'image' ? config.room.image : mode === 'model' ? config.room.path : undefined
  return [
    config.layers.frame.path,
    config.layers.soft?.path,
    cover?.path,
    backdrop,
    // The Environment has no error boundary of its own, so a missing HDR would
    // hang behind a Suspense fallback rather than say what is wrong.
    needsEnvironment(config) ? config.room.hdr : undefined,
  ].filter((p): p is string => !!p)
}
