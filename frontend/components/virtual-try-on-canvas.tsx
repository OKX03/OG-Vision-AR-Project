"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, FBXLoader, RoomEnvironment } from "three-stdlib";
import { FaceLandmarkerService, sharedFaceLandmarkerService } from "@/services/face-landmarker.service";
import Stats from "stats.js";
import "./virtual-try-on.css";

type Landmark = { x: number; y: number; z: number };

const MAX_CACHE_SIZE = 5;
const modelPromiseCache = new Map<string, Promise<THREE.Object3D>>();

const disposeModel = (obj: THREE.Object3D) => {
  obj.traverse((child: any) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat: any) => {
        if (mat.map) mat.map.dispose();
        if (mat.normalMap) mat.normalMap.dispose();
        if (mat.roughnessMap) mat.roughnessMap.dispose();
        if (mat.metalnessMap) mat.metalnessMap.dispose();
        if (mat.envMap) mat.envMap.dispose();
        mat.dispose();
      });
    }
  });
};

type Props = {
  modelPath: string;
  isAdminMode?: boolean;
  initialCalibration?: {
    pitch: number;
    yaw: number;
    roll: number;
    scale: number;
    yOffset: number;
    zOffset: number;
  };
  onSaveCalibration?: (calib: any) => void;
  staticImageSrc?: string | null;
};

