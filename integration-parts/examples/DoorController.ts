import * as THREE from "three";
import { gsap } from "gsap";

export class DoorController {
  public leftDoorPivot: THREE.Object3D;
  public rightDoorPivot: THREE.Object3D;
  public rightBackDoorPivot: THREE.Object3D;
  public leftBackDoorPivot: THREE.Object3D;
  public hoodPivot: THREE.Object3D;
  public trunkPivot: THREE.Object3D;

  // store original pivot positions for movement animations
  private pivotBasePositions: Map<THREE.Object3D, THREE.Vector3> = new Map();
  private leftDoorMax: number;
  private rightDoorMax: number;
  private hoodMax: number;
  private trunkMax: number;
  private duration: number;
  constructor(
    private scene: THREE.Scene,
    options: {
      doorAngleDeg?: number; // degrees
      hoodAngleDeg?: number;
      trunkAngleDeg?: number;
      durationSec?: number;
    } = {}
  ) {
    // Replace these names with your actual mesh names
    console.log("gltf: ", scene);
    const leftFrontDoor = scene.getObjectByName("car_door_left") as THREE.Mesh;
    const rightFrontDoor = scene.getObjectByName(
      "car_door_right"
    ) as THREE.Mesh;

    const rightBackDoor = scene.getObjectByName(
      "car_door_back_left"
    ) as THREE.Mesh;
    const leftBackDoor = scene.getObjectByName(
      "car_door_back_right"
    ) as THREE.Mesh;

    // const hood = scene.getObjectByName("car_door_right") as THREE.Mesh;
    // const trunk = scene.getObjectByName("car_door_right") as THREE.Mesh;
    const hood = scene.getObjectByName("car_caput") as THREE.Mesh;
    const trunk = scene.getObjectByName("car_trunk") as THREE.Mesh;

    if (!leftFrontDoor || !rightFrontDoor || !hood || !trunk) {
      console.warn("DoorController: one or more parts not found by name");
    }

    // Create pivot (hinge) objects for each part
    this.leftDoorPivot = this.createHingePivot(
      scene,
      leftFrontDoor,
      "left",
      "car_window_left",
      [
        "door_left_attach",
        "door_left_attach_2",
        "door_left_attach_3",
        "door_dside_f",
      ]
    );
    this.rightDoorPivot = this.createHingePivot(
      scene,
      rightFrontDoor,
      "right",
      "car_window_right",
      [
        "door_right_attach",
        "door_right_attach_2",
        "door_right_attach_3",
        "door_dside_f001",
      ]
    );

    this.rightBackDoorPivot = this.createHingePivot(
      scene,
      rightBackDoor,
      "right",
      "car_window_back_left",
      ["door_left_back_attach", "Plane191"]
    );
    this.leftBackDoorPivot = this.createHingePivot(
      scene,
      leftBackDoor,
      "left",
      "car_window_back_right",
      ["door_right_back_attach", "Plane192"]
    );

    this.hoodPivot = this.createHingePivot(scene, hood, "hood", "", [
      "caput_attach",
      "Plane002",
      "Object019",
      "Object013"
    ]);
    this.trunkPivot = this.createHingePivot(
      scene,
      trunk,
      "trunk",
      "car_window_back",
      [
        "back_attach",
        "back_attach_2",
        "back_attach_3",
        "back_attach_4",
        "Object008",
        "Object040",
        "Object024",
        "Object023",
        "Object026",
        // "Object099",
        // "Plane190",
        // "Plane189",
        // "Object096"
      ]
    );

    // Optional: add debug cubes at each hinge
    // [
    //   // this.leftDoorPivot,
    //   // this.leftBackDoorPivot,
    //   // this.rightBackDoorPivot,
    //   // this.rightDoorPivot,
    //   // this.hoodPivot,
    //   this.trunkPivot,
    // ].forEach((pivot) => {
    //   if (pivot) this.addDebugHinge(pivot);
    // });

    // default angles if user didn’t pass them:
    const {
      doorAngleDeg = 70,
      hoodAngleDeg = 25,
      trunkAngleDeg = 120,
      durationSec = 1.0,
    } = options;

    // store base positions
    // used to reset positions after updating them
    [
      this.leftDoorPivot,
      this.rightDoorPivot,
      this.rightBackDoorPivot,
      this.leftBackDoorPivot,
      this.hoodPivot,
      this.trunkPivot,
    ].forEach((pivot) => {
      if (pivot) this.pivotBasePositions.set(pivot, pivot.position.clone());
    });

    // convert to radians and store
    this.leftDoorMax = THREE.MathUtils.degToRad(doorAngleDeg);
    this.rightDoorMax = THREE.MathUtils.degToRad(doorAngleDeg);
    this.hoodMax = THREE.MathUtils.degToRad(hoodAngleDeg);
    this.trunkMax = THREE.MathUtils.degToRad(trunkAngleDeg);

    this.duration = durationSec;
  }

