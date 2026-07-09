import { DoorController } from "../DoorController";

// Track open state of each part
const partStates: Record<string, boolean> = {
  car_door_left: false,
  car_door_right: false,
  car_door_back_left: false,
  car_door_back_right: false,
  car_caput: false,
  car_trunk: false,
};

/**
 * Toggles the named part's open state and invokes the matching animation.
 * @param name - The mesh name of the car part (e.g., "car_door_left")
 * @param controller - Instance of DoorController
 */
export function togglePart(name: string, controller: DoorController) {
  if (!controller) {
    console.warn(`No Controller initialized yet!`);
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
