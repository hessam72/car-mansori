# Sunlight + PCSS Shadow — Implementation Guide (port to a new R3F app)

Hand this file to an AI agent together with the folder `arch-docs/sunlight-shadow/`.
It describes a complete, working "sun through a window" lighting system extracted from a shipped
Next.js + React Three Fiber project, plus every non-obvious constraint that makes it work.

---

## 1. What this produces

A directional light positioned *outside* the building shines through a window opening carved in the
GLB. The window frames/mullions cast; the glass panes deliberately do not. The result is a
window-shaped patch of warm light on the floor with a **contact-hardening** penumbra — crisp where
geometry touches the floor, progressively blurrier further from the caster. That soft falloff is
PCSS (Percentage-Closer Soft Shadows), enabled globally by drei's `<SoftShadows>`.

Render chain:

```
<Canvas shadows>                         → renderer.shadowMap.enabled = true
  └─ <SoftShadows>                       → patches THREE.ShaderChunk shadow code globally (PCSS)
  └─ <directionalLight castShadow>       → renders scene depth into an ortho shadow map
       └─ <orthographicCamera            → the frustum; MUST enclose the whole room
            attach="shadow-camera">
  └─ <primitive object={target}>         → aim point; light direction = position → target
  └─ GLB meshes                          → castShadow / receiveShadow, glass excluded from casting
```

Everything user-tunable lives in a JSON block, and there is a dev-only live tuner (`?sundebug=1`)
that prints a paste-ready version of that block.

---

## 2. Prerequisites

Verified working on:

| Package | Version |
|---|---|
| `three` | `0.170.0` |
| `@react-three/fiber` | `8.17.10` |
| `@react-three/drei` | `9.122.0` |
| `react` | `18.3.1` |

Version notes for the porting agent:

- **drei 10.x / fiber 9.x (React 19)** — `<SoftShadows>` still exists and the props (`size`,
  `samples`, `focus`) are unchanged, but verify before assuming. If `SoftShadows` is missing or
  renamed, the fallback is `<Canvas shadows="soft">` (VSM) — visually different (blurrier, no
  contact hardening) but no code changes elsewhere.
- **WebGPURenderer / TSL** — there is no PCSS shader chunk to patch. `SoftShadows` is a WebGL-only
  technique. On WebGPU use `THREE.VSMShadowMap` or node-based shadows instead; the light/frustum/
  config half of this guide still applies, only `ShadowSystem.tsx` becomes a no-op.
- Do **not** set `<Canvas shadows="soft">` *and* mount `<SoftShadows>` — pick one. Use plain
  `shadows` with `<SoftShadows>`.

---

## 3. File manifest — copy these

Source folder: `arch-docs/sunlight-shadow/`

| File | Required? | Suggested target | Purpose |
|---|---|---|---|
| `types.ts` | **required** | `src/lighting/types.ts` | `SunConfig`, `SunShadowConfig`, `SoftShadowConfig`, `PartialSunConfig` |
| `ShadowSystem.tsx` | **required** | `src/lighting/ShadowSystem.tsx` | Global PCSS enable + the two fixes drei omits |
| `SunLight.tsx` | **required** | `src/lighting/SunLight.tsx` | The light, the ortho frustum, config merge, FBO handling |
| `SunDebug.tsx` | **required¹** | `src/lighting/SunDebug.tsx` | `?sundebug=1` live tuner (`SunLight` imports it) |
| `applySceneShadowFlags.ts` | **required** | `src/lighting/applySceneShadowFlags.ts` | GLB traversal: cast/receive flags, glass exclusion, `shadowSide` |
| `sun.config.example.json` | recommended | `public/config/sun.json` | Tuned starting values |
| `useSunConfig.ts` | optional | `src/lighting/useSunConfig.ts` | Runtime JSON loader — skip if you `import` the JSON |
| `ShadowFreeze.tsx` | optional | `src/lighting/ShadowFreeze.tsx` | Perf: freeze shadow map when sun + casters are static |

¹ `SunDebug` is dev-only at runtime (guarded by `NODE_ENV` + query param) but is a compile-time
import of `SunLight`. To drop it, delete the import and the `sunDebugRequested()` block.

These files have **no imports outside the folder** other than `react`, `three`,
`@react-three/fiber`, `@react-three/drei`. They are framework-agnostic apart from the `'use client'`
directives (harmless outside Next.js — delete them if your bundler complains).

