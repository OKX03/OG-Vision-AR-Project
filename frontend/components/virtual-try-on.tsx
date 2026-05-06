"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader, FBXLoader, RoomEnvironment } from "three-stdlib";
import { FaceLandmarkerService } from "@/services/face-landmarker.service";
import "./virtual-try-on.css";

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

const VirtualTryOn: React.FC<Props> = ({ modelPath, isAdminMode = false, initialCalibration, onSaveCalibration, staticImageSrc }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const staticLandmarksRef = useRef<any[]>([]);
  const mountedRef = useRef(true);

  const faceSvcRef = useRef(new FaceLandmarkerService());
  const glassesRef = useRef<THREE.Object3D | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  let cameraAlertTriggered = false;

  const occluderRef = useRef<THREE.Mesh | null>(null);
  const headBulkRef = useRef<THREE.Group | null>(null);
  const rafRef = useRef<number | null>(null);

  const smoothPos = useRef(new THREE.Vector3());
  const smoothScale = useRef(1);
  const smoothQuat = useRef(new THREE.Quaternion());

  const [debugMode, setDebugMode] = useState(false);

  const [calib, setCalib] = useState(initialCalibration || {
    pitch: 0, yaw: 0, roll: 0,
    scale: 1.0,
    yOffset: -0.01, zOffset: 0.05
  });

  useEffect(() => {
    if (initialCalibration) {
      setCalib(initialCalibration);
    } else {
      setCalib({
        pitch: 0, yaw: 0, roll: 0,
        scale: 1.0,
        yOffset: -0.01, zOffset: 0.05
      });
    }
  }, [initialCalibration]);

  const calibRef = useRef(calib);
  useEffect(() => {
    calibRef.current = calib;
  }, [calib]);

  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    init();

    return () => {
      mountedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      rendererRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (modelPath && isInitialized) {
      replaceModel(modelPath);
    }
  }, [modelPath, isInitialized]);

  const init = async () => {
    if (staticImageSrc) {
      await faceSvcRef.current.init("IMAGE");
      if (imageRef.current) {
         if (!imageRef.current.complete || imageRef.current.naturalWidth === 0) {
             await new Promise((resolve) => {
                 if (imageRef.current) imageRef.current.onload = resolve;
             });
         }
         await new Promise(r => setTimeout(r, 100));
         
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
        video: { facingMode: "user" },
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
      if (!cameraAlertTriggered) {
        cameraAlertTriggered = true;
        alert(`Camera Access Failed: ${err.message}\n\n`);
      }
    }
  };

  const initThree = () => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 10);
    camera.position.z = 2;

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    // @ts-ignore
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0, 1, 2);
    scene.add(dirLight);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
  };

