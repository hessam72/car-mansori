import { DoorController } from "../DoorController";
import { togglePart } from "./togglePart";

// Track open state of each part (must match togglePart.ts)
const partStates: Record<string, boolean> = {
  car_door_left: false,
  car_door_right: false,
  car_door_back_left: false,
  car_door_back_right: false,
  car_caput: false,
  car_trunk: false,
};

/**
 * Closes all open car parts by toggling them back to closed state.
 * @param controller - Instance of DoorController
 */
export function resetAllParts(controller: DoorController) {
  for (const name in partStates) {
    if (partStates[name]) {
      partStates[name] = false;
      togglePart(name, controller);
    }
  }
}
