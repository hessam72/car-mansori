"use client"
import * as THREE from 'three';
import { lazy, useEffect, useReducer, useRef } from 'react';
import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Circle, MeshReflectorMaterial, OrbitControls } from '@react-three/drei';
import { DRACOLoader, GLTFLoader } from 'three/examples/jsm/Addons.js';
import { Object3D, Vector3 } from 'three';
import { StyleCarParts, RestoreCarPartsMaterials } from '../utils/showDamagedParts'
import { initializeSounds } from "../utils/openTheDoor";
import { MoveCameraToCabin, ResetCamera } from "../utils/MoveCameraToCabin";
import CarInfoBox from './CarInfoBox';
import Modal from './Modal';
import { Box3 } from "three";

import { GLTF } from 'three/examples/jsm/Addons.js';
import { getGlobalState, setCAMERA_IS_ON_SEAT_POV, setDEFAULT_CAMERA_POSITION, setDEFAULT_CAMERA_TARGET, setIsClickValid } from '@GLOBALS';
import '@STYLES/carInfo.css';
// import { initializeDoorSounds, setupDoors, DoorConfig, DoorController } from '../utils/DoorController';

import Car‌BodyStatBox from './CarBodyStatusBox';

import { useDragClickHandler } from './useDragClickHandler';

import { PerspectiveCamera } from 'three';
import BodyButton from './buttons/BodyButton';
import CarBodyStatus from './CarBodyStatus';
import ResetCameraButton from './buttons/resetCamButton';
import ShowPartImgButton from './buttons/showPartImgButton';
import { PinchZoomCamera } from './PinchZoomCamera';
import { getAudioListener } from '../utils/soundPlayer';
import { DoorController, togglePart } from '../utils/DoorController';
import ARViewer from './ARViewer';
import { MdArrowBack, MdDirectionsCar, MdViewAgenda, MdViewInAr, MdViewKanban, MdViewModule } from 'react-icons/md';
import LightController from './LightController';
import CarLights from './CarLights';
import LightToggleButton from './buttons/LightToggleButton';
import { Effects } from './effects';
import OverlayLoader from './overlayLoader';
import ARViewer2 from './ARViewer2';


// import Stats from 'stats.js';




// Mapping statuses to colors
const statusColorMap: Record<string, string> = {
    replaced: "red",
    damaged: "yellow",
    scratch: "pink",
};

// Lazy-loaded components for better code splitting

const Loader = lazy(() => import('./Loader'));
const SceneLoader = lazy(() => import('./sceneLoading'));
const JoystickControl = lazy(() => import('./JoystickControl'));
const BackDropLoading = lazy(() => import('./BackDropLoading'));
const CameraController = lazy(() => import('./CameraController'));



// Initial reducer state for managing multiple related states
const initialState = {
    isSceneReady: false,
    isLoading: true,
    showInfo: false,
    showSuggestBtns: false,
    rightSeatDisable: false,
    leftSeatDisable: false,

};

// Reducer function to handle complex state logic
function sceneReducer(state, action) {
    switch (action.type) {
        case 'SET_SCENE_READY':
            return { ...state, isSceneReady: action.payload };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_SHOW_INFO':
            return { ...state, showInfo: action.payload };


        case 'TOGGLE_SUGGEST_BTNS':
            return { ...state, showSuggestBtns: action.payload };
        case 'TOGGLE_SEAT_DISABLED':
            return {
                ...state,
                rightSeatDisable: action.payload.right,
                leftSeatDisable: action.payload.left,
            };
        default:
            return state;
    }
}





const globalState = getGlobalState();