const VirtualTryOnCanvas: React.FC<Props> = ({ modelPath, isAdminMode = false, initialCalibration, onSaveCalibration, staticImageSrc }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const staticLandmarksRef = useRef<any[]>([]);
  const mountedRef = useRef(true);

  const faceSvcRef = useRef(sharedFaceLandmarkerService);
  const glassesRef = useRef<THREE.Object3D | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const occluderRef = useRef<THREE.Mesh | null>(null);
  const headBulkRef = useRef<THREE.Mesh | null>(null);
  const rafRef = useRef<number | null>(null);
  const statsRef = useRef<Stats | null>(null);

  const smoothPos = useRef(new THREE.Vector3());
  const smoothScale = useRef(1);
  const smoothQuat = useRef(new THREE.Quaternion());

  const [debugMode, setDebugMode] = useState(false);

  const [calib, setCalib] = useState(initialCalibration || {
    pitch: 0, yaw: 0, roll: 0,
    scale: 1.0,
    yOffset: 0, zOffset: 0
  });

  useEffect(() => {
    if (initialCalibration) {
      setCalib(initialCalibration);
    } else {
      setCalib({
        pitch: 0, yaw: 0, roll: 0,
        scale: 1.0,
        yOffset: 0, zOffset: 0
      });
    }
  }, [initialCalibration]);

  const calibRef = useRef(calib);
  useEffect(() => {
    calibRef.current = calib;
  }, [calib]);

  const [isInitialized, setIsInitialized] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    init();

    return () => {
      mountedRef.current = false;

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      if (sceneRef.current) {
        sceneRef.current.traverse((obj: any) => {
          if (obj.geometry) {
            obj.geometry.dispose();
          }
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat: any) => {
                if (mat.map) mat.map.dispose();
                if (mat.normalMap) mat.normalMap.dispose();
                if (mat.roughnessMap) mat.roughnessMap.dispose();
                if (mat.metalnessMap) mat.metalnessMap.dispose();
                if (mat.envMap) mat.envMap.dispose();
                mat.dispose();
              });
            } else {
              const mat = obj.material;
              if (mat.map) mat.map.dispose();
              if (mat.normalMap) mat.normalMap.dispose();
              if (mat.roughnessMap) mat.roughnessMap.dispose();
              if (mat.metalnessMap) mat.metalnessMap.dispose();
              if (mat.envMap) mat.envMap.dispose();
              mat.dispose();
            }
          }
        });
        sceneRef.current.clear();
      }

      if (sceneRef.current?.environment) {
        sceneRef.current.environment.dispose();
      }

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current = null;
      }

      sceneRef.current = null;
      cameraRef.current = null;
      occluderRef.current = null;
      headBulkRef.current = null;
      glassesRef.current = null;
      if (statsRef.current && statsRef.current.dom.parentNode) {
        statsRef.current.dom.parentNode.removeChild(statsRef.current.dom);
        statsRef.current = null;
      }

      smoothedLm.current = [];
    };
  }, []);

  useEffect(() => {
    if (modelPath && isInitialized) {
      replaceModel(modelPath);
    }
  }, [modelPath, isInitialized]);

  const init = async () => {
    if (staticImageSrc) {
      // For static images, initialize the face service immediately
      await faceSvcRef.current.init("IMAGE");
      if (imageRef.current) {
        if (!imageRef.current.complete || imageRef.current.naturalWidth === 0) {
          await new Promise((resolve) => {
            if (imageRef.current) imageRef.current.onload = resolve;
          });
        }
        await new Promise(r => setTimeout(r, 100));

        // Detect landmarks for the static image
        let res = await faceSvcRef.current.detectImage(imageRef.current);
        let retries = 5;
        while ((!res || !res.faceLandmarks || res.faceLandmarks.length === 0) && retries > 0) {
          await new Promise(r => setTimeout(r, 400));
          res = await faceSvcRef.current.detectImage(imageRef.current);
          retries--;
        }

        if (res?.faceLandmarks?.length) {
          staticLandmarksRef.current = res.faceLandmarks[0];
        }
      }
    } else {
      // For video, set up the camera first before initializing the face service
      await setupCamera();
      await faceSvcRef.current.init("VIDEO");
    }

    initThree();
    createFaceOccluder();
    setIsInitialized(true);
    animate();
  };

  const setupCamera = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is missing. HTTPS is required!");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          height: { ideal: 720 }
        },
      });


      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (err) {
          if ((err as DOMException).name !== "AbortError") {
            console.error("Video play error:", err);
          }
        }
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraFailed(true);
    }
  };

  //Initializes the Three.js scene, camera, renderer, and lighting
  const initThree = () => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 10);
    camera.position.z = 2;

    // On mobile devices, limit pixel ratio to 1.5 while 2 for desktop
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2);

    // Create WebGLRenderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: !isMobile,
      powerPreference: "low-power",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio);

    // Use a PMREMGenerator to create an environment map from the RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    
    const roomEnv = new (RoomEnvironment as any)();
    // @ts-ignore
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    if (typeof roomEnv.dispose === "function") {
      roomEnv.dispose();
    } else {
      roomEnv.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    pmremGenerator.dispose();

    // Add ambient and directional lighting for better model appearance
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0, 1, 2);
    scene.add(dirLight);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    // FPS stats 
    /*
    if (!statsRef.current) {
      const stats = new Stats();
      stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
      stats.dom.style.position = 'fixed';
      stats.dom.style.top = '10px';
      stats.dom.style.left = 'auto';
      stats.dom.style.right = '10px';
      stats.dom.style.zIndex = '99999';

      Array.from(stats.dom.children).forEach((c) => {
        const el = c as HTMLElement;
        el.style.setProperty('width', '80px', 'important');
        el.style.setProperty('height', '48px', 'important');
      });

      document.body.appendChild(stats.dom);
      statsRef.current = stats;
    }
    */
  };

  // Creates the face occluder mesh that will be used to hide parts of the glasses that should appear behind the face
  const createFaceOccluder = () => {
    if (!sceneRef.current) return;
    // Create a buffer geometry for the face occluder
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(478 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Add triangle indices to the face mesh
    const edges = FaceLandmarkerService.faceTesselation;
    // Flatten the edges array to get the indices 
    const indices = [];
    for (let i = 0; i < edges.length; i += 3) {
      indices.push(edges[i].start, edges[i].end, edges[i + 1].end);
    }
    geometry.setIndex(indices);

    // Use a material that writes to the depth buffer but not the color buffer
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      colorWrite: false,
      depthWrite: true,
      wireframe: false,
      side: THREE.DoubleSide
    });

    // Create a invisible bulk mesh to prevent z-order issues and ensure the glasses render on top
    const headBulkGeometry = new THREE.SphereGeometry(1.0, 32, 32);
    headBulkGeometry.scale(0.55, 1.2, 0.8);
    const headBulkMesh = new THREE.Mesh(headBulkGeometry, material);
    headBulkMesh.renderOrder = -1;
    sceneRef.current.add(headBulkMesh);
    headBulkRef.current = headBulkMesh;

    // Add a neck bulk to cover the area below the face to prevent glasses frorendering behind the neck
    const neckBulkGeometry = new THREE.CylinderGeometry(0.55, 0.55, 3, 32);
    const neckBulkMesh = new THREE.Mesh(neckBulkGeometry, material);
    neckBulkMesh.renderOrder = -1;

    headBulkMesh.add(neckBulkMesh);
    neckBulkMesh.position.set(0, -1.5, 0);

    // Create the main face occluder mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = -1;


    mesh.position.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);

    sceneRef.current.add(mesh);
    occluderRef.current = mesh;
  };

  const replaceModel = async (url: string) => {
    if (!sceneRef.current) return;

    // Clean up previous model from scene (but keep in cache)
    if (glassesRef.current) {
      sceneRef.current.remove(glassesRef.current);
      glassesRef.current = null;
    }

    let objPromise = modelPromiseCache.get(url);

    if (!objPromise) {
      objPromise = (async () => {
        let loadedObj: THREE.Object3D;
        if (url.toLowerCase().includes(".fbx")) {
          loadedObj = await new FBXLoader().loadAsync(url);
        } else {
          const gltf = await new GLTFLoader().loadAsync(url);
          loadedObj = gltf.scene;
        }

        // Compute the bounding box of the model to determine its size and center it on the origin
        const box = new THREE.Box3().setFromObject(loadedObj);
        const size = new THREE.Vector3();
        box.getSize(size);

        loadedObj.userData.baseWidth = size.x;
        loadedObj.scale.setScalar(0.01);

        // Apply materials to the model
        loadedObj.traverse((child: any) => {
          if (child.isMesh) {
            const matName = child.material?.name?.toLowerCase() || "";
            if (child.name === "lens" || child.name === "lens_l" || child.name === "lens_r" || matName.includes("glass") || child.material.transparent || child.material.opacity < 1) {
              child.material = new THREE.MeshPhysicalMaterial({
                color: 0xffffff,
                transmission: 1.0,
                roughness: 0.0,
                ior: 1.5,
                thickness: 0.001,
                transparent: true,
                opacity: 0.3,
                depthWrite: true,
              });
            } else {
              child.material.metalness = Math.max(child.material.metalness || 0, 0.6);
              child.material.roughness = Math.min(child.material.roughness || 1, 0.3);
              child.material.envMapIntensity = 1.0;
              child.material.needsUpdate = true;
              child.material.depthWrite = true;
            }
          }
        });

        return loadedObj;
      })();

      modelPromiseCache.set(url, objPromise);

      // Enforce cache limit
      if (modelPromiseCache.size > MAX_CACHE_SIZE) {
        const firstKey = modelPromiseCache.keys().next().value;
        if (firstKey && firstKey !== url) {
          const oldPromise = modelPromiseCache.get(firstKey);
          modelPromiseCache.delete(firstKey);
          oldPromise?.then(oldObj => disposeModel(oldObj)).catch(() => {});
        }
      }
    } else {
      // LRU logic: move to end to mark as recently used
      modelPromiseCache.delete(url);
      modelPromiseCache.set(url, objPromise);
    }

    try {
      const obj = await objPromise;
      
      // Prevent race conditions if user rapidly clicks multiple glasses
      if (modelPath !== url) return;

      // Double check in case another async operation added it
      if (glassesRef.current) {
        sceneRef.current.remove(glassesRef.current);
      }

      glassesRef.current = obj;
      sceneRef.current.add(obj);
    } catch (err) {
      console.error("Failed to load model:", url, err);
      modelPromiseCache.delete(url);
    }
  };

  const animate = () => {
    const loop = () => {
      if (statsRef.current) statsRef.current.begin();

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;

      if (!scene || !camera || !renderer) {
        if (statsRef.current) statsRef.current.end();
        return;
      }

      if (staticImageSrc) {
        if (imageRef.current && staticLandmarksRef.current.length > 0) {
          updateGlasses(staticLandmarksRef.current, imageRef.current);
        }
      } else {
        const video = videoRef.current;
        if (video) {
          const res = faceSvcRef.current.detectForVideo(video, performance.now());
          if (res?.faceLandmarks?.length) updateGlasses(res.faceLandmarks[0], video);
        }
      }

      renderer.render(scene, camera);
      
      if (statsRef.current) statsRef.current.end();
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const smoothedLm = useRef<{ x: number, y: number, z: number }[]>([]);

  // Converts the 2D landmark position to Normalized Device Coordinates (NDC)
  const getNdc = (p: { x: number, y: number }, source: HTMLVideoElement | HTMLImageElement) => {
    if (!containerRef.current) return { ndcX: p.x * 2 - 1, ndcY: -(p.y * 2 - 1), scaleZ: 1 };

    // Calculate the aspect ratio and scaling based on source
    const vw = source instanceof HTMLVideoElement ? (source.videoWidth || 640) : (source.naturalWidth || 640);
    const vh = source instanceof HTMLVideoElement ? (source.videoHeight || 480) : (source.naturalHeight || 480);
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;

    const isContain = !!staticImageSrc;
    const scale = isContain ? Math.min(cw / vw, ch / vh) : Math.max(cw / vw, ch / vh);
    const renderedW = vw * scale;
    const renderedH = vh * scale;

    const offsetX = (cw - renderedW) / 2;
    const offsetY = (ch - renderedH) / 2;

    const canvasX = offsetX + p.x * renderedW;
    const canvasY = offsetY + p.y * renderedH;

    const ndcX = (canvasX / cw) * 2 - 1;
    const ndcY = -(canvasY / ch) * 2 + 1;

    // scaleZ ensures that the depth offset is proportional to the actual rendered video width,
    // not the container width, so that aspect ratio changes (mobile vs laptop) don't distort depth.
    const scaleZ = renderedW / cw;
    return { ndcX, ndcY, scaleZ };
  };

  const updateGlasses = (lm: any[], source: HTMLVideoElement | HTMLImageElement) => {
    if (!cameraRef.current) return;

    // Ensure size of renderer and camera aspect ratio match the container
    if (containerRef.current && rendererRef.current && cameraRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const canvas = rendererRef.current.domElement;
      
      const vw = source instanceof HTMLVideoElement ? (source.videoWidth || 640) : (source.naturalWidth || 640);
      const vh = source instanceof HTMLVideoElement ? (source.videoHeight || 480) : (source.naturalHeight || 480);
      const isContain = !!staticImageSrc;
      const scale = isContain ? Math.min(cw / vw, ch / vh) : Math.max(cw / vw, ch / vh);
      const renderedW = vw * scale;
      const renderedH = vh * scale;
      // Assume live webcams have a wide ~60 deg FOV (strong perspective distortion).
      // Uploaded photos can be selfies (wide) or portraits (narrow). 40 deg is a safe standard equivalent to a ~50mm lens.
      const sourceFovH = staticImageSrc ? 40 : 60; 
      // Calculate what the container's vertical FOV should be to match the physical camera's perspective.
      // tan(fovV / 2) = tan(sourceFovH / 2) * (ch / renderedW)
      const newFovRad = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(sourceFovH) / 2) * (ch / renderedW));
      const newFov = THREE.MathUtils.radToDeg(newFovRad);

      if (canvas.clientWidth !== cw || canvas.clientHeight !== ch || Math.abs(cameraRef.current.fov - newFov) > 0.1) {
        rendererRef.current.setSize(cw, ch);
        cameraRef.current.aspect = cw / ch;
        cameraRef.current.fov = newFov;
        cameraRef.current.updateProjectionMatrix();
      }
    }

    if (smoothedLm.current.length === 0) {
      smoothedLm.current = JSON.parse(JSON.stringify(lm));
      for (let i = 0; i < smoothedLm.current.length; i++) smoothedLm.current[i].x = staticImageSrc ? smoothedLm.current[i].x : (1.0 - smoothedLm.current[i].x);
    } else {
      // Smooth the landmarks using a simple low-pass filter to prevent jitter
      const factor = 0.65;
      for (let i = 0; i < lm.length; i++) {
        const targetX = staticImageSrc ? lm[i].x : (1.0 - lm[i].x);
        smoothedLm.current[i].x += (targetX - smoothedLm.current[i].x) * factor;
        smoothedLm.current[i].y += (lm[i].y - smoothedLm.current[i].y) * factor;
        smoothedLm.current[i].z += (lm[i].z - smoothedLm.current[i].z) * factor;
      }
    }
    const sm = smoothedLm.current;

    // Measuring Tracking Stability (Jitter Reduction)
    if (Math.random() < 0.05) {
        const rawNoseX = staticImageSrc ? lm[1].x : (1.0 - lm[1].x);
        const smoothNoseX = sm[1].x;
        console.log(`Tracking Stability - Raw: ${rawNoseX.toFixed(5)} | Smoothed: ${smoothNoseX.toFixed(5)}`);
    }

    const left = sm[33]; // Left eye outer corner
    const right = sm[263]; // Right eye outer corner
    const nose = sm[1]; // Nose tip
    const bridge = sm[168]; // Nose bridge
    if (!left || !right || !nose || !bridge) return;

    const distance = 1.2; // Distance from camera to face
    const fovRad = THREE.MathUtils.degToRad(cameraRef.current.fov / 2);
    const screenHeightAtDist = 2 * distance * Math.tan(fovRad);
    const screenWidthAtDist = screenHeightAtDist * cameraRef.current.aspect;
    

    // Function to convert a landmark point to 3D world coordinates
    const getPos = (p: Landmark, flattenZ: number = 1.0) => {
      const { ndcX, ndcY, scaleZ } = getNdc(p, source);
      const ndc = new THREE.Vector3(ndcX, ndcY, 0.5);
      ndc.unproject(cameraRef.current!);
      const dir = ndc.sub(cameraRef.current!.position).normalize();
      const depthOffset = p.z * scaleZ * screenWidthAtDist * flattenZ;
      
      // To avoid spherical curvature distortion on wide FOV cameras, we intersect the ray 
      // with a flat plane parallel to the camera, rather than walking a fixed distance along the ray.
      // The plane is located at depth = (distance + depthOffset) from the camera.
      // Since the camera looks down the -Z axis, the ray's Z direction is negative.
      const t = -(distance + depthOffset) / dir.z;
      
      return cameraRef.current!.position.clone().add(dir.multiplyScalar(t));
    };

    if (occluderRef.current && occluderRef.current.geometry instanceof THREE.BufferGeometry) {
      const positions = occluderRef.current.geometry.attributes.position.array as Float32Array;

      // Render the mesh with slightly flattened Z (0.8) to prevent clipping with front frame, but NO shrinking in X/Y so the temples are correctly occluded.
      for (let i = 0; i < sm.length; i++) {
        const finalPos = getPos(sm[i], 0.8);
        positions[i * 3] = finalPos.x;
        positions[i * 3 + 1] = finalPos.y;
        positions[i * 3 + 2] = finalPos.z;
      }
      occluderRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (!occluderRef.current || !(occluderRef.current.geometry instanceof THREE.BufferGeometry)) return;

    const pLeft = getPos(sm[33], 1.0); // Left eye outer corner
    const pRight = getPos(sm[263], 1.0); // Right eye outer corner
    const pChin = getPos(sm[152], 1.0); // Chin
    const pBridge = getPos(sm[168], 1.0); // Nose bridge

    // X axis is from left to right eye
    let xAxis = pLeft.clone().sub(pRight).normalize();
    if (staticImageSrc) {
      xAxis.negate();
    }

    //Y axis is from chin to nose bridge, Z axis is perpendicular to the face defined by the cross product of X and Y
    const yAxis = pBridge.clone().sub(pChin).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize();
    yAxis.crossVectors(zAxis, xAxis).normalize();

    // Create a rotation matrix from the axes and convert it to a quaternion
    const faceMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(faceMatrix);

    if (occluderRef.current) {
      occluderRef.current.position.set(0, 0, 0);
    }

    // Apply calibration adjustments to the target quaternion and position
    const currentCalib = calibRef.current;
    const correctionQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(currentCalib.pitch),
        THREE.MathUtils.degToRad(currentCalib.yaw),
        THREE.MathUtils.degToRad(currentCalib.roll)
      )
    );
    targetQuat.multiply(correctionQuat);

    // MediaPipe landmarks 468 and 473 track the dynamic irises. If the user turns their head 
    // but keeps looking at the screen, the eyeballs rotate, causing the PD to physically shrink!
    // To prevent the glasses from shrinking when turning the head, need use the rigid anatomical 
    // eye socket centers (average of inner and outer eye corners) instead of the dynamic irises.
    const leftEyeOuter = sm[33];
    const leftEyeInner = sm[133];
    const rightEyeOuter = sm[263];
    const rightEyeInner = sm[362];
    
    const leftPupilLm = {
      x: (leftEyeOuter.x + leftEyeInner.x) / 2,
      y: (leftEyeOuter.y + leftEyeInner.y) / 2,
      z: (leftEyeOuter.z + leftEyeInner.z) / 2
    };
    
    const rightPupilLm = {
      x: (rightEyeOuter.x + rightEyeInner.x) / 2,
      y: (rightEyeOuter.y + rightEyeInner.y) / 2,
      z: (rightEyeOuter.z + rightEyeInner.z) / 2
    };
    
    // Calculate the true physical 3D PD using raw MediaPipe coordinates.
    // This perfectly bypasses FOV perspective distortions and is rotation-invariant!
    const vw = source instanceof HTMLVideoElement ? (source.videoWidth || 640) : (source.naturalWidth || 640);
    const vh = source instanceof HTMLVideoElement ? (source.videoHeight || 480) : (source.naturalHeight || 480);
    const { scaleZ } = getNdc({ x: 0, y: 0 }, source);
    const dx = rightPupilLm.x - leftPupilLm.x;
    const dy = (rightPupilLm.y - leftPupilLm.y) * (vh / vw); 
    const dz = rightPupilLm.z - leftPupilLm.z;
    const rawPD = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    // Scale to Three.js world units
    const physicalPD = rawPD * scaleZ * screenWidthAtDist;
    
    // While the paper states wr = 2 * PD, a multiplier of 2 results in frames that are too small.
    // The average frame width is usually ~2.2x to 2.3x the PD. 
    // We use 2.25 to accurately map the PD to the full frame width (temple-to-temple).
    const faceWidth = 2.25 * physicalPD;
    // Calculate the target position by applying the Y and Z offsets from calibration, scaled by the face width
    const targetPos = pBridge.clone()
      .add(yAxis.clone().multiplyScalar(currentCalib.yOffset * faceWidth * 6))
      .add(zAxis.clone().multiplyScalar(currentCalib.zOffset * faceWidth * 6));

    // Position the head bulk slightly behind the face and lower it to cover the neck area, scaling it based on the face width
    const bulkPos = pBridge.clone().add(zAxis.clone().multiplyScalar(-faceWidth * 0.6));
    bulkPos.add(yAxis.clone().multiplyScalar(-faceWidth * 0.2));

    if (headBulkRef.current) {
      headBulkRef.current.position.copy(bulkPos);
      headBulkRef.current.quaternion.copy(targetQuat);
      headBulkRef.current.scale.setScalar(faceWidth * 0.8);
    }

    // Calculate the target scale for the glasses based on the overall face width instead of just eye width.
    const baseWidth = glassesRef.current?.userData?.baseWidth || 1;
    let targetScale = (faceWidth * 1.0 * currentCalib.scale) / baseWidth;

    // Smoothly interpolate the position, scale, and rotation of the glasses to prevent jitter
    smoothPos.current.lerp(targetPos, 0.85);
    smoothScale.current += (targetScale - smoothScale.current) * 0.85;
    smoothQuat.current.slerp(targetQuat, 0.85);

    // Update the glasses position, scale, and rotation
    if (glassesRef.current) {
      glassesRef.current.position.copy(smoothPos.current);
      glassesRef.current.scale.setScalar(smoothScale.current);
      glassesRef.current.quaternion.copy(smoothQuat.current);
    }
  };

  useEffect(() => {
    if (occluderRef.current && headBulkRef.current) {
      const mat = occluderRef.current.material as THREE.MeshBasicMaterial;
      mat.colorWrite = debugMode;
      mat.wireframe = debugMode;
      mat.transparent = debugMode;
      mat.opacity = debugMode ? 0.3 : 1;
      mat.needsUpdate = true;
    }
  }, [debugMode]);

  const renderHUD = () => (
    <div className="calibration-hud" style={{
      width: '300px',
      background: '#1a1a1a',
      padding: '20px',
      color: '#00ffcc',
      fontFamily: 'monospace',
      fontSize: '13px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '15px',
      overflowY: 'auto',
      borderRight: '1px solid #333'
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>⚒ Model Calibrator</div>

      {['pitch', 'yaw', 'roll'].map((axis) => (
        <div key={axis} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>{axis.toUpperCase()}</span>
            <span>{calib[axis as keyof typeof calib]}°</span>
          </div>
          <input type="range" min="-180" max="180" step="1"
            value={calib[axis as keyof typeof calib]}
            onChange={(e) => setCalib({ ...calib, [axis]: parseFloat(e.target.value) })}
            style={{ width: '100%' }}
          />
        </div>
      ))}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>SCALE</span>
          <span>{calib.scale}x</span>
        </div>
        <input type="range" min="0.1" max="3" step="0.01" value={calib.scale}
          onChange={(e) => setCalib({ ...calib, scale: parseFloat(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Y OFFSET (UP/DOWN)</span>
          <span>{calib.yOffset}</span>
        </div>
        <input type="range" min="-0.2" max="0.2" step="0.001" value={calib.yOffset}
          onChange={(e) => setCalib({ ...calib, yOffset: parseFloat(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Z OFFSET (IN/OUT)</span>
          <span>{calib.zOffset}</span>
        </div>
        <input type="range" min="-0.2" max="0.2" step="0.001" value={calib.zOffset}
          onChange={(e) => setCalib({ ...calib, zOffset: parseFloat(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      {/* <button
        style={{ width: '100%', marginTop: '10px', background: '#00ffcc', color: 'black', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        onClick={() => setDebugMode(!debugMode)}
      >
        {debugMode ? 'Hide Mask' : 'Show Mask'}
      </button> */}

      {onSaveCalibration && (
        <button
          style={{ width: '100%', marginTop: '5px', background: '#28a745', color: 'white', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}
          onClick={() => onSaveCalibration(calib)}
        >
          Save Calibration
        </button>
      )}
    </div>
  );

  const outputMedia = staticImageSrc ? (
    <img ref={imageRef} src={staticImageSrc} crossOrigin="anonymous" className="vto-video" style={{ objectFit: 'contain', transform: 'none' }} />
  ) : (
    <video ref={videoRef} autoPlay muted playsInline className="vto-video" />
  );

  if (cameraFailed && !staticImageSrc) {
    if (isAdminMode) {
      return (
        <div className="admin-vto-container" style={{ display: 'flex', width: '100%', height: '100%', minHeight: '600px', backgroundColor: '#111' }}>
          {renderHUD()}
          <div className="vto-ar" style={{ flexGrow: 1, backgroundColor: '#f8f9fa', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>Webcam Unavailable</p>
              <p style={{ fontSize: '15px', color: '#555', maxWidth: '350px', lineHeight: '1.5', margin: 0 }}>
                We couldn't access your camera. Please ensure it's connected and you've granted browser permissions.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="vto-ar" style={{ backgroundColor: '#f8f9fa', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>Webcam Unavailable</p>
          <p style={{ fontSize: '15px', color: '#555', maxWidth: '350px', lineHeight: '1.5', margin: 0 }}>
            We couldn't access your camera. Please click <b>"Upload Photo"</b> on the left to use the Photo Try-On feature.
          </p>
        </div>
      </div>
    );
  }

  if (isAdminMode) {
    return (
      <div className="admin-vto-container" style={{ display: 'flex', width: '100%', height: '100%', minHeight: '600px', backgroundColor: '#111' }}>
        {renderHUD()}
        <div ref={containerRef} className="vto-ar" style={{ flexGrow: 1, backgroundColor: 'transparent', maxWidth: 'none', height: 'auto', aspectRatio: 'auto', borderRadius: '0', margin: '0' }}>
          {outputMedia}
          <canvas ref={canvasRef} className="vto-canvas" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="vto-ar">
      {outputMedia}
      <canvas ref={canvasRef} className="vto-canvas" />
    </div>
  );
};

export default VirtualTryOnCanvas;
