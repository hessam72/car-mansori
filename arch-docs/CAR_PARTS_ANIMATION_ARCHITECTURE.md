# Car Parts Animation System - Architecture

## Overview

Interactive door/hood/trunk opening system for 3D car configurator using pivot-based rotation with GSAP animations.

## Core Concept

**Pivot-Based Rotation:** Instead of rotating meshes directly, create invisible pivot points (hinges) at correct positions, attach meshes to pivots, then animate pivot rotation. This ensures realistic hinge-like movement.

## System Architecture

```
User Interaction
    ↓
UI Panel / Click Detection
    ↓
Zustand Store (State Management)
    ↓
React Component (ConfigurableCar)
    ↓
DoorController (Animation Engine)
    ↓
Three.js Scene (Visual Output)
```

## Components

### 1. DoorController (lib/DoorController.ts)

**Responsibility:** Core animation engine

**Key Functions:**
- Derive the car's own axes (see `lib/car/carFrame.ts`)
- Locate each part's hinge edge by projecting its geometry onto those axes
- Create frame-aligned pivot points for each movable part
- Manage GSAP animations (rotation + a small outward slide on doors)
- Tear down cleanly on model swap via `dispose()`

**Supported Parts:**
- Left/Right Front Doors
- Left/Right Rear Doors
- Hood (Caput)
- Trunk

**Animation Strategy:**

Each pivot is oriented to the car frame, so its local axes are always
`X = passenger side`, `Y = up`, `Z = rear` no matter how the GLB is aligned:

- Doors rotate about pivot-local **Y** (vertical hinge); left negative, right positive
- Hood/trunk rotate about pivot-local **X** (horizontal hinge); hood positive, trunk negative
- Doors additionally slide outward by a fraction of their own length

Because the pivot is normalised first, these axes and signs are fixed constants
rather than per-model tuning. See [CAR_HINGE_SETUP_GUIDE.md](./CAR_HINGE_SETUP_GUIDE.md).

### 2. State Management (stores/carConfigStore.ts)

**Responsibility:** Centralized open/closed state

**State Structure:**
```
openParts: {
  car_door_left: boolean
  car_door_right: boolean
  car_door_back_left: boolean
  car_door_back_right: boolean
  car_caput: boolean
  car_trunk: boolean
}
```

**Actions:**
- `togglePart(partName)` - Toggle individual part
- `openAllParts()` - Bulk open
- `closeAllParts()` - Bulk close

### 3. ConfigurableCar (components/car/ConfigurableCar.tsx)

**Responsibility:** Integration layer between React and Three.js

**Lifecycle:**
1. Load car model (GLTF/GLB)
2. Initialize DoorController after model ready
3. Subscribe to `openParts` state changes
4. Trigger animations via controller methods

**React Hooks:**
- `useEffect` for controller initialization (runs once on model load)
- `useEffect` for reactive animations (runs on state change)

### 4. PartClickDetector (components/car/PartClickDetector.tsx)

**Responsibility:** Raycasting-based click detection

**Process:**
1. Listen for pointer events on canvas
2. Distinguish clicks from drags (5px threshold)
3. Raycast from camera through click point
4. Identify clicked mesh by name
5. Dispatch `togglePart` action if valid part

**Prevents False Triggers:**
- Ignores drag movements
- Only fires on pointer-up
- Uses proper canvas coordinate mapping

### 5. PartsTogglePanel (components/car/PartsTogglePanel.tsx)

**Responsibility:** UI control panel

**Features:**
- Individual toggle buttons per part
- Visual state indication (blue = open)
- Bulk action buttons (Open/Close All)
- Disabled state when already open/closed
- Glassmorphic design (backdrop blur)

### 6. CarTuningScene (components/car/CarTuningScene.tsx)

**Responsibility:** Main scene composition

**Integrations:**
- Renders ConfigurableCar with DoorController
- Mounts PartClickDetector in Canvas
- Displays PartsTogglePanel outside Canvas

## Data Flow

### Opening a Part

```
User clicks "Left Door" button
    ↓
PartsTogglePanel.onClick
    ↓
carConfigStore.togglePart('car_door_left')
    ↓
openParts.car_door_left = true
    ↓
ConfigurableCar.useEffect detects change
    ↓
doorController.openLeftFrontDoor(true)
    ↓
GSAP animates pivot.rotation.y + pivot.position.x
    ↓
Door opens with smooth animation
```

### Click Detection Flow

```
User clicks 3D mesh
    ↓
PartClickDetector.handlePointerUp
    ↓
Raycaster intersects scene
    ↓
Mesh name matched: 'car_door_left'
    ↓
togglePart('car_door_left')
    ↓
[Same flow as button click]
```

## Technical Details

### Hinge Calculation

All positions are expressed along the **car frame** (`forward` / `right` / `up`),
never along world or node-local X/Y/Z. The part's world-space vertices are
projected onto those axes to find its edges.

| Part | along the car | across | height |
|---|---|---|---|
| Doors (left/right) | **front** edge | part's own centre | mid-height |
| Hood | **rear** edge (at the windshield) | centre | top skin |
| Trunk | **front** edge (at the cabin) | centre | top skin |

The frame comes from the four `Wheel_*` empties, falling back to a +Y-up
bounding-box heuristic, and can be overridden per model in `cars.json`.

### Animation Parameters

**Angles** (per-model overridable via `cars.json` → `parts`):
- Doors: 70°
- Hood: 45°
- Trunk: 80°

**Duration:**
- Default: 1.2 seconds
- Easing: power2.inOut (smooth acceleration/deceleration)