### Original sources in the donor project (for reference only)

`components/store/SunLight.tsx` · `components/store/ShadowSystem.tsx` · `components/store/SunDebug.tsx` ·
`components/store/hooks/useStoreConfig.ts` (types) · `components/store/ModelLoader.tsx:97-158` (GLB flags) ·
`components/store/Scene.tsx:427-487` (mount site) · `public/config/stores.json` (`mall.sun`) ·
`lib/config/quality.ts` (`shadowResolution` tiers) · `components/car/ShadowFreeze.tsx`

---

## 4. Scene requirements (get these wrong and nothing works)

### 4.1 Canvas

```tsx
<Canvas
  shadows                                  // ← required
  gl={{
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 0.3,              // ← intensity 18 is calibrated to THIS
  }}
>
```

**Exposure calibration is the #1 porting trap.** The tuned `intensity: 18` only looks right at
`toneMappingExposure: 0.3` with ACES tone mapping. At the three.js default exposure of `1.0` the
same value blows out completely. If your app uses a different exposure, keep the light-to-exposure
ratio: `newIntensity ≈ 18 × (0.3 / yourExposure)`, then fine-tune with `+`/`-` in sundebug.

The donor scene also runs an HDRI `<Environment environmentIntensity={0.8} background={false} />`.
The sun is a *key* light layered on top of ambient IBL — without any environment light the
non-sunlit parts of the room will read as near-black.

### 4.2 Mount order

`<SoftShadows>` swaps a **global** shader chunk when it mounts and recompiles existing materials.
Any material compiled *before* it mounts, and not recompiled, silently keeps hard shadows.

Two rules:
1. Mount `<ShadowSystem>` as early inside `<Canvas>` as possible — ideally before the model
   `<Suspense>` boundary, so streamed-in GLB materials compile against the already-patched chunk.
2. In the donor app the whole `<Canvas>` only mounts after the config resolves, which guarantees
   ordering. If your models are already in the tree, `ShadowSystem`'s `useEffect` handles it — it
   traverses the scene and forces `needsUpdate` on every material (drei's own recompile skips
   **array materials**, which is the gap that fix closes).

### 4.3 GLB authoring contract

The model must satisfy these or the effect fails visually:

| Requirement | Why |
|---|---|
| An actual **hole** in the wall geometry for the window | The light needs a gap to pass through — a transparent quad is not enough, the depth pass ignores alpha |
| Window panes named with **`glass`** in the mesh name | `applySceneShadowFlags` sets `castShadow = false` on them. The shadow depth pass is **alpha-blind**: a transparent pane that casts turns the entire sun patch solid black |
| Frames/mullions keep their normal names | They *should* cast — they are what paints the window pattern on the floor |
| Floor mesh receives | Handled automatically by the traversal |

Call the helper on every loaded model, on the clone you add to the scene:

```ts
import { applySceneShadowFlags, disableShadows } from './lighting/applySceneShadowFlags'

const scene = gltf.scene.clone(true)
applySceneShadowFlags(scene)     // visual models
// disableShadows(proxy)         // invisible collision / wireframe proxies
```

`shadowSide = THREE.DoubleSide` is set on all materials by that helper: thin single-plane walls and
window frames otherwise cast unreliably depending on GLB winding order. It affects the depth pass
only — `material.side` is untouched.

### 4.4 The shadow frustum must enclose the room

drei's PCSS shader **early-returns fully-lit** for any fragment outside the shadow camera's ortho
box. An undersized box does not clip the shadow — it makes sunlight **leak straight through walls**
outside the box. Always verify with the sundebug wireframe (§6) before shipping.

Cost is `(right-left) × (top-bottom)` of world area spread over `shadowResolution²` texels, so
oversizing wastes resolution. Target: just big enough to contain the room.

---

## 5. Minimal integration

```tsx
'use client'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { ShadowSystem } from './lighting/ShadowSystem'
import { SunLight } from './lighting/SunLight'
import { useSunConfig } from './lighting/useSunConfig'

export function Scene() {
  const { sun } = useSunConfig('/config/sun.json')

  return (
    <Canvas
      shadows
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.3,
      }}
      camera={{ position: [0, 2, 5], fov: 60, near: 0.1, far: 200 }}
    >
      <Environment files="/hdr/main_hdr.exr" background={false} environmentIntensity={0.8} />

      {/* Order matters: PCSS patch before models compile */}
      {sun?.enabled && (
        <>
          <ShadowSystem
            size={sun.soft?.size ?? 20}
            samples={sun.soft?.samples ?? 16}
            focus={sun.soft?.focus ?? 0}
          />
          <SunLight sun={sun} shadowResolution={2048} />
        </>
      )}

      <YourModels />
    </Canvas>
  )
}
```

