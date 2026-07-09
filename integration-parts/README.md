# 3D Car Parts Animation - Implementation Guide

## Dependencies

```bash
npm install three @react-three/fiber @react-three/drei gsap
```

## Core Concept

Use **pivot-based rotation** with GSAP animations to open/close car parts (doors, hood, trunk). The system:
1. Creates pivot points (hinges) at correct positions
2. Attaches meshes to pivots
3. Animates pivot rotation instead of mesh directly
4. Tracks open/closed state

## Implementation Steps

### 1. Create DoorController Class

```typescript
// utils/DoorController.ts
import * as THREE from "three";
import { gsap } from "gsap";

export class DoorController {
  public leftDoorPivot: THREE.Object3D;
  public rightDoorPivot: THREE.Object3D;
  // ... other pivots

  constructor(
    private scene: THREE.Scene,
    options: {
      doorAngleDeg?: number;
      hoodAngleDeg?: number;
      trunkAngleDeg?: number;
      durationSec?: number;
    } = {}
  ) {
    // Get meshes by name
    const leftFrontDoor = scene.getObjectByName("car_door_left") as THREE.Mesh;

    // Create pivot for each part
    this.leftDoorPivot = this.createHingePivot(
      scene,
      leftFrontDoor,
      "left",
      "car_window_left", // optional window mesh
      ["door_left_attach"] // optional handle meshes
    );

    // Store angles and duration
    this.leftDoorMax = THREE.MathUtils.degToRad(options.doorAngleDeg || 70);
    this.duration = options.durationSec || 1.2;
  }

  private createHingePivot(
    carModel: any,
    mesh: THREE.Mesh,
    part: "left" | "right" | "hood" | "trunk",
    windowName?: string,
    handleNames?: string[]
  ): THREE.Object3D {
    // Calculate hinge point from bounding box
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox!;
    const hingeLocal = new THREE.Vector3();

    // Set hinge position based on part type
    switch (part) {
      case "left":
        hingeLocal.x = bbox.min.x; // inner edge
        hingeLocal.y = bbox.min.y; // front edge
        hingeLocal.z = (bbox.min.z + bbox.max.z) / 2;
        break;
      // ... other cases
    }

    // Convert to world coordinates
    const hingeWorld = mesh.localToWorld(hingeLocal.clone());
    const parent = mesh.parent!;
    const hingeParent = parent.worldToLocal(hingeWorld.clone());

    // Create pivot at hinge
    const pivot = new THREE.Object3D();
    parent.add(pivot);
    pivot.position.copy(hingeParent);

    // Attach door mesh to pivot
    pivot.attach(mesh);

    // Attach window if provided
    if (windowName) {
      const winMesh = carModel.getObjectByName(windowName);
      if (winMesh) pivot.attach(winMesh);
    }

    // Attach handles if provided
    handleNames?.forEach(hName => {
      const handleMesh = carModel.getObjectByName(hName);
      if (handleMesh) pivot.attach(handleMesh);
    });

    return pivot;
  }

  public openLeftFrontDoor(isOpen: boolean) {
    const target = isOpen ? this.leftDoorMax : 0;
    gsap.to(this.leftDoorPivot.rotation, {
      y: -target,
      duration: this.duration,
      ease: "power2.inOut",
    });
  }

  // ... similar methods for other parts
}
```

### 2. State Management

```typescript
// Track open/closed state
const partStates: Record<string, boolean> = {
  car_door_left: false,
  car_door_right: false,
  car_caput: false,
  car_trunk: false,
};

export function togglePart(name: string, controller: DoorController) {
  if (!(name in partStates)) return;

  const isOpen = !partStates[name];
  partStates[name] = isOpen;

  switch (name) {
    case "car_door_left":
      controller.openLeftFrontDoor(isOpen);
      break;
    // ... other cases
  }
}
```

### 3. Click Detection with Raycasting