const createFaceOccluder = () => {
    if (!sceneRef.current) return;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(478 * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    import("@/services/triangulation").then((module) => {
      geometry.setIndex(module.FACE_MESH_INDEX_BUFFER);
    }).catch(err => console.error("Error loading triangulation map:", err));

    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      colorWrite: false,
      depthWrite: true, 
      wireframe: false,
      side: THREE.DoubleSide
    });

    const frontMask = new THREE.Mesh(geometry, material);
    frontMask.renderOrder = -1; 
    sceneRef.current.add(frontMask);
    occluderRef.current = frontMask;

    const headGroup = new THREE.Group();
    sceneRef.current.add(headGroup);
    headBulkRef.current = headGroup;

    const headGeo = new THREE.SphereGeometry(1.0, 32, 32);

    headGeo.scale(0.65, 1.1, 0.8); 
    const headMesh = new THREE.Mesh(headGeo, material);
    headMesh.renderOrder = -1;
    headGroup.add(headMesh);

  };

  const replaceModel = async (url: string) => {
    if (!sceneRef.current) return;

    if (glassesRef.current) {
      sceneRef.current.remove(glassesRef.current);
      glassesRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    let obj: THREE.Object3D;
    try {
      if (url.toLowerCase().includes(".fbx")) {
        obj = await new FBXLoader().loadAsync(url);
      } else {
        const gltf = await new GLTFLoader().loadAsync(url);
        obj = gltf.scene;
      }
    } catch (err) {
      console.error("Failed to load model:", url, err);
      return;
    }

    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);

    obj.userData.baseWidth = size.x;
    obj.scale.setScalar(0.01);

    obj.traverse((child: any) => {
      if (child.isMesh) {
        const matName = child.material?.name?.toLowerCase() || "";
        if (child.name === "lens" ||  child.name === "lens_l" || child.name === "lens_r" || matName.includes("glass") || child.material.transparent || child.material.opacity < 1) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transmission: 0.95,
            roughness: 0.02,
            ior: 1.45,
            thickness: 0.01,
            transparent: true,
            opacity: 1,
          });
        } else {
          child.material.metalness = Math.max(child.material.metalness || 0, 0.6);
          child.material.roughness = Math.min(child.material.roughness || 1, 0.3);
          child.material.envMapIntensity = 1.0;
          child.material.needsUpdate = true;
        }
      }
    });

    glassesRef.current = obj;
    sceneRef.current.add(obj);
  };

  const animate = () => {
    const loop = () => {
      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;

      if (!scene || !camera || !renderer) return;

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
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const smoothedLm = useRef<{ x: number, y: number, z: number }[]>([]);

  const getNdc = (p: { x: number, y: number }, source: HTMLVideoElement | HTMLImageElement) => {
    if (!containerRef.current) return { ndcX: p.x * 2 - 1, ndcY: -(p.y * 2 - 1), scaleZ: 1 };

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

    const scaleZ = renderedW / cw;
    return { ndcX, ndcY, scaleZ };
  };

  const updateGlasses = (lm: any[], source: HTMLVideoElement | HTMLImageElement) => {
    if (!cameraRef.current) return;

    if (containerRef.current && rendererRef.current && cameraRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const canvas = rendererRef.current.domElement;
      if (canvas.clientWidth !== cw || canvas.clientHeight !== ch) {
        rendererRef.current.setSize(cw, ch);
        cameraRef.current.aspect = cw / ch;
        cameraRef.current.updateProjectionMatrix();
      }
    }

    if (smoothedLm.current.length === 0) {
      smoothedLm.current = JSON.parse(JSON.stringify(lm));
      for (let i = 0; i < smoothedLm.current.length; i++) smoothedLm.current[i].x = staticImageSrc ? smoothedLm.current[i].x : (1.0 - smoothedLm.current[i].x);
    } else {
      const factor = 0.65;
      for (let i = 0; i < lm.length; i++) {
        const targetX = staticImageSrc ? lm[i].x : (1.0 - lm[i].x);
        smoothedLm.current[i].x += (targetX - smoothedLm.current[i].x) * factor;
        smoothedLm.current[i].y += (lm[i].y - smoothedLm.current[i].y) * factor;
        smoothedLm.current[i].z += (lm[i].z - smoothedLm.current[i].z) * factor;
      }
    }
    const sm = smoothedLm.current;

    const left = sm[33];
    const right = sm[263];
    const nose = sm[1];
    const bridge = sm[168];
    if (!left || !right || !nose || !bridge) return;

    const distance = 1.2;
    const fovRad = THREE.MathUtils.degToRad(cameraRef.current.fov / 2);
    const screenHeightAtDist = 2 * distance * Math.tan(fovRad);
    const screenWidthAtDist = screenHeightAtDist * cameraRef.current.aspect;

    if (occluderRef.current && occluderRef.current.geometry instanceof THREE.BufferGeometry) {
      const positions = occluderRef.current.geometry.attributes.position.array as Float32Array;

      for (let i = 0; i < sm.length; i++) {
        const p = sm[i];
        const { ndcX, ndcY, scaleZ } = getNdc(p, source);

        const ndc = new THREE.Vector3(ndcX, ndcY, 0.5);
        ndc.unproject(cameraRef.current);
        const dir = ndc.sub(cameraRef.current.position).normalize();
      
        const depthOffset = p.z * scaleZ * screenWidthAtDist;
        const finalPos = cameraRef.current.position.clone().add(dir.multiplyScalar(distance + depthOffset));

        positions[i * 3] = finalPos.x;
        positions[i * 3 + 1] = finalPos.y;
        positions[i * 3 + 2] = finalPos.z;
      }
      occluderRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (!occluderRef.current || !(occluderRef.current.geometry instanceof THREE.BufferGeometry)) return;
    const positions = occluderRef.current.geometry.attributes.position.array as Float32Array;

    const pLeft = new THREE.Vector3().fromArray(positions, 33 * 3);
    const pRight = new THREE.Vector3().fromArray(positions, 263 * 3);
    const pForehead = new THREE.Vector3().fromArray(positions, 10 * 3); 
    const pChin = new THREE.Vector3().fromArray(positions, 152 * 3);
    const pBridge = new THREE.Vector3().fromArray(positions, 168 * 3);

    let xAxis = pLeft.clone().sub(pRight).normalize(); 
    if (staticImageSrc) {
       xAxis.negate();
    }

    const yTemp = pForehead.clone().sub(pChin).normalize(); 
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yTemp).normalize(); 
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();  

    const faceMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(faceMatrix);

    const physicalWidth = pLeft.distanceTo(pRight);

    const currentCalib = calibRef.current;

    const correctionQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(currentCalib.pitch),
        THREE.MathUtils.degToRad(currentCalib.yaw),
        THREE.MathUtils.degToRad(currentCalib.roll)
      )
    );
    targetQuat.multiply(correctionQuat);

    const targetPos = pBridge.clone()
      .add(yAxis.clone().multiplyScalar(currentCalib.yOffset * physicalWidth * 10))
      .add(zAxis.clone().multiplyScalar(currentCalib.zOffset * physicalWidth * 10));

    if (headBulkRef.current) {
      const bulkCenter = pBridge.clone().add(zAxis.clone().multiplyScalar(-physicalWidth * 1.8));
      bulkCenter.add(yAxis.clone().multiplyScalar(-physicalWidth * 0.2));

      headBulkRef.current.position.copy(bulkCenter);
      headBulkRef.current.quaternion.copy(targetQuat); 

      headBulkRef.current.scale.setScalar(physicalWidth * 1.05); 
    }

    const baseWidth = glassesRef.current?.userData?.baseWidth || 1;
    let targetScale = (physicalWidth * 2.2 * currentCalib.scale) / baseWidth;

    smoothPos.current.lerp(targetPos, 0.85);
    smoothScale.current += (targetScale - smoothScale.current) * 0.85;
    smoothQuat.current.slerp(targetQuat, 0.85);

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
      <div style={{ fontWeight: 'bold', fontSize: '15px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>👓 Glasses Calibrator</div>

      {['pitch', 'yaw', 'roll'].map((axis) => (
        <div key={axis} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
            <span>{axis.toUpperCase()}</span>
            <span>{calib[axis as keyof typeof calib]}°</span>
          </div>
          <input type="range" min="-180" max="180" step="5"
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
        <input type="range" min="0.1" max="3" step="0.1" value={calib.scale}
          onChange={(e) => setCalib({ ...calib, scale: parseFloat(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Y OFFSET (UP/DOWN)</span>
          <span>{calib.yOffset}</span>
        </div>
        <input type="range" min="-0.2" max="0.2" step="0.01" value={calib.yOffset}
          onChange={(e) => setCalib({ ...calib, yOffset: parseFloat(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span>Z OFFSET (IN/OUT)</span>
          <span>{calib.zOffset}</span>
        </div>
        <input type="range" min="-0.2" max="0.2" step="0.01" value={calib.zOffset}
          onChange={(e) => setCalib({ ...calib, zOffset: parseFloat(e.target.value) })}
          style={{ width: '100%' }}
        />
      </div>

      <button
        style={{ width: '100%', marginTop: '10px', background: '#00ffcc', color: 'black', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
        onClick={() => setDebugMode(!debugMode)}
      >
        {debugMode ? 'Hide Mask' : 'Show Mask'}
      </button>

      {onSaveCalibration && (
        <button
          style={{ width: '100%', marginTop: '5px', background: '#ff3366', color: 'white', padding: '10px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', textTransform: 'uppercase' }}
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

export default VirtualTryOn;