import React, { useEffect, useState, useRef, useCallback } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// import { useSeats } from "@CTX/SeatsContext";
import { getGlobalState } from "@GLOBALS";
import { playGlobalSound, playPositionalSound, stopAllSounds } from "../utils/soundPlayer";

const globalState = getGlobalState();

interface CameraControllerProps {
  controlsRef: React.RefObject<any>;
  onCameraTransitionComplete: (data: any) => void;

  onCarPartClicked: (
    partName: string,
    partObj: THREE.Object3D

  ) => void;

  CalculateClickValidity: () => boolean;
  onMount: () => void;
  onResetCamera: (resetCamera: () => void) => void;
  // deviceType: DeviceType
}

let pass_data: any = {
  seat_no: null,
  seat_id: null,
  selectFromMap: false,
  price: "0",
  isSwitch: false, // for refreshing the info component when user switch to side seat
  isChangeCamera: false, // for cheking if camera is switching from view btns and hence no need to show seat info
};




let cam_rollback = false;
let seatSelectionAvailable = true;

const CameraController: React.FC<CameraControllerProps> = ({
  controlsRef,
  onCameraTransitionComplete,
  onResetCamera,
  onCarPartClicked,
  CalculateClickValidity,
  onMount,
}) => {
  const { camera, gl, scene } = useThree();
  const [targetPosition, setTargetPosition] = useState(new THREE.Vector3());
  const [targetLookAt, setTargetLookAt] = useState(new THREE.Vector3());
  // const [distanceFromCenter, setDistanceFromCenter] = useState(Number);
  const [isAnimating, setIsAnimating] = useState(false);
  const finishedFlag = useRef(false)
  const carIsOn = useRef(false)



  // Initialize a ref to store the last camera position
  const lastCameraPosition = useRef<THREE.Vector3 | null>(null);
  const lastCameraLookAt = useRef<THREE.Vector3 | null>(null);


  const changeCameraView = useCallback((position: THREE.Vector3, lookAt: THREE.Vector3) => {
    seatSelectionAvailable = true;
    lastCameraPosition.current = position; // Save current camera position
    lastCameraLookAt.current = lookAt; // Save current camera pov
    pass_data.isChangeCamera = true;
    setTargetPosition(position);
    setTargetLookAt(lookAt);
    setIsAnimating(true);
  }, []);




  const resetCamera = () => {
    cam_rollback = true;
    seatSelectionAvailable = true;
    // console.log("reset camera");
    // const newPosition = new THREE.Vector3(0, 4.7, -5.3);
    // const newLookAt = new THREE.Vector3(0, -150, 300);

    const newPosition = globalState.DEFAULT_CAMERA_POSITION;
    const newLookAt = globalState.DEFAULT_CAMERA_TARGET;

    setTargetPosition(newPosition);
    setTargetLookAt(newLookAt);
    setIsAnimating(true);

    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }
  };




  const handleClick = async (intersect: any) => {
    const clickedObject = intersect.object;
    const clickedObjectCode = clickedObject.name;

    console.log('clicked obj code: ', clickedObjectCode)


    if (!CalculateClickValidity()) {
      return;
    }
    if (clickedObjectCode) {
      if (clickedObjectCode == "car_honk") {
        await playGlobalSound("/audio/effect/horn.mp3", 0.7);


      } if (clickedObjectCode == "car_start") {

        if (carIsOn.current) {
          stopAllSounds()
          carIsOn.current = false

        } else {
          carIsOn.current = true
          // say you want engine revving to come from "Car_Engine" mesh:
          await playPositionalSound(
            "/audio/effect/start_engine.mp3",
            scene,          // pass the root containing the mesh
            "car_caput",      // name of the mesh
            1.3,               // volume
            2,                 // refDistance
            50                 // maxDistance
          );

        }


      }


      // open specific part when clicking on it
      if (clickedObjectCode.startsWith("car")) {

        onCarPartClicked(clickedObjectCode, clickedObject)


      }








      // move camera to car part logic
      // if (clickedObjectCode.startsWith("car")) {
      //   onCarPartClicked(clickedObjectCode, clickedObject)


      // }
    }



  };

  // useEffect(() => {
  //   onResetCamera(resetCamera);

  //   const handleLeftClick = (event) => {
  //     event.preventDefault();

  //     let adjustedY = event.clientY;

  //     if (/Mobi|Android/i.test(navigator.userAgent)) {
  //       const visualHeight =
  //         window.visualViewport?.height || window.innerHeight;
  //       adjustedY = (event.clientY / visualHeight) * window.innerHeight;
  //     }

  //     // Normalize coordinates for Three.js
  //     const mouse = new THREE.Vector2(
  //       (event.clientX / window.innerWidth) * 2 - 1,
  //       -(adjustedY / window.innerHeight) * 2 + 1
  //     );

  //     const raycaster = new THREE.Raycaster();
  //     raycaster.setFromCamera(mouse, camera);
  //     const intersects = raycaster.intersectObjects(scene.children, true);

  //     if (intersects.length > 0) handleClick(intersects[0]);
  //   };

  //   gl.domElement.addEventListener("click", handleLeftClick);
  //   return () => {
  //     gl.domElement.removeEventListener("click", handleLeftClick);
  //   };
  // }, [camera, gl, scene]);

  const downPos = useRef<{ x: number; y: number } | null>(null)
  const CLICK_THRESHOLD = 5  // pixels
  useEffect(() => {
    onResetCamera(resetCamera);
    const handlePointerDown = (e: any) => {
      downPos.current = { x: e.clientX, y: e.clientY }
    }
    const handleTouchDown = (e: any) => {
      const t = e.changedTouches[0]
      downPos.current = { x: t.clientX, y: t.clientY }
    }
    // Unified click handler for pointer & touch
    const handlePointerUp = (e: PointerEvent | MouseEvent | TouchEvent) => {
      // Prevent default browser actions (e.g. scrolling)
      e.preventDefault();
      // Extract clientX/Y for both pointer and touch events
      let clientX: number, clientY: number;
      if ('changedTouches' in e && e.changedTouches.length > 0) {
        // TouchEvent: take first touch
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else {
        // PointerEvent or MouseEvent
        clientX = (e as PointerEvent).clientX;
        clientY = (e as PointerEvent).clientY;
      }

      if (downPos.current) {
        const dx = clientX - downPos.current.x
        const dy = clientY - downPos.current.y
        const dist = Math.hypot(dx, dy)

        // console.log('click dist', dist)
        if (dist > CLICK_THRESHOLD) {
          return  // only fire if “click” not a drag :contentReference[oaicite:0]{index=0}
        }
      }
      downPos.current = null

      // 1) Get the canvas’ on‐screen rect (accounts for CSS/layout) :contentReference[oaicite:4]{index=4}
      const rect = gl.domElement.getBoundingClientRect();
      // 2) Map to normalized device coords (–1…+1) 
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;

      // 3) Optionally sync canvas pixel ratio for HiDPI accuracy :contentReference[oaicite:5]{index=5}
      //    (if you’re not already setting <Canvas pixelRatio> in R3F)
      // gl.setPixelRatio?.(window.devicePixelRatio);

      // 4) Raycast from camera through that point :contentReference[oaicite:6]{index=6}
      const mouse = new THREE.Vector2(x, y);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      // 5) Intersect against your scene or seat objects
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        handleClick(intersects[0]);       // hit detected! 
      }
    };

    // 6) Attach unified pointer & touch listeners
    const canvasEl = gl.domElement;
    canvasEl.addEventListener('pointerdown', handlePointerDown, { passive: false })
    canvasEl.addEventListener('pointerup', handlePointerUp, { passive: false })

    // canvasEl.addEventListener('touchstart', handleTouchDown, { passive: false });            // modern browsers :contentReference[oaicite:7]{index=7}
    // canvasEl.addEventListener('touchend', handlePointerUp, { passive: false });            // fallback for older iOS :contentReference[oaicite:8]{index=8}

    return () => {
      canvasEl.removeEventListener('pointerdown', handlePointerDown);            // modern browsers :contentReference[oaicite:7]{index=7}
      // canvasEl.removeEventListener('touchstart', handleTouchDown);
      canvasEl.removeEventListener('pointerup', handlePointerUp);
      // canvasEl.removeEventListener('touchend', handlePointerUp);
    };
  }, []);

  // useFrame(() => {
  //   if (isAnimating) {
  //     let camSpeed: number = 0.06;
  //     if (cam_rollback) {
  //       camSpeed = 0.11;
  //     }
  //     camera.position.lerp(targetPosition, camSpeed);
  //     camera.lookAt(targetLookAt);
  //     if (camera.position.distanceTo(targetPosition) < 0.01) {
  //       // console.clear()
  //       setIsAnimating(false);
  //       if (controlsRef.current && controlsRef.current.target) {
  //         controlsRef.current.target.copy(targetLookAt);
  //       }
  //       if (!cam_rollback) {
  //         onCameraTransitionComplete(pass_data); // Trigger the callback when animation is done
  //       }
  //     }
  //   }
  // });
  // In a separate effect:
  useEffect(() => {
    if (finishedFlag.current) {
      setIsAnimating(false);
      onCameraTransitionComplete(pass_data);
      finishedFlag.current = false

    }
  }, [finishedFlag.current]);




  useFrame(() => {
    if (isAnimating) {
      let camSpeed: number = 0.16;
      if (cam_rollback) {
        camSpeed = 0.17;
      }

      camera.position.lerp(targetPosition, camSpeed);
      camera.lookAt(targetLookAt);


      if (camera.position.distanceTo(targetPosition) < 0.01) {
        setIsAnimating(false);
        finishedFlag.current = true;
        if (controlsRef.current && controlsRef.current.target) {
          controlsRef.current.target.copy(targetLookAt);
        }
        if (!cam_rollback) {
          onCameraTransitionComplete(pass_data); // Trigger the callback when animation is done
        }
      }

    }
  });


  useEffect(() => {
    // Signal to the parent component that CameraController is fully mounted
    if (onMount) {
      onMount();
    }
  }, [onMount]);

  // Expose changeCameraView to the ref
  React.useImperativeHandle(controlsRef, () => ({
    changeCameraView,
    resetCamera
  }));

  return null;
};

export default CameraController;