const SceneComponent: React.FC = () => {

    const rendererRef = useRef<THREE.WebGLRenderer>()

    const [isARMode, setIsARMode] = useState(false);
    const [isARMode2, setIsARMode2] = useState(false);
    const [lightsOn, setLightsOn] = useState(false);
    const lampNames = [
        {
            name: 'Headlight_L',
            color: 0xabe8ff,
            axis: 'x',
            frontOffset: -0.2,
            type: 'front',
        },
        {
            name: 'Headlight_R',
            color: 0xabe8ff,
            axis: 'x',
            frontOffset: .2,
            type: 'front',
        },
        {
            name: 'BrakeLight_L',
            color: 0xff0000,
            axis: 'x',
            backOffset: -0.07,
            type: 'back',
        },
        {
            name: 'BrakeLight_R',
            color: 0xff0000,
            axis: 'x',
            backOffset: -0.07,
            type: 'back',
        },
    ];

    const lightControllerRef = useRef();
    const [isDark, setIsDark] = useState(false);
    // Paths to GLB files for sequential loading
    // const sceneFile = '/206/garage-nolight.glb';
    const sceneFile = '/newFiles/draco-scene-main.glb';
    const car = '/206/206_final_lights.glb';
    // const car = '/206/206_final_lights-opt.glb';
    // const car = '/206/compressed_1751882795479_206_final.glb';

    const [carDetails, setCarDetails] = useState({
        manufacturer: "پژو",
        model: "206",
        price: "1,200,000 تومان",
        year: "1403",
        color: "سفید صدفی",
        fuelType: "بنزینی",
        mileage: "۱۵٬۰۰۰ کیلومتر",
        engineCondition: "سالم",
        chassisCondition: "سالم و پلمپ",
        bodyCondition: "سالم و بی‌خط و خش",
        insuranceValidity: "۶ ماه",
        gearbox: "اتوماتیک",
    });
    const [BodyStatusModal, setBodyStatusModal] = useState<ModalData>({
        title: 'وضعیت بدنه',
        imageUrl: '/img/door.png',
        description: 'درب جلو سمت راننده خط و خش جزیی',
    });
    const [isOrbitEnabled, setIsOrbitEnabled] = useState<boolean>(false);
    const [carLoaded, setCarLoaded] = useState<boolean>(false);
    const [isJoystickEnabled, setIsJoystickEnabled] = useState<boolean>(true);
    const [isInsideTheCar, setIsInsideTheCar] = useState<boolean>(false);
    const [isPartsOpen, setIsPartsOpen] = useState<boolean>(false);
    const [isShowBodyStatus, setIsShowBodyStatus] = useState<boolean>(false);
    const controllerRef = useRef<ReturnType<any>>();

    const [isModalOpen, setIsModalOpen] = useState(false); // Manage map state in parent

    const [reflectors, setReflectors] = useState<
        { position: [number, number, number]; size: [number, number] }[]
    >([]);
    const [state, dispatch] = useReducer(sceneReducer, initialState);
    const paintingRef = useRef<THREE.Group | null>(null);



    // const [gltf] = useState<GLTF | null>(null);

    const cameraRef = useRef<PerspectiveCamera>();
    // const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
    const [resetCamera, setResetCamera] = useState<() => void>(() => { });
    const controlsRef = useRef<any>();
    const carModelRef = useRef<any>();
    const soundInit = useRef<boolean>(false);
    const showResetCamBtn = useRef<boolean>(true);
    const isFocusOnPart = useRef<boolean>(false);
    const statusValue = useRef<number>(100);

    const { onMouseDown, onMouseMove, onMouseUp, isMouseDragging } = useDragClickHandler();
    const [loadedModels, setLoadedModels] = useState<Object3D[]>([]);
    // const [parde, setParde] = useState<THREE.Mesh | null>(null);



    const toggleCarLights = (value: any) => {
        // alert('changed')

        setLightsOn(value)

    };



    const loadModel = async (modelPath: string) => {
        // 1. Prepare DRACOLoader
        const dracoLoader = new DRACOLoader();
        // Point to the folder where you put draco_decoder.js and its WASM companion
        dracoLoader.setDecoderPath('/draco/');
        // Optional: force JS fallback if needed
        // dracoLoader.setDecoderConfig({ type: 'js' });

        // 2. Create GLTFLoader and attach DRACOLoader
        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);
        try {
            // Load the model using GLTFLoader
            const gltf = await new Promise<GLTF>((resolve, reject) => {
                loader.load(
                    modelPath,
                    resolve,
                    undefined,
                    (error) => reject(error)
                );
            });

            // Handle model for seats rendering

            // Extract the loaded scene (3D model)
            const model = gltf.scene;

            // Extract and apply camera settings
            const perspectiveCamera = extractGLBCameraAndParde(gltf);
            if (perspectiveCamera) {
                const cameraPosition = perspectiveCamera.position.clone();
                const cameraTarget = new THREE.Vector3();
                perspectiveCamera.getWorldDirection(cameraTarget).add(cameraPosition);


                cameraPosition.y += 1.6
                cameraPosition.z += -1.7

                console.log('camera pos: ', cameraPosition)
                console.log('camera target: ', cameraTarget)
                updateSceneCamera(cameraPosition, cameraTarget);

                setTimeout(() => {
                    cameraPosition.y -= .6
                    cameraPosition.z -= .6
                }, 2000);




            } else {
                console.warn("No PerspectiveCamera found in the GLB file.");
            }

            // Store the model in state
            setLoadedModels([model]);
            // Mark the scene as ready
            dispatch({ type: "SET_SCENE_READY", payload: true });
            // try to add reflections
            lookForReflector(model)


        } catch (error) {
            console.error(`Error loading model ${modelPath}:`, error);
        } finally {
            // Hide the loading overlay
            dispatch({ type: "SET_LOADING", payload: false });
        }
    };



    const lookForReflector = (model: any) => {

        if (!model) return;

        const found: typeof reflectors = [];
        const reflectorObjName = "Cone007"

        model.traverse((node: any) => {
            if (node.isMesh && node.name.includes(reflectorObjName)) {
                console.log('node: ', node)
                node.updateWorldMatrix(true, false);
                const worldPos = new Vector3();
                node.getWorldPosition(worldPos);
                const bbox = new Box3().setFromObject(node);
                const size = new Vector3();
                bbox.getSize(size);

                found.push({
                    position: [worldPos.x, worldPos.y + 1.1, worldPos.z],
                    size: [size.x, size.z],
                });
            }
        });
        setReflectors(found);

        console.log('reflectors: ', reflectors)
    }











    const loadAdditionalModel = async (modelPath: string) => {
        // 1. Prepare DRACOLoader
        const dracoLoader = new DRACOLoader();
        // Point to the folder where you put draco_decoder.js and its WASM companion
        dracoLoader.setDecoderPath('/draco/');

        // 2. Create GLTFLoader and attach DRACOLoader
        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader); try {
            const gltf = await new Promise<GLTF>((resolve, reject) => {
                loader.load(modelPath, resolve, undefined, (error) => reject(error));
            });

            if (!carModelRef.current) {
                const newModel = gltf.scene;
                carModelRef.current = newModel
                setLoadedModels((prevModels) => [...prevModels, newModel]);
                renderCarParts()
            }


                            setCarLoaded(true)

           

        } catch (error) {
            console.error(`Error loading additional model ${modelPath}:`, error);
        }
    };

    const extractGLBCameraAndParde = (gltf: GLTF): THREE.PerspectiveCamera | null => {
        let camera: THREE.PerspectiveCamera | null = null;

        gltf.scene.traverse((object: any) => {
            if (object.isCamera && object.type === 'PerspectiveCamera') {
                camera = object as THREE.PerspectiveCamera;
            }
            // if (object.userData.name === "TheParde") {


            //     setParde(object)

            // }
        });

        return camera;
    };
    const updateSceneCamera = (position: THREE.Vector3, target: THREE.Vector3) => {


        setDEFAULT_CAMERA_TARGET(target)
        setDEFAULT_CAMERA_POSITION(position)

    };


    useEffect(() => {
        dispatch({ type: "SET_LOADING", payload: true }); // Show loading overlay
        loadModel(sceneFile).then(() => {
            // Load another model after the first one is ready
            loadAdditionalModel(car);
        });
        // loadModel(model);
    }, [sceneFile]); // Trigger only on deviceType change



    const handleClick = () => {
        if (!isMouseDragging) {
            setIsClickValid(true)
        } else {
            setIsClickValid(false)
        }
    };

    const handleJoyStick = (isEnabled: boolean) => {
        setIsJoystickEnabled(isEnabled)
    }


    const calculateClickValidity = (): boolean => {
        return globalState.isClickValid
    }
    useEffect(() => {



        if (!paintingRef.current) return
        paintingRef.current.updateMatrix()








    }, [state.isSceneReady])




    const showCarBodyStatus = () => {
        console.log(globalState.damagedParts)

        // StyleCarParts(carModelRef.current, ["car_door_left"], "red", 1000);
        // StyleCarParts(carModelRef.current, ["car_tier", "car_caput"], "yellow", 1000);

        globalState.damagedParts.forEach(({ partName, status }) => {
            const color = statusColorMap[status];
            StyleCarParts(carModelRef.current, [partName], color, 1000);
        });

        setIsShowBodyStatus(true)
        setTimeout(() => {
            statusValue.current = 30
        }, 500);
    }
    const hideCarBodyStatus = () => {
        RestoreCarPartsMaterials(carModelRef.current);
        setIsShowBodyStatus(false)
        statusValue.current = 100

    }

    const renderCarParts = () => {
        setTimeout(() => {
            // initializeDoorSounds(doorConfigs).then(soundsMap => {
            // controllerRef.current = setupDoors(carModelRef.current, doorConfigs, soundsMap);
            const options = {
                doorAngleDeg: 70,   // 70° for both doors
                hoodAngleDeg: 45,   // 25° for hood
                trunkAngleDeg: 80,  // e.g. 40° for trunk
                durationSec: 1.2,   // optional custom duration
            }
            controllerRef.current = new DoorController(carModelRef.current, options)
            // });
        }, 200);
    }

    const handleCarOpenDoor = () => {
        //   open car door
        if (!soundInit.current) {
            initializeSounds()

            soundInit.current = true;
        }


        controllerRef.current.openLeftFrontDoor(true)
        controllerRef.current.openRightFrontDoor(true)
        controllerRef.current.openLeftBackDoor(true)
        controllerRef.current.openRightBackDoor(true)
        controllerRef.current.openTrunk(true)
        controllerRef.current.openHood(true)


        setIsPartsOpen(true)


    }

    const handleCarCloseDoor = () => {
        controllerRef.current.openLeftFrontDoor(false)
        controllerRef.current.openRightFrontDoor(false)
        controllerRef.current.openLeftBackDoor(false)
        controllerRef.current.openRightBackDoor(false)






        controllerRef.current.openTrunk(false)
        controllerRef.current.openHood(false)


        setIsPartsOpen(false)

    }




    const handleOpenSpecificPart = (part_name: string, partObj: Object3D) => {
        console.log('part_name: ', part_name)
        //   alert('handleOpenSpecificPart part')

        togglePart(part_name, controllerRef.current)

    }







    const handleEnterCarCabin = () => {
        const cabinPosition = globalState.DRIVER_POSITION // Position inside cabin
        const carForward = globalState.CAR_FORWARD // Position inside cabin
        // const windshieldOffset = new THREE.Vector3(0, 0, -50); // Offset from the windshield
        MoveCameraToCabin(controlsRef, carModelRef.current, cabinPosition, carForward, cameraRef.current);
        setIsInsideTheCar(true)
    }
    const handleExitCarCabin = () => {
        ResetCamera(controlsRef, cameraRef.current, 1500);
        setIsInsideTheCar(false)


    }


    // const handleCarPartClicked = (part_name: string, partObj: Object3D) => {

    //     const damagedPart = globalState.damagedParts.find(part => part.partName === part_name);
    //     if (damagedPart && !isFocusOnPart.current) {
    //         setBodyStatusModal(damagedPart.partModalData)

    //         isFocusOnPart.current = true

    //         MoveCameraToCarPart(cameraRef.current, carModelRef.current, partObj, -3, 1);

    //     }

    // } 


    const showPartImg = () => {
        setIsModalOpen(true)

    }

    const resetPartViewCamera = () => {

        isFocusOnPart.current = false
        setIsModalOpen(false)
        handleCarCloseDoor()
        handleExitCarCabin()





        // controlsRef.current.changeCameraView(new Vector3(
        //     0.07137410807503519,
        //     2.6110566890328797,
        //     6.654446937685129
        // ), new Vector3(
        //     0.07137410807503519,
        //     2.6110566890328797,
        //     6.654446937685129
        // ))






        // if (isFocusOnPart.current) {
        //     // reseting from body parts
        //     ResetTheCamera(cameraRef.current)
        //     isFocusOnPart.current = false
        //     setIsModalOpen(false)
        //     handleCarCloseDoor()
        //     handleExitCarCabin()

        // } else {
        //     // reseting from zoom
        // }

    }


    const handleCameraTransitionComplete = (data: any) => {

        // dont show it on switch view and on changing view from view btns
        if (data.seat_no && !data.isChangeCamera
        ) {
            dispatch({ type: 'SET_SHOW_INFO', payload: true });
            handleJoyStick(false)
            dispatch({ type: 'TOGGLE_SUGGEST_BTNS', payload: true });

        }
    };
    const handleResetCamera = (resetFunction: () => void) => {

        setResetCamera(() => resetFunction);

    };

    const callResetCamera = (resetFunction: () => void = () => { }) => {
        setResetCamera(() => resetFunction);
        // setMapMinimized(true)
    }


    const handleInfoModal = () => {
        setIsModalOpen(false)

    };



    const handleCameraMount = () => {
        // console.log('cam mounted')
        setTimeout(() => {
            dispatch({ type: 'SET_LOADING', payload: false });
            cameraRef.current.add(getAudioListener());

            // setIsLoading(false)
        }, 10);


    };

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent || '';

        setIsMobile(/Mobi|Android|iPhone|iPad/.test(ua));
    }, []);


    useEffect(() => {
        if (state.showInfo) setCAMERA_IS_ON_SEAT_POV(true)

    }, [state.showInfo])

    const carBodyStats = [
        { bodyPart: "کاپوت", status: "آسیب دیده" },
        { bodyPart: "درب سمت راست", status: "سالم" },
        { bodyPart: "شیشه جلو", status: "ترک خورده" },
    ];




    // 1. Compute a fully-typed tuple up front
    const safeDpr: [number, number] = [1, window.devicePixelRatio];
    //  safeMode.current ? {
    //         dpr: safeDpr,
    //         gl: {

    //             antialias: false,
    //             alpha: false,
    //             powerPreference: safeMode.current
    //                 ? 'low-power'
    //                 : 'high-performance',
    //         } as const,
    //         shadows: false,
    //     } :

    // 2. Use that in your canvasProps
    const canvasProps = {
        dpr: safeDpr,
        gl: {

            antialias: false,
            alpha: false,
            powerPreference: 'high-performance'

        } as const,
        shadows: false,
    };




    const handleContextLost = (e: Event) => {
        e.preventDefault()

        // setTimeout(() => {
        //     clearSiteDataAndReload()
        // }, 3500);
    }

    // const handleContextRestored = () => {
    //     console.info('Context restored!')
    //     // re‑load or re‑initialize your scene here
    // }

    // Clean up listeners when unmounting
    useEffect(() => {
        // throw content loss
        // setTimeout(() => {
        //     alert('crashing')
        //     rendererRef.current
        //         ?.getContext()
        //         .getExtension('WEBGL_lose_context')
        //         ?.loseContext()
        // }, 10000);

        return () => {
            const canvas = rendererRef.current?.domElement
            canvas?.removeEventListener('webglcontextlost', handleContextLost)
            // canvas?.removeEventListener('webglcontextrestored', handleContextRestored)
        }

    }, [])











    return (
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={(event) => {
                onMouseUp(event);
                handleClick();
            }}
        >

            {state.isLoading &&
                <SceneLoader />}
            {state.isSceneReady && (
                <>

                {!carLoaded && 
              <OverlayLoader />
                }
                    {/* AR Button: always on top */}
                    {(!isARMode && !isARMode2) && (
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000 }}>
                            <button
                                onClick={() => setIsARMode(true)}
                                className="ios-glass-theme ar-btn px-4 py-2 font-medium text-gray-600 transition-colors duration-200 sm:px-6 rounded-md  dark:text-gray-300 bg-black"

                            >
                                <MdViewInAr size={32} />
                            </button> 
                            &nbsp;
                             <button
                                onClick={() => setIsARMode2(true)}
                                className="ios-glass-theme ar-btn px-4 py-2 font-medium text-gray-600 transition-colors duration-200 sm:px-6 rounded-md  dark:text-gray-300 bg-black"

                            >
                                <MdDirectionsCar size={32} />
                            </button>
                        </div>
                    )}

                    {(isARMode || isARMode2 )&& (
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 1000 }}>
                            <button
                                onClick={() => {
                                    setIsARMode(false);
                                    setIsARMode2(false);
                                    setTimeout(() => {
                                        resetPartViewCamera()
                                    }, 200);

                                }
                                }
                                className="3d-btn px-4 py-2 font-medium text-gray-600 transition-colors duration-200 sm:px-6 rounded-md dark:hover:bg-gray-800 dark:text-gray-300 hover:bg-gray-100 bg-black"

                            >
                                <MdArrowBack size={32} />
                            </button>
                        </div>
                    )}



                    {(isARMode || isARMode2) ? (
                        <>

                        {isARMode && (
                        <ARViewer onExit={() => setIsARMode(false)} />

                        )}

                          {isARMode2 && (
                        <ARViewer2 onExit={() => setIsARMode2(false)} />

                        )}

                        </>
                    ) : (
                        /* your existing Three.js Canvas */

                        <>

                            <Canvas

                                {...canvasProps}

                                onCreated={({ camera, gl }: { camera: any, gl: any }) => {

                                    cameraRef.current = camera;
                                    cameraRef.current.lookAt(globalState.DEFAULT_CAMERA_TARGET)
                                    rendererRef.current = gl
                                    // Setup WebGL context lost/restored listeners
                                    const canvas = gl.domElement
                                    canvas.addEventListener('webglcontextlost', handleContextLost, false)

                                }}

                                camera={{ position: globalState.DEFAULT_CAMERA_POSITION }} shadows>
                                <Suspense fallback={<Loader />}>
                                    <LightController ref={lightControllerRef}
                                        onDarkModeChange={setIsDark} />
                                    <CameraController
                                        CalculateClickValidity={calculateClickValidity}
                                        onMount={handleCameraMount}
                                        controlsRef={controlsRef}
                                        onCameraTransitionComplete={handleCameraTransitionComplete}

                                        // onCarPartClicked={handleCarPartClicked}
                                        onCarPartClicked={handleOpenSpecificPart}
                                        onResetCamera={handleResetCamera}

                                    />

                                    <CarLights carRef={carModelRef} lampConfigs={lampNames} active={isDark} />

                                    {/* <directionalLight position={[-1.3, 6.0, 4.4]} castShadow intensity={Math.PI * .45} /> */}

                                    {/* Render each loaded model */}
                                    {state.isSceneReady && loadedModels.map((model, index) => (
                                        <primitive ref={paintingRef} key={index} object={model} position={[0, 1, 0]} />
                                    ))}
                                    <Circle args={[10]} rotation-x={-Math.PI / 2} receiveShadow>
                                        <meshStandardMaterial />
                                    </Circle>
                                    <OrbitControls ref={controlsRef} enabled={isOrbitEnabled} target={globalState.DEFAULT_CAMERA_TARGET} />

                                    <PinchZoomCamera
                                        controlsRef={controlsRef}
                                        isInsideTheCar={isInsideTheCar}
                                        paintingRef={paintingRef} />







                                    {/* Reflectors */}
                                    {/* Realism‑Effects SSR */}
                                    <Effects />













                                    {reflectors.map((ref, i) => (

                                        <mesh key={i}
                                            rotation={[-Math.PI / 2, 0, 0]}
                                            position={ref.position}
                                        >
                                            <circleGeometry args={[ref.size[0] / 2, 16]} />

                                            {/* <MeshReflectorMaterial
                                                blur={[90, 90]}    // ← less blur radius
                                                mixBlur={.6}        // you can also dial back mixBlur                                               
                                                mixStrength={0.6}
                                                depthToBlurRatioBias={.1}
                                                mixContrast={.8}
                                                resolution={210}
                                                metalness={1}
                                                roughness={1}
                                                depthScale={.3}
                                                minDepthThreshold={0.2}
                                                maxDepthThreshold={.2}
                                                mirror={1}
                                            // opacity={0.4}
                                            // transparent
                                            /> */}
                                            <MeshReflectorMaterial
                                                blur={[0, 0]}           // skip the Gaussian blur passes
                                                mixBlur={0}             // no blurred layer
                                                mixStrength={0.2}       // very subtle reflection
                                                resolution={240}        // tiny render target
                                                metalness={1}
                                                roughness={1}
                                                depthScale={0}          // skip depth‑based blending
                                                minDepthThreshold={0}   // immediately fade out
                                                maxDepthThreshold={0}   // no depth falloff work
                                                mirror={.6}
                                            />



                                        </mesh>
                                    ))}

                                </Suspense>
                            </Canvas>


                            {state.isSceneReady && (
                                <>

                                    <LightToggleButton controllerRef={lightControllerRef} isDark={isDark} />

                                    {/* <div style={{ position: 'absolute', zIndex: 9999999999999, top: '2rem', right: '2rem' }}><ARViewer /></div> */}
                                    {/* {isMobile ? <div style={{position:'absolute' , zIndex:9999999999999 , top:'2rem' , right: '2rem'}}><ARViewer /></div> : <ViewInArButton />} */}
                                    {/* joy stick controlls momvent and camera movment in the scene */}
                                    {cameraRef.current && carModelRef.current && isJoystickEnabled && <JoystickControl isJoystickEnabled isInsideTheCar={isInsideTheCar} camera={cameraRef.current} carModel={carModelRef.current} />}
                                    {/* {!isJoystickEnabled && <OnSeatDragControl camera={cameraRef.current} isOnSeatPOV={state.showInfo} />} */}

                                    {isShowBodyStatus && (
                                        <div className={'car-body-stat'} >
                                            <Car‌BodyStatBox carBodyStat={carBodyStats} />
                                            <CarBodyStatus status={statusValue.current} />
                                        </div>
                                    )}

                                    <CarInfoBox carDetails={carDetails} />
                                    {/* <VolumeControl /> */}
                                    {/* <Stats showPanel={0} /> */}

                                    <BodyButton
                                        onBodyPartCheckClick={isShowBodyStatus ? hideCarBodyStatus : showCarBodyStatus}
                                        onOpenPartsClick={isPartsOpen ? handleCarCloseDoor : handleCarOpenDoor}
                                        onShowInsideClick={isInsideTheCar ? handleExitCarCabin : handleEnterCarCabin}
                                        isShowBodyStatus={isShowBodyStatus}
                                        isPartsOpen={isPartsOpen}
                                        isInsideTheCar={isInsideTheCar}


                                    />
                                    {showResetCamBtn.current && (
                                        <>
                                            <ResetCameraButton onResetTheCamera={resetPartViewCamera} />
                                            {isFocusOnPart.current && (
                                                <ShowPartImgButton onShowImg={showPartImg} />
                                            )}
                                        </>
                                    )}

                                    <Modal isOpen={isModalOpen} onClose={handleInfoModal} modalData={BodyStatusModal} />

                                </>

                            )}
                        </>
                    )}






                    <BackDropLoading isExpanded={state.isLoading} />
                </>
            )}
        </div>
    );
};

export default SceneComponent;