  // private createHingePivot(
  //   carModel: any,
  //   mesh: THREE.Mesh,
  //   part: "left" | "right" | "hood" | "trunk",
  //   windowName: string = null
  // ): THREE.Object3D {
  //   // Ensure bounding box is computed
  //   mesh.geometry.computeBoundingBox();
  //   const bbox = mesh.geometry.boundingBox!;
  //   const hingeLocal = new THREE.Vector3();

  //   // Determine hinge point in local coordinates based on part type
  //   switch (part) {
  //     case "left":
  //       // Door hinge at *front* (max Y), inner side (toward car center = max X)
  //       // hingeLocal.x = bbox.max.x ; for tigo 8
  //       hingeLocal.x = bbox.min.x;
  //       hingeLocal.y = bbox.min.y;
  //       hingeLocal.z = (bbox.min.z + bbox.max.z) / 2;
  //       break;

  //     case "right":
  //       // Door hinge at *front* (max Y), inner side (toward car center = min X)
  //       hingeLocal.x = bbox.min.x;
  //       hingeLocal.y = bbox.min.y;
  //       hingeLocal.z = (bbox.min.z + bbox.max.z) / 2;
  //       break;

  //     case "hood":
  //       // Hood hinge at the *rear* of hood (near windshield = min Y), top of hood (min Z)
  //       hingeLocal.x = (bbox.min.x + bbox.max.x) / 2;
  //       hingeLocal.y = bbox.max.y;
  //       hingeLocal.z = bbox.min.z;
  //       break;

  //     case "trunk":
  //       // Trunk hinge at the *front* of trunk (toward cabin = max Y), top of trunk (min Z)
  //       hingeLocal.x = (bbox.min.x + bbox.max.x) / 2;

  //       hingeLocal.y = bbox.max.y;
  //       hingeLocal.z = (bbox.min.z + bbox.max.z) / 2;
  //       break;
  //   }

  //   // Convert hinge point to world coordinates
  //   const hingeWorld = mesh.localToWorld(hingeLocal.clone());
  //   const parent = mesh.parent!;
  //   // Convert world hinge to parent's local coordinates
  //   const hingeParent = parent.worldToLocal(hingeWorld.clone());

  //   // Create pivot object at hinge
  //   const pivot = new THREE.Object3D();
  //   parent.add(pivot);
  //   pivot.position.copy(hingeParent);

