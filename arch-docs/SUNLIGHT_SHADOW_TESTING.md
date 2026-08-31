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
