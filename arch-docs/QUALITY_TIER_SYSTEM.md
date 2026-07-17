# Quality Tier System

Dynamic graphics quality management system for the /car page with user-selectable presets (Low/Medium/High/Ultra).

---

## Overview

**Location:** `/car/[id]` route
**Config:** `lib/config/quality.ts`
**Context:** `contexts/QualityContext.tsx`
**UI:** `components/car/QualitySelector.tsx` (top-right overlay)
**Persistence:** localStorage (`car-quality-preset`)
**Default:** Medium preset

---

## Architecture

### Quality Settings Interface
```ts
interface QualitySettings {
  dpr: [number, number]                    // Device pixel ratio [min, max]
  adaptiveDpr: boolean                     // Drop DPR during camera movement
  shadowResolution: number                 // Shadow map size (256-2048)
  floorReflectionResolution: number        // Floor reflection texture (128-2048)
  meshReflectorResolution: number          // MeshReflector resolution
  multisampling: number                    // MSAA samples (0/4/8)
  enableN8AO: boolean                      // Ambient occlusion effect
  enableSMAA: boolean                      // Anti-aliasing post-processing
  enableAnisotropicFiltering: boolean      // Texture filtering
  anisotropyLevel: number                  // Anisotropy samples (1-16)
}
```

---

## Quality Presets

### Low (Mobile/Performance)
```ts
{
  dpr: [0.5, 1],
  adaptiveDpr: true,
  shadowResolution: 256,
  floorReflectionResolution: 128,
  meshReflectorResolution: 512,
  multisampling: 0,
  enableN8AO: false,
  enableSMAA: false,
  enableAnisotropicFiltering: false,
  anisotropyLevel: 1
}
```
**Target:** 30+ FPS on mobile, integrated GPUs
**VRAM:** ~200-300MB
**Features:** Basic rendering, adaptive DPR enabled

### Medium (Default/Balanced)
```ts
{
  dpr: [1, 1.5],
  adaptiveDpr: true,
  shadowResolution: 512,
  floorReflectionResolution: 256,
  meshReflectorResolution: 1024,
  multisampling: 0,
  enableN8AO: false,
  enableSMAA: false,
  enableAnisotropicFiltering: false,
  anisotropyLevel: 1
}
```
**Target:** 60 FPS on mid-range GPUs
**VRAM:** ~400-600MB
**Features:** Balanced quality/performance

### High (Desktop/Quality)
```ts
{
  dpr: [1, 1.75],
  adaptiveDpr: false,
  shadowResolution: 1024,
  floorReflectionResolution: 512,
  meshReflectorResolution: 1024,
  multisampling: 4,
  enableN8AO: true,
  enableSMAA: true,
  enableAnisotropicFiltering: true,
  anisotropyLevel: 4
}
```
**Target:** 60 FPS on dedicated GPUs (GTX 1060+)
**VRAM:** ~800MB-1.2GB
**Features:** N8AO, SMAA, texture filtering, fixed DPR

### Ultra (High-End/Maximum Quality)
```ts
{
  dpr: [1, 2],
  adaptiveDpr: false,
  shadowResolution: 2048,
  floorReflectionResolution: 2048,
  meshReflectorResolution: 2048,
  multisampling: 8,
  enableN8AO: true,
  enableSMAA: true,
  enableAnisotropicFiltering: true,
  anisotropyLevel: 16
}
```
**Target:** 60 FPS on high-end GPUs (RTX 3060+)
**VRAM:** ~1.5-2.5GB
**Features:** Maximum shadow resolution, reflections, post-processing

---

## Component Integration

### CarTuningScene.tsx
**Controls:** DPR, AdaptiveDpr, floor reflection resolution

```tsx
const { settings } = useQuality()

<Canvas
  dpr={settings.dpr}
  // ...
>
  {settings.adaptiveDpr && <AdaptiveDpr pixelated />}
  <ReflectiveFloor resolution={settings.floorReflectionResolution} />
</Canvas>
```

### CarLighting.tsx
**Controls:** Shadow map resolution

```tsx
const { settings } = useQuality()

<spotLight
  castShadow
  shadow-mapSize-width={settings.shadowResolution}
  shadow-mapSize-height={settings.shadowResolution}
/>
```

### PostProcessing.tsx
**Controls:** Multisampling, N8AO, SMAA

```tsx
const { settings } = useQuality()

<EffectComposer multisampling={settings.multisampling}>
  {settings.enableN8AO && <N8AO {...} />}
  {settings.enableSMAA && <SMAA />}
</EffectComposer>
```

### ConfigurableCar.tsx
**Controls:** Anisotropic filtering on textures

```tsx
const { settings } = useQuality()

useEffect(() => {
  if (!settings.enableAnisotropicFiltering) return

  carModel.traverse((child) => {
    // Apply anisotropy to map, normalMap, roughnessMap, etc.
    texture.anisotropy = settings.anisotropyLevel
  })
}, [settings.enableAnisotropicFiltering, settings.anisotropyLevel])
```

