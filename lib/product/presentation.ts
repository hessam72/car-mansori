import presentationConfig from '@/public/config/furniture-presentation.json'
import productsConfig from '@/public/config/products.json'
import type { ProductData } from '@/components/store/ProductInteraction'
import type { PartialSun } from '@/components/store/hooks/useStoreConfig'

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
  /**
   * Moves the room GLB after `alignFloor`, in metres. For the horizontal
   * placement floor-alignment cannot solve — a room modelled off to one side.
   *
   * Also **where the piece stands in the room**, which is why there is no
   * horizontal offset on the piece itself. The camera aims at the piece's
   * measured centre, which the framing puts at the origin, and the spin turns
   * about the piece's own axes through that same point; slide the piece off it
   * and it sits off the optical axis, where perspective swings its near and far
   * ends across the frame as it turns — rotation in place reads as an orbit.
   * A positive Z here slides the room towards the camera instead, leaving the
   * piece deeper inside it and the geometry that governs the spin untouched.
   */
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
  /**
   * Which lighting model the room is rendered under.
   *
   * `"store"` reproduces /store's setup exactly — ACES Filmic at exposure 0.3,
   * a plain HDR environment at 0.8, and its single overhead point light — and
   * drops the studio rig. Use it for any GLB that was authored and checked in
   * the store scene, which is lit entirely by that environment: under the
   * studio rig such a room has nothing to reflect and renders black.
   *
   * `"studio"` (the default) is this page's own booth rig, tuned for a piece of
   * furniture against a photograph rather than a room.
   */
  lightingMode?: RoomLighting
}

/** @see PresentationRoom.lightingMode */
export type RoomLighting = 'studio' | 'store'

/** /store's renderer settings, reproduced verbatim from Scene.tsx's Canvas. */
export const STORE_RENDER = {
  exposure: 0.3,
  envIntensity: 0.8,
  /** The vitrine point light: `[0,10,-1.5]`, intensity 5, distance 20, decay .7 */
  point: { position: [0, 10, -1.5] as [number, number, number], intensity: 5, distance: 20, decay: 0.7 },
} as const

/** Whether this product draws the sun and, with it, the page's only shadow map. */
export function sunEnabled(config: PresentationConfig): boolean {
  return config.sun?.enabled === true
}

/** Code-side fallback, so a manifest names only what it wants to change.
 *  Tuned for a lit room rather than /store's dark salon: a sheen you can see
 *  the tiles through, not a mirror. */
export const DEFAULT_FLOOR: PresentationFloorConfig = {
  enabled: false,
  opacity: 0.35,
  blend: 'normal',
  offsetY: 0.004,
  mixStrength: 1,
  mixBlur: 1.4,
  mixContrast: 1,
  roughness: 0.6,
  metalness: 0.4,
  depthScale: 1.2,
  minDepthThreshold: 0.2,
  maxDepthThreshold: 1.4,
  color: '#ffffff',
}

/** Floor settings with every default filled in. */
export function floorReflection(config: PresentationConfig): PresentationFloorConfig {
  return { ...DEFAULT_FLOOR, ...config.floor }
}

