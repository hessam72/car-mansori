# Testing the /store window-sunlight effect

## 1. Prep
- Make sure `main.glb` has a window opening and a mesh named with `glass` for the pane(s).
- `npm run dev`, open `http://localhost:3000/store`.

## 2. Aim the sun
Open `http://localhost:3000/store?sundebug=1` (dev-only).

You'll see:
- A **yellow gizmo** at the sun's position/direction.
- A **wireframe box** = the shadow camera frustum.

Check the box fully encloses the room. If it doesn't, sunlight will leak through walls outside the box.

Controls:
| Key | Effect |
|---|---|
| Arrow keys | Move sun on X/Z |
| Shift + Arrow keys | Move target (aim point) on X/Z |
| Page Up / Page Down | Move sun on Y |
| `+` / `-` | Intensity up/down |
| `[` / `]` | Shrink / grow the shadow box |

Every keypress logs to the browser console:
```
[sundebug] paste into stores.json →
{ "sun": { ... } }
```

## 3. Save your tuned values
Copy the last console block and paste it over the `sun` object in
`public/config/stores.json` (under the `mall` store).

## 4. Verify
- Reload `/store` (no `?sundebug=1`) — floor should show a soft-edged, window-shaped
  light patch that blurs more at the edges (PCSS signature).
- Walk around — shadow should stay stable, no flicker.
- Set `"enabled": false` in the `sun` block — shadow/sun should disappear, scene back to normal.

## Troubleshooting
| Symptom | Likely cause |
|---|---|
| No shadow at all | `sun.enabled` is `false`, or GLB has no `main.glb` loaded |
| Light leaks through walls | Shadow box too small — grow it with `]` in sundebug and re-save |
| Whole window is one solid dark shadow (no light through glass) | Pane mesh isn't named with `glass` |
| Hard edges, not soft | Check `soft.samples`/`soft.size` in the `sun` config didn't get zeroed out |
| Washed out / blown out patch | Lower `sun.intensity` (try steps of 4-5 from current value) |

---

# The same sun on /product

The presentation page reads the identical `sun` block, and mounts /store's own
`SunLight` / `ShadowSystem` / `SunDebug` — imported, not forked — so a
`?sundebug=1` printout pastes into either manifest unchanged.

- **Where:** `public/config/furniture-presentation.json`, per product, as a
  sibling of `room` / `lighting` / `camera`.
- **Off by default.** No `sun` block, or `"enabled": false`, and the page
  renders with no shadow maps at all, as it did before. The trimmed
  front-facing-only room is what made dropping the shadow pass worth it, so
  turn this on for a room that actually has a window.
- **Tune it at** `http://localhost:3000/product/test?sundebug=1` — same keys as
  the table above.

## One difference: the shadow box fits itself

`shadow.left/right/top/bottom` are optional here. Leave all four out and the
frustum is solved from the room GLB's measured bounds every time it loads
(`PresentationSun`), instead of being hand-tuned per product — the light's
eight box corners are projected into its view space and the extents taken
there, so it holds for a sun aimed diagonally across the room. `target`
defaults to the measured room centre for the same reason.

Name all four and yours win, unchanged. `bias` / `normalBias` are always yours.

This removes the failure at the top of the troubleshooting table: an undersized
box does not clip the shadow, it makes drei's PCSS shader return *fully lit*
outside the frustum, so sunlight pours through the walls.

## GLB naming contract

Unchanged, and now enforced in `preparePresentationObject` for the room and the
furniture alike:

| Mesh name contains | Effect |
|---|---|
| `glass` | never casts — the depth pass is alpha-blind, so a pane blacks out the whole sun patch. The frames around it cast, and that is what paints the window pattern on the floor |
| `lamp` | never casts, so a glowing shade throws no hard sun shadow |
| `ceiling` | already double-sided by PresentationRoom |

---

# Reflective floor on /product

Not /store's `ReflectiveFloor` component. That one is an **opaque** plane
carrying its own concrete texture — it *is* the salon floor. A room GLB already
has a floor, so `PresentationFloor` ports the technique instead: the same drei
planar reflector (scene re-rendered from a camera mirrored through the plane,
obliquely clipped at it) on a **transparent plane with no map**, sitting 4mm
above the real floor. What the reflection does not cover, the room's own texture
shows through.

- **Where:** `public/config/furniture-presentation.json`, per product, a `floor`
  block beside `sun`. Absent, or `"enabled": false`, and no reflection pass runs.
- **Also off** below the quality tier that affords it
  (`settings.floorReflectionsEnabled` — low tier). Unlike /store there is no
  matte stand-in to swap in: the real floor is already there, so it is simply
  skipped.