```typescript
// In React component
const handlePointerUp = (e: PointerEvent) => {
  e.preventDefault();

  // Get canvas rect
  const rect = gl.domElement.getBoundingClientRect();

  // Normalize to device coords (-1 to +1)
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  // Raycast
  const mouse = new THREE.Vector2(x, y);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    handleClick(clickedObject.name); // Pass mesh name
  }
};

const handleClick = (meshName: string) => {
  // Toggle specific part
  if (meshName.startsWith("car")) {
    togglePart(meshName, controllerRef.current);
  }
};
```

### 4. Integration in React Component

```typescript
import { DoorController, togglePart } from './utils/DoorController';

function Scene() {
  const controllerRef = useRef<DoorController>();
  const carModelRef = useRef<THREE.Scene>();

  // Initialize controller after car model loads
  useEffect(() => {
    if (!carModelRef.current) return;

    const options = {
      doorAngleDeg: 70,
      hoodAngleDeg: 45,
      trunkAngleDeg: 80,
      durationSec: 1.2,
    };

    controllerRef.current = new DoorController(carModelRef.current, options);
  }, [carModelRef.current]);

  // Button handlers
  const openAllParts = () => {
    controllerRef.current.openLeftFrontDoor(true);
    controllerRef.current.openRightFrontDoor(true);
    controllerRef.current.openHood(true);
    controllerRef.current.openTrunk(true);
  };

  const closeAllParts = () => {
    controllerRef.current.openLeftFrontDoor(false);
    // ... close others
  };

  // Click handler
  const handlePartClicked = (partName: string) => {
    togglePart(partName, controllerRef.current);
  };

  return (
    <Canvas>
      <CameraController onCarPartClicked={handlePartClicked} />
      <primitive ref={carModelRef} object={carModel} />
    </Canvas>
  );
}
```

## Key Configuration Points

### Mesh Names
Update these to match your 3D model:
```typescript
const leftFrontDoor = scene.getObjectByName("car_door_left"); // Your door mesh name
const window = scene.getObjectByName("car_window_left");      // Your window mesh name
```

### Hinge Positions
Adjust based on your model's geometry:
```typescript
// For left door (hinge on left side)
hingeLocal.x = bbox.min.x; // or bbox.max.x depending on orientation
hingeLocal.y = bbox.min.y; // front or back edge
hingeLocal.z = (bbox.min.z + bbox.max.z) / 2; // center height
```

### Animation Angles
```typescript
const options = {
  doorAngleDeg: 70,   // Door opening angle
  hoodAngleDeg: 45,   // Hood opening angle
  trunkAngleDeg: 80,  // Trunk opening angle
  durationSec: 1.2,   // Animation duration
};
```

### Rotation Axes
Choose correct axis based on hinge orientation:
```typescript
// Y-axis rotation (vertical hinge)
gsap.to(pivot.rotation, { y: -target });

// Z-axis rotation (horizontal hinge)
gsap.to(pivot.rotation, { z: target });
```

## Architecture

```
Scene
  └─ Car Model (THREE.Scene)
       ├─ Door Mesh
       ├─ Window Mesh
       └─ Handle Mesh
            ↓
      DoorController creates:
       └─ Pivot (Object3D)
            └─ Door Mesh (attached)
            └─ Window Mesh (attached)
            └─ Handle Mesh (attached)
                 ↓
            GSAP animates pivot.rotation
```

## Troubleshooting

**Parts rotate from wrong point:**
- Check hinge position calculation in `createHingePivot`
- Verify bbox min/max usage

**Parts rotate in wrong direction:**
- Change rotation axis (x/y/z)
- Flip sign: `y: -target` vs `y: target`

**Window/handles don't move with door:**
- Ensure meshes are attached to pivot: `pivot.attach(mesh)`
- Call `mesh.updateMatrixWorld(true)` before attaching

**Animation stutters:**
- Verify GSAP is imported correctly
- Check duration and easing settings

## Performance Notes

- Pivot objects add minimal overhead (< 1KB each)
- GSAP animations are GPU-accelerated
- State tracking prevents animation conflicts
- No re-renders during animation (pure Three.js)

## Example Usage

See `examples/` folder for complete working code from production implementation.