export function lightingMode(config: PresentationConfig): RoomLighting {
  return config.room.lightingMode ?? 'studio'
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

/**
 * A semi-transparent planar reflection laid *over* the room's own floor.
 *
 * /store's ReflectiveFloor is an opaque plane carrying its own concrete texture
 * — it replaces the floor. Here the room GLB already has a floor worth looking
 * at, so only the reflection is ported: the same drei planar reflector (a
 * mirrored virtual camera into an FBO, obliquely clipped at the plane), on a
 * transparent plane a couple of millimetres above the real one, with no `map`
 * of its own. The floor's texture reads through the gaps in the reflection
 * rather than being covered over.
 */
export interface PresentationFloorConfig {
  enabled: boolean
  /**
   * How much of the reflection layer survives the blend, 0..1. This is the
   * whole point of the feature: at 1 the floor is a mirror and its texture is
   * gone, at 0.3 the texture is still what you read and the reflection is a
   * sheen over it.
   */
  opacity: number
  /**
   * `normal` alpha-blends the reflection over the floor — dark reflections
   * darken it, which is what a polished surface does as it turns mirror-like.
   *
   * `additive` only ever adds reflected light. Nothing darkens, so the floor's
   * texture survives at any opacity; the trade is that a bright reflection can
   * blow out. The better choice over a dark floor.
   */
  blend: 'normal' | 'additive'
  /** Plane size in metres. Omitted → the room's own XZ footprint. */
  size?: number
  /** Clearance over `room.floorY`. Enough to beat depth precision, small enough
   *  not to read as a sheet of glass hovering over the floor. */
  offsetY: number
  /** Strength of the reflection in the layer, before `opacity`. */
  mixStrength: number
  /** Roughness-driven blur of the reflection. 0 is a hard mirror. */
  mixBlur: number
  /** Contrast pushed through the reflection. Above 1 deepens it. */
  mixContrast: number
  /** Higher = blurrier reflection, since `mixBlur` is scaled by it. */
  roughness: number
  metalness: number
  /** Fades the reflection with distance from the reflected surface, so a piece
   *  reflects hard at the feet and dissolves further out. 0 disables. */
  depthScale: number
  minDepthThreshold: number
  maxDepthThreshold: number
  color: string
}

export interface PresentationConfig {
  room: PresentationRoom
  /** `soft` is optional: a product can ship as frame + cover alone.
   *  `startStep` is the layer the page opens on — 1, the finished piece, unless
   *  set to 0 to open on the bare frame. */
  layers: { frame: LayerMeta; soft?: LayerMeta; cover: CoverLayerMeta; startStep?: 0 | 1 }
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
    /**
     * Where the dolly opens, as a fraction of how far back it can go — 0.9 to
     * start at 90% of the way out. Omit to open at the framed distance.
     *
     * A fraction of the *achievable* limit, not of `maxZoom`: a modelled room's
     * wall can cut the range short, and 90% of a distance the room never allows
     * would be a different shot on every product.
     */
    startZoom?: number
    /** How far a vertical drag can tip the piece, ±degrees. 36 is a tenth of a
     *  full turn — enough to show the seat and the underside, short of tumbling. */
    tiltLimitDeg?: number
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
  /**
   * Window sunlight and its PCSS soft shadow — /store's `sun` block, verbatim,
   * so a `?sundebug=1` printout pastes straight in.
   *
   * Absent, or `enabled: false`, and the page renders with no shadow maps at
   * all, which is what it did before this existed and still the right default:
   * a shadow pass re-renders the scene from the *light's* frustum and so
   * ignores the camera culling the trimmed, front-facing-only room is built
   * around. Turn it on for a room that actually has a window worth the cost.
   *
   * Only `shadow` differs from /store in how it is read: leave the four
   * bounds out and the frustum is fitted to the measured room every time it
   * loads, instead of being hand-tuned per product. @see PresentationSun.
   */
  sun?: PartialSun
  /** Semi-transparent reflection over the room's floor. Absent → off, and no
   *  reflection pass runs. @see PresentationFloor */
  floor?: Partial<PresentationFloorConfig>
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

/**
 * Whether reflections are stripped for this product. Defaults to on.
 *
 * Except under store lighting, where the environment is the only real light in
 * the scene: zeroing `envMapIntensity` there does not make the upholstery matte,
 * it makes it unlit. Store mode therefore requires matte to be asked for.
 */
export function isMatte(config: PresentationConfig): boolean {
  if (lightingMode(config) === 'store') return config.room.matte === true
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
  if (!config.room.hdr) return false
  // Store mode *is* the environment — it has no other fill light worth the name.
  if (lightingMode(config) === 'store') return true
  return !isMatte(config) || roomMode(config) === 'model'
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