Note the duplication: `soft.*` goes to `ShadowSystem` (a global effect), the rest to `SunLight`.
They read from the same JSON block, so keep them gated by the same `enabled` flag — mounting one
without the other gives either hard shadows or PCSS with no sun.

---

## 6. Config reference

```jsonc
{
  "sun": {
    "enabled": true,                  // master switch — false unmounts light + PCSS entirely
    "position": [1.5, 13, 40],        // sun in world space, OUTSIDE the building
    "target":   [2, 0.5, 13.5],       // aim point; direction = position → target
    "intensity": 18,                  // calibrated to toneMappingExposure 0.3 (see §4.1)
    "color": "#ffe3c2",               // warm daylight
    "soft": {
      "size": 1,                      // LIGHT-SOURCE size, not world size. Bigger = softer.
      "samples": 16,                  // PCF taps — quality vs cost. 8 mobile / 16 desktop.
      "focus": 0                      // depth focus of the softening
    },
    "shadow": {
      "left": -30, "right": 30,       // ortho frustum — MUST enclose the room (§4.4)
      "top": 30,  "bottom": -30,
      "near": 0.5, "far": 45,         // far must reach past the floor from the sun's position
      "bias": -0.0001,                // shadow acne vs peter-panning
      "normalBias": 0.03              // acne fix on curved/angled surfaces
    }
  }
}
```

### Defaults and merge semantics

`SunLight.tsx` exports `DEFAULT_SUN`. Your JSON is deep-merged over it by `mergeSun()`, so a scene
may specify only the fields it overrides. `DEFAULT_SUN.enabled` is `false` — **a missing config
means the feature is off**, which is the safe default.

| Field | `DEFAULT_SUN` | Tuned production value | Note |
|---|---|---|---|
| `soft.size` | `20` | **`1`** | The default is far too soft for a window patch — start near `1` |
| `shadow` box | `±14` | `±30` | Depends entirely on room size |
| `intensity` | `20` | `18` | Re-tune per exposure |
| `position` | `[8,7,-6]` | `[1.5,13,40]` | High and far outside |

The merge is one level deep on `soft`/`shadow` (`{...base, ...over}`) — nested partials work, but
do not nest deeper than that.

---

## 7. Tuning workflow (`?sundebug=1`)

Aiming a sun by editing numbers and reloading is miserable. The tuner makes it a 2-minute job.

