# Car Hinge Setup Guide

How doors, hood and trunk find their hinges, what a GLB has to provide, and what
to do when a model still opens wrongly.

Related: [CAR_MODEL_NAMING_GUIDE.md](./CAR_MODEL_NAMING_GUIDE.md) for the full
mesh naming reference, [CAR_PARTS_ANIMATION_ARCHITECTURE.md](./CAR_PARTS_ANIMATION_ARCHITECTURE.md)
for the surrounding system.

---

## The short version

Give the GLB these seven nodes and everything else is automatic:

```
Wheel_FL   Wheel_FR   Wheel_RL   Wheel_RR      ← empties at the wheel centres
car_door_left   car_door_right                 ← separate meshes
car_caput       car_trunk
```

Orientation, up-axis and scale do **not** matter. You do not need to place
pivots, zero transforms, or apply rotations before export.

---

## Why the wheels

The old solver hardcoded one axis convention: doors rotated about local Z, hood
and trunk about local Y. That only holds for a GLB exported one particular way,
which is why every new model needed its angles re-tuned and why some parts swung
into the car or dropped through the floor.

Nothing about a part's own transform tells you where the front of the car is. In
the test model (`public/scene-optimized.glb`) the scene root stacks three ±90° X
rotations, and each panel carries its own ~120° quaternion plus a non-uniform
scale like `[0.32, 1.03, 1.06]`. A door's local +X points nowhere meaningful.

The four wheel empties do tell you, unambiguously and in any orientation:

```
forward = normalise( midpoint(FL, FR) − midpoint(RL, RR) )
right   = normalise( midpoint(FR, RR) − midpoint(FL, RL) )
up      = right × forward
```

That's the **car frame** (`lib/car/carFrame.ts`). Every hinge is then expressed
in it, so one set of rules works for every model.

---

## What the solver does

1. **Derive the car frame** — from the wheels, or the fallbacks below.
2. **Measure each part along that frame.** The part's world-space vertices are
   projected onto `forward` / `right` / `up`. A world-space bounding box would
   be axis-aligned to the *world*, so it over-reports every edge the moment the
   car sits at an angle in the scene.
3. **Place the hinge** on the correct edge:

   | Part | along the car | across | height |
   |---|---|---|---|
   | doors | **front** edge | part's own centre | mid-height |
   | hood | **rear** edge (at the windshield) | centre | top skin |
   | trunk | **front** edge (at the cabin) | centre | top skin |

4. **Orient the pivot to the car frame**, so its local axes are always
   `X = passenger side`, `Y = up`, `Z = rear`, and parent it to the model root
   (an intermediate node with scale would otherwise skew those axes).
5. **Rotate on fixed axes with fixed signs.** Because step 4 normalised the
   frame, these are constants rather than something to tune per model:

   | Part | axis | sign |
   |---|---|---|
   | left door | Y | − |
   | right door | Y | + |
   | hood | X | + |
   | trunk | X | − |

---

## Blender export checklist

- [ ] Doors, hood and trunk are **separate objects**, not joined to the body.
- [ ] They are named exactly `car_door_left`, `car_door_right`, `car_caput`,
      `car_trunk` (plus `car_door_back_left` / `car_door_back_right` on a
      4-door). Lowercase, underscores.
- [ ] Four empties named `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, `Wheel_RR` sit at
      the wheel centres. `_FL` is the **driver side front** on a left-hand-drive
      car — i.e. the side that is on your left when sitting in the car facing
      forward. Getting L and R swapped mirrors the whole frame.
- [ ] Export as glTF 2.0 (.glb). DRACO compression is fine — names survive it.

You do **not** need to set object origins at the hinge line, apply rotations, or
match any particular up-axis. The solver measures geometry, not transforms.

Parts the model lacks are simply skipped: a coupe with no `car_door_back_*`
logs them as absent and the UI hides those toggles. That's expected, not an
error.

---

## Checking a model: `?hinges=1`

Open the configurator with the query flag:

```
/car/sample-car?hinges=1
```

You get, per part, an axes gizmo at the computed hinge — **red = passenger
side, green = up, blue = rear** — and a gold box around the part it drives. The
gizmos draw through the bodywork, so a hinge buried inside a panel is still
visible. The console also prints the derived frame, how it was derived
(`wheels` / `bounds` / `override`), and every hinge position.

Read it like this:

| What you see | What it means |
|---|---|
| Green arrow points sideways or down | The frame is wrong — check the wheel empties |
| Green up, blue toward the **front** | L/R wheel empties are swapped |
| Frame correct, hinge on the wrong edge | Override `edge` for that part (below) |
| Part opens the right way but too far | Override `angleDeg` |
| No gizmo for a part | The mesh name doesn't match, or it has no geometry |

---

## Fallbacks when there are no wheel empties

The solver degrades rather than failing:

1. **Wheels** — the good path, described above.
2. **Bounds** — assumes the glTF `+Y` up convention, takes the longer horizontal
   extent as the car's length, and uses `car_caput`'s position to decide which
   end is the front.
3. **Override** — explicit axes in `cars.json`, which beat both.

The console line `[DoorController] Car frame (bounds):` tells you when you have
dropped to the guess. Adding the wheel empties is nearly always the better fix.

---

## Per-model overrides

Add an optional `parts` block to the car's entry in `public/config/cars.json`.
Every field is optional; anything omitted is auto-derived.

```json
{
  "id": "sample-car",
  "model_path": "/scene-optimized.glb",
  "parts": {
    "doorAngleDeg": 70,
    "hoodAngleDeg": 45,
    "trunkAngleDeg": 80,
    "durationSec": 1.2,

    "frame": {
      "forward": [1, 0, 0],
      "up": [0, 1, 0]
    },

    "hinges": {
      "car_caput": { "edge": "rear", "angleDeg": 60 },
      "car_trunk": { "flip": true }
    }
  }
}
```

| Field | Effect |
|---|---|
| `doorAngleDeg` / `hoodAngleDeg` / `trunkAngleDeg` | Opening angle per part kind |
| `durationSec` | Animation length |
| `frame.forward` / `frame.up` | World-space axes, overriding detection entirely |
| `hinges.<mesh>.edge` | `"front"` or `"rear"` — which end of the car the hinge sits on |
| `hinges.<mesh>.angleDeg` | Angle for this one part |
| `hinges.<mesh>.flip` | Reverse the opening direction |

`frame` is a blunt instrument — reach for it only when the wheel empties can't
be added to the model. Fixing the GLB is the durable fix; an override has to be
maintained for every car that shares the problem.

---

## Troubleshooting

**A door swings into the cabin.** The frame's `right` is inverted — `Wheel_FL`
and `Wheel_FR` are swapped in the GLB. Check with `?hinges=1`: the red axis
should point at the passenger side.

**The hood dives toward the ground.** Its hinge is on the front edge instead of
the rear. If the frame gizmo is correct, the hood mesh probably extends past the
windshield; set `hinges.car_caput.edge` explicitly.

**The trunk opens toward the car.** Same class of problem at the other end —
the trunk hinges at its front (cabin) edge, not its rearmost point.

**Everything rotates about the wrong axis.** The frame is wrong, not the
hinges. Look at the `Car frame (...)` console line: if it says `bounds`, the
wheel empties weren't found — check their names and casing.

**A part doesn't move at all.** Its mesh name doesn't match, or it has no
geometry under it. `[DoorController] Parts absent from this model:` lists what
was skipped.
