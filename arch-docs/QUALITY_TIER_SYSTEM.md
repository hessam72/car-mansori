# Quality Tier System

Dynamic graphics quality management for the /car page with user-selectable presets (Low/Medium/High/Ultra), plus the rendering-quality subsystems each tier drives.

---

## Overview

**Location:** `/car/[id]` route
**Config:** `lib/config/quality.ts`
**Context:** `contexts/QualityContext.tsx`
**UI:** `components/car/QualitySelector.tsx` (top-right overlay)
**Persistence:** localStorage (`car-quality-preset`, `car-experimental-ssgi`)
**Default:** Medium preset

Stack: three 0.170 · @react-three/fiber 8 · drei 9.122 · @react-three/postprocessing 2.19 · realism-effects 1.1.2 · three-gpu-pathtracer 0.0.23

> three version note: realism-effects relies on `WebGLMultipleRenderTargets`, which was removed in three r172 — keep three ≤ 0.171 while the experimental SSGI mode exists.

---

## Quality Settings Interface

```ts
interface QualitySettings {
  dpr: [number, number]              // Device pixel ratio [min, max]
  adaptiveDpr: boolean               // Drop DPR during camera movement
  shadowResolution: number           // Spotlight self-shadow map size
  floorReflectionResolution: number  // MeshReflector render target
  multisampling: number              // MSAA samples inside EffectComposer
  enableSMAA: boolean                // Edge AA (composer bypasses canvas AA!)
  enableN8AO: boolean                // Ambient occlusion effect
  n8aoQuality: 'performance' | 'medium' | 'high'
  anisotropyLevel: number            // Texture anisotropy — always applied
  groundShadows: 'contact' | 'accumulative'
  groundShadowResolution: number
  envResolution: number              // Studio environment cubemap size
  envIntensity: number               // scene.environmentIntensity / envMapIntensity
  cubeReflections: boolean           // True reflections via one-shot CubeCamera
  cubeReflectionResolution: number
  experimentalSSGI: boolean          // Gates the SSGI/TRAA opt-in toggle
}
```

## Presets (summary)

| Setting | Low | Medium | High | Ultra |
|---|---|---|---|---|
| dpr | 0.5–1 (adaptive) | 1–1.5 (adaptive) | 1–1.75 | 1–2 |
| AA | SMAA | MSAA 4 | MSAA 4 + SMAA | MSAA 4 + SMAA |
| Shadow map | 512 | 1024 | 2048 | 2048 |
| Floor reflection | 128 | 512 | 1024 | 2048 |
| Ground shadows | contact 256 | contact 512 | accumulative 1024 | accumulative 1024 |
| N8AO | – | – | medium | high |
| Anisotropy | 4 | 4 | 8 | 16 |
| Env resolution | 256 | 512 | 1024 | 1024 |
| Cube reflections | – | – | 256 | 512 |
| SSGI toggle offered | – | – | – | ✓ (off by default) |

Exact values: [lib/config/quality.ts](../lib/config/quality.ts)

---

## Rendering subsystems

### Anti-aliasing — `components/store/PostProcessing.tsx`
The EffectComposer renders offscreen, so canvas `antialias` never applies; AA must come from composer MSAA (`multisampling`) and/or SMAA. Every tier now has AA.

### Studio environment — `components/car/CarStudioEnvironment.tsx`
`<Environment files resolution frames={1}>` renders the EXR base plus a Lightformer rig (overhead strips, side softboxes, rim/front cards, dome ring) into one cubemap, once. `environmentIntensity` maps to `scene.environmentIntensity` (r163+). Rotate the rig via its group to aim highlights.

### Ground shadows — `components/car/CarGroundShadows.tsx`
Low/Medium: drei ContactShadows. High/Ultra: AccumulativeShadows + RandomizedLight, baked over ~45 frames (demand-loop safe), re-baked after part swaps (~0.9s delay) and door animations (~1.4s delay). Wrapped in `userData.photoModeHide` so photo mode can hide the raster catchers.

### Material prep — `lib/three/prepareCarMaterial.ts`
Single source of truth for envMapIntensity + anisotropy + shadow flags; applied to the base car (`ConfigurableCar`) and every DynamicPart clone so swapped parts match the body. DynamicPart materials return to opaque (`transparent=false, depthWrite=true`) after fades.

### True reflections — `lib/three/useCubeReflections.ts` (High/Ultra)
One-shot CubeCamera capture (car hidden, `scene.background = scene.environment`) applied as a real `envMap` to car materials; `needsPMREMUpdate` refreshes PMREM. Captures are **frame-counted** (≈60 rendered frames after trigger) so they always land after the shadow bake finishes on any GPU speed. Re-captures on part/door changes only — paint recolors never need one.

### Tone mapping — `components/car/CarTuningScene.tsx`
`NeutralToneMapping` (Khronos PBR Neutral): brand-accurate paint hues. AgX constant kept nearby for look-dev.

### Photo mode — `components/car/PhotoMode.tsx` + `PhotoModeUI.tsx` (desktop)
three-gpu-pathtracer progressive render; r3f frameloop frozen (`never`) while active; save-to-PNG reads canvas in-tick. Max 250 samples.

### Experimental SSGI/TRAA — `components/store/PostProcessing.tsx` (Ultra, opt-in)
realism-effects `VelocityDepthNormalPass + SSGIEffect + TRAAEffect` replaces N8AO/SMAA/MSAA. Temporal accumulation requires continuous frames, so the demand loop is driven while enabled. Known-fragile library — behind `experimentalSSGI` gate + localStorage toggle.

---

## Usage

```tsx
<QualityProvider>
  <CarTuningScene />
  <QualitySelector />
</QualityProvider>

const { preset, settings, setPreset, ssgiEnabled, setSsgiEnabled } = useQuality()
```

Settings apply immediately; canvas invalidates on change; persists across sessions.

---

## Troubleshooting

- **Quality changes not applied** → component not inside `QualityProvider`
- **No ground shadow after a part swap** → re-bake timers (0.9s/1.4s) run after transitions; check `CarGroundShadows` mounted
- **Paint reflections stale after door open** → re-capture is scheduled ~1.45s after `openParts` changes and lands ~60 rendered frames later (after the shadow re-bake)
- **SSGI black screen / artifacts** → turn the toggle off (localStorage `car-experimental-ssgi=0`); library is experimental
- **Ultra stutters** → VRAM bound; drop floor reflection/env resolution first

---

## File Reference

**Config/Context:** `lib/config/quality.ts`, `contexts/QualityContext.tsx`
**Scene:** `components/car/CarTuningScene.tsx`, `CarStudioEnvironment.tsx`, `CarGroundShadows.tsx`, `CarLighting.tsx`, `ConfigurableCar.tsx`, `DynamicPart.tsx`, `PhotoMode.tsx`, `PhotoModeUI.tsx`
**Shared:** `lib/three/prepareCarMaterial.ts`, `lib/three/useCubeReflections.ts`
**Post:** `components/store/PostProcessing.tsx`
**UI:** `components/car/QualitySelector.tsx`
**Page:** `app/car/[id]/CarPageClient.tsx`
