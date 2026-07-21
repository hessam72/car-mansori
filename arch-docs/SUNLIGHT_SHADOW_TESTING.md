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