### ReflectiveFloor.tsx
**Controls:** MeshReflector resolution (via props)

```tsx
<MeshReflectorMaterial resolution={resolution} />
```

---

## UI Component

### QualitySelector.tsx
Position: `absolute top-4 right-4`
Style: Dark overlay with 4 buttons (Low/Medium/High/Ultra)
State: Active preset highlighted with blue background

```tsx
<QualitySelector />
```

---

## Usage

### User Flow
1. Navigate to `/car/[id]`
2. Click quality button in top-right (default: Medium)
3. Selection saved to localStorage
4. Settings applied immediately (invalidates canvas)
5. Persists across sessions

### Developer Flow
```tsx
// Wrap page with QualityProvider
<QualityProvider>
  <CarTuningScene />
  <QualitySelector />
</QualityProvider>

// Access settings in any child component
const { preset, settings, setPreset } = useQuality()
```

---

## Performance Impact

### DPR (Device Pixel Ratio)
- **Low (0.5-1):** 25-100% of native resolution
- **Medium (1-1.5):** 100-225% pixel count
- **High (1-1.75):** 100-306% pixel count
- **Ultra (1-2):** 100-400% pixel count (Retina)

Impact: **HIGH** (linear with screen area)

### Shadow Resolution
- **256:** 65k pixels per shadow map
- **512:** 262k pixels (4x Low)
- **1024:** 1M pixels (16x Low)
- **2048:** 4M pixels (64x Low)

Impact: **MEDIUM** (one shadow-casting light)

### Floor Reflection Resolution
- **128:** 16k pixels
- **256:** 65k pixels
- **512:** 262k pixels
- **2048:** 4M pixels

Impact: **MEDIUM-HIGH** (rendered every frame)

### Multisampling (MSAA)
- **0:** No MSAA
- **4:** 4x samples per pixel
- **8:** 8x samples per pixel

Impact: **MEDIUM** (depends on fragment complexity)

### N8AO (Ambient Occlusion)
Screen-space effect, multiple samples per pixel

Impact: **HIGH** (expensive post-processing)

### SMAA (Anti-Aliasing)
Edge-detection AA, cheaper than MSAA

Impact: **LOW-MEDIUM** (efficient post-processing)

### Anisotropic Filtering
Texture sampling quality for oblique angles

Impact: **LOW** (GPU optimized)

---

## Best Practices

### Auto-Detection
Consider detecting GPU tier on mount:
```ts
const gl = canvas.getContext('webgl2')
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
// Parse renderer string → suggest preset
```

### Performance Monitoring
Use PerformanceMonitor to auto-downgrade:
```tsx
<PerformanceMonitor
  onDecline={() => autoDowngradeQuality()}
/>
```

### Responsive Defaults
```ts
const isMobile = window.innerWidth < 768
const defaultPreset = isMobile ? 'low' : 'medium'
```

---

## Future Enhancements

### Planned
- [ ] Auto-detect GPU tier on first visit
- [ ] FPS-based auto-adjustment
- [ ] Per-setting custom mode (advanced users)
- [ ] Performance stats overlay
- [ ] Quality comparison screenshots

### Advanced Settings (Custom Mode)
Individual control sliders for:
- DPR (0.5-2.0)
- Shadow resolution (256-4096)
- Reflection resolution (128-4096)
- Post-processing toggles
- Anisotropy level (1-16)

---

## Troubleshooting

### Issue: Quality changes not applied
**Cause:** Component not wrapped in QualityProvider
**Fix:** Ensure `<QualityProvider>` wraps Canvas

### Issue: Settings don't persist
**Cause:** localStorage disabled/private mode
**Fix:** Fallback to session state

### Issue: Ultra preset causes stuttering
**Cause:** GPU VRAM exceeded
**Fix:** Auto-downgrade or warn user

### Issue: Mobile performance poor on Low
**Cause:** Device limitations
**Fix:** Consider dropping to DPR 0.5, disable reflections

---

## File Reference

**Config:**
- [lib/config/quality.ts](../lib/config/quality.ts)

**Context:**
- [contexts/QualityContext.tsx](../contexts/QualityContext.tsx)

**Components:**
- [components/car/QualitySelector.tsx](../components/car/QualitySelector.tsx)
- [components/car/CarTuningScene.tsx](../components/car/CarTuningScene.tsx)
- [components/car/CarLighting.tsx](../components/car/CarLighting.tsx)
- [components/car/ConfigurableCar.tsx](../components/car/ConfigurableCar.tsx)
- [components/store/ReflectiveFloor.tsx](../components/store/ReflectiveFloor.tsx)
- [components/store/PostProcessing.tsx](../components/store/PostProcessing.tsx)

**Page:**
- [app/car/[id]/CarPageClient.tsx](../app/car/[id]/CarPageClient.tsx)