- **Tune it at** `http://localhost:3000/product/test?floordebug=1`:

| Key | Effect |
|---|---|
| `[` / `]` | opacity — how much floor texture survives |
| `-` / `+` | mix strength |
| `,` / `.` | blur |
| `b` | flip `normal` ⇄ `additive` |

Each keypress logs a paste-ready `{ "floor": { ... } }` block.

## opacity, and which blend

`opacity` is the whole feature: 1 is a mirror with the texture gone, 0.35 (the
default) leaves the tiles as the thing you read and the reflection as a sheen.

`blend` decides what the reflection is allowed to do to it:

- **`normal`** alpha-blends. Dark reflections darken the floor, which is what a
  surface actually does as it turns mirror-like. The default.
- **`additive`** only ever adds reflected light — nothing darkens, so the
  texture survives at any opacity. Better over a dark floor; a bright
  reflection can blow out.

`size` and the plane's centre are fitted to the room's measured footprint, like
the sun's frustum. Give `size` explicitly for a photographed backdrop, which has
no room to measure.

## Why it neither casts nor receives

Casting would print a hard-edged rectangle of shade on the floor 4mm underneath
it. Receiving would apply the sun's shadow a second time over a floor that has
already taken it — and a shadow across a polished floor dims its diffuse, not
what is reflected in it, so leaving the shadow to the real floor is also the
truer answer.

---

# /product manifest: quality, loading, camera

## `quality` — the tier, per product instead of per device

`QualityProvider` drops to `low` under 768px on a first visit, and otherwise
restores whatever /car's quality selector last stored (they share the
`car-quality-preset` key). On `low` that means **floor reflections off**, a 512
shadow map instead of 2048, dpr `[0.5, 1]` and a 256 environment — the phone
was rendering a visibly different scene from the desktop.

Right for /car and /store, which are free-roaming and cost whatever the player
walks into. Wrong here: a presentation is one piece in a booth under a camera
that only dollies, so its frame cost is known up front and is the same
everywhere. The manifest names the tier and `QualityProvider` is pinned to it,
bypassing both the stored preset and the phone downgrade.

```json
"quality": { "preset": "high" }
```

`quality.mobile` exists for a product heavy enough to need an exception, and
**defaults to `preset`** — nothing is downgraded silently. Omit the block
entirely and the app-wide default (`medium`) applies on every device.

Note the two runtime scalers are unaffected and still apply on both: `PerfLadder`
steps DPR down under sustained load, and `clampDprToBudget` caps it on very
high-resolution screens.

## Loading

`useAssetProbe` HEAD-checks the manifest's URLs before mounting the canvas, but
that only proves the files exist. Everything after it streamed in behind
`Suspense fallback={null}` — blank, then a room, then a piece, in whatever order
the network delivered.

`PresentationLoading` now covers the canvas until `SceneReady` fires, which
takes its cue from the scene's own products rather than a loader count: the
stack has published `framing`, the room (when there is one) has published its
bounds, and one `gl.compile` has run, so the first visible frame is not the one
that stalls compiling shaders. `useProgress` drives the bar only — it reports
0 of 0 both before the first request and after a warm cache, so it cannot decide
readiness. A 20s failsafe reveals the scene anyway rather than hanging.

## Camera: portrait no longer reverses through the wall

Two defects, both invisible on desktop:

1. **The lift aimed the camera under the floor.** To clear the bottom sheet the
   rig aimed *below* the piece, by a distance scaling with both the framed
   distance and the sheet's screen coverage. A phone maximises both — roughly a
   2m dive on a sofa whose centre is 0.4m up, which a 10° elevation cannot climb
   back out of. It is now a **lens shift** (`camera.setViewOffset`), which skews
   the frustum down and moves the image up on screen for the identical result,
   from a camera that stays on the piece's level. Every metre of that dive also
   came off the pull-back the room could afford, since the wall limit was
   measured from the sunken point.
2. **The wall clamp failed open.** A room too tight to hold `WALL_MARGIN`
   returned `Infinity` — read as "unclamped" — in precisely the case that needed
   the clamp. It now returns the smallest usable distance.

And the reason lowering `maxZoom` "fixed" the phone at the cost of the desktop:
`fov` is vertical, so a portrait canvas needs roughly twice the pull-back, and a
booth modelled around the piece does not have it. Rather than crop or reverse,
the rig now **opens the lens** until the piece fits at the distance the room
actually affords, capped by `camera.maxFov` (default 75; set it equal to `fov`
to refuse and take the crop). Desktop never reaches the limit, so its lens never
widens and its full zoom range is untouched. `camera.wallMargin` (default 0.35m)
tunes the clearance.