**Movement Offsets:**
- Doors: 5% of the door's own length, outward along the car's lateral axis
- Hood/trunk: none — with the hinge on the correct edge they rotate cleanly

Offsets are relative to the part rather than absolute world units, so they read
the same on a hatchback and a limousine.

### Mesh Attachment

**Primary Mesh:** Door/hood/trunk body

**Secondary Meshes (auto-attached):**
- Windows (car_window_*)
- Handles (door_*_attach)
- Trim pieces (caput_attach, back_attach)

All secondary meshes move with parent pivot.

## Performance Characteristics

**Initialization Cost:** ~10ms per controller (one-time)

**Animation Cost:** GPU-accelerated via GSAP, no re-renders

**Memory Overhead:** ~1KB per pivot object (6 pivots = 6KB)

**State Updates:** O(1) toggle operations

## Model Requirements

### Required Mesh Names

Must exist in GLB:
- `car_door_left`
- `car_door_right`
- `car_door_back_left`
- `car_door_back_right`
- `car_caput`
- `car_trunk`

Plus the four wheel empties `Wheel_FL` / `Wheel_FR` / `Wheel_RL` / `Wheel_RR`,
which is how the car's axes are established.

### Model Structure

Each part must be:
- Separate mesh (not joined geometry)

Orientation, up-axis and scale do **not** matter — the solver measures geometry
against the wheel-derived frame, not node transforms. Nor do object origins need
to sit at the hinge line.

### Optional Meshes

Windows/handles automatically attached if found:
- `car_window_left`, `car_window_right`
- `door_left_attach`, `door_right_attach`
- etc.

## Extension Points

### Adding New Parts

1. Add mesh name to `openParts` state
2. Implement `createHingePivot` for part type
3. Add animation method (e.g., `openSunroof`)
4. Wire to state in ConfigurableCar
5. Add UI button in PartsTogglePanel

### Custom Animations

Prefer the `parts` block in `public/config/cars.json` — it reaches the same
options without a code change:

```json
"parts": { "doorAngleDeg": 90, "hoodAngleDeg": 60, "trunkAngleDeg": 100, "durationSec": 0.8 }
```

### Alternative Hinge Positions

Per model, set `parts.hinges.<mesh>.edge` (`"front"` / `"rear"`) or `.flip` in
`cars.json`. Changing the defaults for every model means editing `HINGE_RULES`
in `lib/DoorController.ts`.

## Error Handling

**Missing Meshes:**
- Console warnings logged
- Controller continues with valid parts
- UI buttons remain functional

**Invalid Animations:**
- GSAP handles edge cases gracefully
- State remains consistent
- No visual glitches

**Race Conditions:**
- State updates batched by Zustand
- Animations queue via GSAP timeline
- No conflicting transforms

## Browser Compatibility

**WebGL Requirements:** Any Three.js compatible browser

**GSAP Support:** All modern browsers (IE11+)

**PointerEvents:** Fallback to mouse events if needed

## Future Enhancements

### Potential Features

1. **Sound Effects:** Play door/hood sounds via Web Audio API
2. **Physics:** Add bounce/spring effects with react-spring
3. **Sequential Opening:** Animate parts in sequence (e.g., all doors one-by-one)
4. **Partial Opening:** Slider control for opening angle (0-100%)
5. **Collision Detection:** Prevent doors from intersecting
6. **Mobile Gestures:** Swipe to open/close specific parts
7. **Animation Presets:** Save/load favorite configurations
8. **VR Integration:** Hand tracking for natural part interaction

### Scalability

System supports unlimited parts with minimal code changes. Add new part by:
- Defining mesh name
- Adding state entry
- Implementing hinge logic
- Creating UI control

No architectural changes required.

## Debugging Tips

**Hinge Visualization:**
- Load the configurator with `?hinges=1`, e.g. `/car/sample-car?hinges=1`
- An axes gizmo sits at each pivot (red = passenger side, green = up, blue = rear)
  and a gold box wraps each part
- The console prints the derived frame, how it was derived, and every hinge position
- Reading the gizmos is covered in [CAR_HINGE_SETUP_GUIDE.md](./CAR_HINGE_SETUP_GUIDE.md)

**State Inspection:**
- Use Zustand DevTools extension
- Monitor `openParts` state changes
- Track animation triggers

**Mesh Discovery:**
- Log all mesh names on model load
- Verify naming conventions match
- Check hierarchy structure (traverse)

**Animation Issues:**
- Axes and signs are fixed; a part opening wrongly means the *frame* or the
  *hinge edge* is wrong, not the rotation
- Check the `[DoorController] Car frame (...)` console line — `bounds` means the
  wheel empties weren't found and the solver is guessing
- Correct a stubborn model with `parts.hinges.<mesh>.edge` / `.flip` in cars.json

## Deployment Considerations

**Asset Pipeline:**
- Ensure GLB compression (DRACO enabled)
- Verify mesh names survive compression
- Test on target devices (mobile/desktop)

**Performance Monitoring:**
- Track FPS during animations
- Monitor memory usage over time
- Profile GSAP timeline overhead

**Fallback Strategy:**
- Detect low-end devices
- Disable animations if FPS < 30
- Use instant state changes instead



Required Meshes:
├─ car_door_left          (left front door)
├─ car_door_right         (right front door)
├─ car_door_back_left     (left rear door)
├─ car_door_back_right    (right rear door)
├─ car_caput              (hood)
└─ car_trunk              (trunk)

Optional (will move with parent):
├─ car_window_left
├─ car_window_right
├─ car_window_back_left
├─ car_window_back_right
├─ car_window_back
├─ door_left_attach
├─ door_right_attach
└─ caput_attach, back_attach, etc.