1. Run the dev server and open your scene with `?sundebug=1` appended to the URL.
   (Guarded by `process.env.NODE_ENV === 'development'` — never ships to prod. If your bundler
   doesn't define `NODE_ENV`, swap that check for `import.meta.env.DEV` or equivalent.)
2. You'll see a **yellow gizmo** at the sun's position/direction and a **wireframe box** for the
   shadow-camera frustum.
3. **First check the box fully encloses the room.** If it doesn't, sunlight leaks through walls
   outside it — grow it with `]`.

| Key | Effect |
|---|---|
| Arrow keys | Move sun on X / Z |
| Shift + Arrow keys | Move target (aim point) on X / Z |
| Page Up / Page Down | Move sun on Y |
| `+` / `-` | Intensity up / down (step 2) |
| `[` / `]` | Shrink / grow the shadow box (step 1, stays centred) |

4. Every keypress logs a paste-ready block to the console:
   ```
   [sundebug] paste into your sun config →
   { "sun": { ... } }
   ```
5. Copy the last block over your `sun` object, reload **without** `?sundebug=1`, and verify.

`soft.size` / `samples` are not keyboard-bound — edit those in the JSON (they force a global shader
recompile, so live-stepping them would stutter).

---

## 8. Performance

### 8.1 Shadow resolution tiers

Wire `shadowResolution` to whatever quality system the target app has. The donor's ladder:

| Tier | `shadowResolution` |
|---|---|
| low | 512 |
| medium | 1024 |
| high | 2048 |
| ultra | 2048 |

`SunLight` accepts it as a prop and defaults to `2048`.

### 8.2 The shadow-FBO resize quirk (already handled — don't remove it)

**three.js never resizes an existing shadow framebuffer.** Changing `shadow.mapSize` on a light
whose shadow map has already been allocated does nothing. `SunLight.tsx` handles this by disposing
the map and nulling it so three reallocates at the new size:

```ts
if (light && prevRes.current !== res) {
  prevRes.current = res
  const shadow = light.shadow as unknown as { map: THREE.WebGLRenderTarget | null }
  shadow.map?.dispose()
  shadow.map = null
}
```

Delete this and quality-tier changes will silently do nothing to shadow sharpness.

### 8.3 Stable shadow-camera construction

The `<orthographicCamera args={...}>` uses a **`useRef`-frozen initial args array**, and the real
bounds are applied imperatively in `useLayoutEffect`. Reason: R3F reconstructs an object when its
`args` array changes identity, which would invalidate `light.shadow.camera` and break the
`CameraHelper` the debug overlay holds. Keep the pattern.

### 8.4 Frozen shadows for static scenes (`ShadowFreeze.tsx`)

If the sun and all casters are static, re-rendering a 2048² depth pass every frame is pure waste.
`ShadowFreeze` sets `gl.shadowMap.autoUpdate = false` and re-enables updates only for a
frame-counted window (default 150 rendered frames) after each dependency change:

```tsx
<ShadowFreeze deps={[modelsRevision, qualityTier]} />
```

**Do not use it with a moving sun** (day/night cycle) — the shadow would stick.

### 8.5 Demand frameloop

If you run `<Canvas frameloop="demand">`, every change to lighting state must be followed by
`invalidate()` or the new state is computed and never drawn. `ShadowSystem`, `SunLight` and
`SunDebug` all call it already. `SunLight` also exposes `onDebugActivity` so the tuner can wake an
idle governor if your app parks the loop.

---

## 9. Troubleshooting

| Symptom | Likely cause |
|---|---|
| No shadow at all | `sun.enabled` is `false`, or `<Canvas>` is missing the `shadows` prop |
| Sunlight leaks **through walls** | Shadow box too small — the PCSS shader treats everything outside the ortho frustum as fully lit. Grow it with `]` and re-save |
| Whole window is one solid dark shadow | A pane mesh isn't named `*glass*`, so it casts. The depth pass is alpha-blind |
| Hard edges, no penumbra | `<ShadowSystem>` not mounted, or `soft.samples`/`soft.size` got zeroed, or `shadows="soft"` on Canvas is fighting `<SoftShadows>` |
| **Some** objects have hard shadows, others soft | Those materials compiled before `SoftShadows` mounted, and they're array materials (drei's recompile skips them). Ensure `ShadowSystem`'s traversal effect runs after they load — remount it or bump a key |
| Washed out / blown-out patch | Exposure mismatch (§4.1). Lower `intensity` in steps of 4-5, or fix `toneMappingExposure` |
| Shadow acne (stripes on lit surfaces) | Raise `normalBias` (`0.03` → `0.05`); tweak `bias` more negative only as a last resort |
| Shadow detached from object ("peter-panning") | `bias` too negative, or `normalBias` too high |
| Changing quality tier doesn't change sharpness | The FBO dispose block (§8.2) was removed |
| Shadows stuck / stale after something moves | `ShadowFreeze` mounted with incomplete `deps`, or a demand loop with no `invalidate()` |
| Thin walls / frames don't cast | `shadowSide = DoubleSide` not applied — run `applySceneShadowFlags` on the clone you actually add to the scene, not the cached GLTF |
| Debug overlay does nothing | Not `NODE_ENV=development`, `?sundebug=1` missing, or focus is in an input that swallows keydown |

---

## 10. Acceptance checklist

- [ ] `<Canvas shadows>` with tone mapping + exposure matched to `intensity`
- [ ] `<ShadowSystem>` mounts before/with the models; array materials recompiled
- [ ] `applySceneShadowFlags()` runs on every visual model clone
- [ ] Window panes named `*glass*` in the GLB; the wall has a real opening
- [ ] `?sundebug=1` wireframe box fully encloses the room
- [ ] Floor shows a **window-shaped** patch whose edges blur with distance from the caster
- [ ] Walking/orbiting the scene shows no flicker and no light leaking through walls
- [ ] Setting `"enabled": false` cleanly removes sun + shadows, scene still renders
- [ ] Quality tier change visibly changes shadow sharpness (proves the FBO dispose works)