  //   // Attach mesh to pivot so it keeps its world transform (hinge is now origin of mesh)
  //   pivot.attach(mesh);
  //   // Now attach any window meshes:
  //   if (windowName) {
  //     const winMesh = carModel.getObjectByName(windowName) as THREE.Mesh;
  //     if (winMesh) {
  //       // ensure worldTransform is up-to-date
  //       winMesh.updateMatrixWorld(true);
  //       pivot.attach(winMesh);
  //     } else {
  //       console.warn(`Window mesh "${windowName}" not found.`);
  //     }
  //   }
  //   return pivot;
  // }
  private createHingePivot(
    carModel: any,
    mesh: THREE.Mesh,
    part: "left" | "right" | "hood" | "trunk",
    windowName: string | null = null,
    handleNames: string | string[] = []
  ): THREE.Object3D {
    // ensure handleNames is an array
    const handles = Array.isArray(handleNames)
      ? handleNames
      : handleNames
      ? [handleNames]
      : [];

    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox!;
    const hingeLocal = new THREE.Vector3();

    switch (part) {
      case "left":
        // Door hinge at *front* (max Y), inner side (toward car center = max X)
        // hingeLocal.x = bbox.max.x ; for tigo 8
        hingeLocal.x = bbox.min.x;
        hingeLocal.y = bbox.min.y;
        hingeLocal.z = (bbox.min.z + bbox.max.z) / 2;
        break;

      case "right":
        // Door hinge at *front* (max Y), inner side (toward car center = min X)
        hingeLocal.x = bbox.min.x;
        hingeLocal.y = bbox.min.y;
        hingeLocal.z = (bbox.min.z + bbox.max.z) / 2;
        break;

      case "hood":
        // Hood hinge at the *rear* of hood (near windshield = min Y), top of hood (min Z)
        hingeLocal.x = (bbox.min.x + bbox.max.x) / 2;
        hingeLocal.y = bbox.max.y;
        hingeLocal.z = bbox.min.z;
        break;

      case "trunk":
        // Trunk hinge at the *front* of trunk (toward cabin = max Y), top of trunk (min Z)
        hingeLocal.x = (bbox.min.x + bbox.max.x) / 2;

        hingeLocal.y = bbox.max.y;
        hingeLocal.z = (bbox.min.z + bbox.max.z) / 2;
        break;
    }
    // world ↔ parent local conversion
    const hingeWorld = mesh.localToWorld(hingeLocal.clone());
    const parent = mesh.parent!;
    const hingeParent = parent.worldToLocal(hingeWorld.clone());

    // build pivot
    const pivot = new THREE.Object3D();
    parent.add(pivot);
    pivot.position.copy(hingeParent);

    // attach the door
    pivot.attach(mesh);

    // optional: attach the window
    if (windowName) {
      const winMesh = carModel.getObjectByName(windowName) as THREE.Mesh;
      if (winMesh) {
        winMesh.updateMatrixWorld(true);
        pivot.attach(winMesh);
      } else {
        console.warn(`Window mesh "${windowName}" not found.`);
      }
    }

    // optional: attach handle(s)
    handles.forEach((hName) => {
      const handleMesh = carModel.getObjectByName(hName) as THREE.Mesh;
      if (handleMesh) {
        handleMesh.updateMatrixWorld(true);
        pivot.attach(handleMesh);
      } else {
        console.warn(`Handle mesh "${hName}" not found.`);
      }
    });

    return pivot;
  }

  /**
   * Generic movement animation: moves a pivot from its base position by the given offset when opening,
   * and back to base when closing.
   */
  private animateMovement(
    pivot: THREE.Object3D,
    offset: THREE.Vector3,
    isOpen: boolean
  ) {
    const base = this.pivotBasePositions.get(pivot)!;
    const targetPos = isOpen ? base.clone().add(offset) : base.clone();
    gsap.to(pivot.position, {
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      duration: this.duration,
      ease: "power2.inOut",
    });
  }

  private addDebugHinge(pivot: THREE.Object3D) {
    const size = 0.3;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    // Place cube at pivot’s position (relative to pivot.parent)
    cube.position.copy(pivot.position);
    pivot.parent!.add(cube);
  }

  // Animate left door (true = open, false = closed)

