/**
 * Display names for the openable panels.
 *
 * Shared by /car's ViewDock and /store's product drawer so the two surfaces
 * can't drift apart. The keys are `PART_SPECS` keys from lib/DoorController.ts.
 */
export const DOOR_LABELS: Record<string, string> = {
  car_door_left: 'Left Door',
  car_door_right: 'Right Door',
  car_door_back_left: 'Left Rear',
  car_door_back_right: 'Right Rear',
  car_caput: 'Hood',
  car_trunk: 'Trunk',
}