  public openLeftFrontDoor(isOpen: boolean) {
    const target = isOpen ? this.leftDoorMax : 0;
    gsap.to(this.leftDoorPivot.rotation, {
      // z: -target, for tigo 8
      y: -target,
      duration: this.duration,
      ease: "power2.inOut",
    });

    this.animateMovement(
      this.leftDoorPivot,
      new THREE.Vector3(0.11, 0, 0),
      isOpen
    );
  }

  public openRightFrontDoor(isOpen: boolean) {
    const target = isOpen ? -this.rightDoorMax : 0;
    gsap.to(this.rightDoorPivot.rotation, {
      y: -target,
      duration: this.duration,
      ease: "power2.inOut",
    });

    this.animateMovement(
      this.rightDoorPivot,
      new THREE.Vector3(0.11, 0, 0),
      isOpen
    );
  }

  public openLeftBackDoor(isOpen: boolean) {
    const target = isOpen ? this.leftDoorMax : 0;
    gsap.to(this.leftBackDoorPivot.rotation, {
      y: target,
      duration: this.duration,
      ease: "power2.inOut",
    });
  }

  public openRightBackDoor(isOpen: boolean) {
    const target = isOpen ? -this.rightDoorMax : 0;
    gsap.to(this.rightBackDoorPivot.rotation, {
      y: target,
      duration: this.duration,
      ease: "power2.inOut",
    });
  }

  public openHood(isOpen: boolean) {
    const target = isOpen ? -this.hoodMax : 0;
    gsap.to(this.hoodPivot.rotation, {
      z: target,
      duration: this.duration,
      ease: "power2.inOut",
    });
    this.animateMovement(
      this.hoodPivot,
      new THREE.Vector3(0.18, 0.3, 0),
      isOpen
    );
  }

  public openTrunk(isOpen: boolean) {
    const target = isOpen ? this.trunkMax : 0;
    console.log("angle: ", target);
    gsap.to(this.trunkPivot.rotation, {
      z: target,
      duration: this.duration,
      ease: "power2.inOut",
    });
    this.animateMovement(
      this.trunkPivot,
      new THREE.Vector3(-0.28, 0.3, 0),
      isOpen
    );
  }
}
// -------------------------------------------------
// New: dispatch clicks by object name to open functions
// -------------------------------------------------

// -------------------------------------------------
// Part click dispatcher with built-in open/close state
// -------------------------------------------------

// tracks open state of each part
const partStates: Record<string, boolean> = {
  car_door_left: false,
  car_door_right: false,
  car_door_back_left: false,
  car_door_back_right: false,
  car_caput: false,
  car_trunk: false,
};

/**
 * Toggles the named part’s open state and invokes the matching animation.
 */
export function togglePart(name: string, controller: DoorController) {
          // alert('toggle part')

  if(!controller) {
     console.warn(`No Controller init yet!`);
    return;
  }
  if (!(name in partStates)) {
    console.warn(`No part found with name: ${name}`);
    return;
  }
  const isOpen = !partStates[name];
  partStates[name] = isOpen;
  switch (name) {
    case "car_door_left":
      controller.openLeftFrontDoor(isOpen);
      break;
    case "car_door_right":
      controller.openRightFrontDoor(isOpen);
      break;
    case "car_door_back_right":
      controller.openLeftBackDoor(isOpen);
      break;
    case "car_door_back_left":
      controller.openRightBackDoor(isOpen);
      break;
    case "car_caput":
      controller.openHood(isOpen);
      break;
    case "car_trunk":
      controller.openTrunk(isOpen);
      break;
  }
}

/**
 * Resets all parts to closed state.
 */
export function resetAllParts(controller: DoorController) {
  for (const name in partStates) {
    if (partStates[name]) {
      partStates[name] = false;
      togglePart(name, controller);
    }
  }
}
/**
 * Example usage in a click handler:
 *
 * canvasDomElement.addEventListener('click', (e) => {
 *   const intersect = getIntersectedObject(e)
 *   if (intersect) {
 *     togglePart(intersect.object.name, doorControllerInstance)
 *   }
 * })
 */
