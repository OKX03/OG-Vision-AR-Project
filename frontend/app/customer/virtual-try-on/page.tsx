"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import * as ort from "onnxruntime-web";
import { productService } from "@/services/product.service";
import namer from "color-namer";
import { Modal, Button } from "react-bootstrap";
import { FaceLandmarkerService, sharedFaceLandmarkerService } from "@/services/face-landmarker.service";
import VirtualTryOnCanvas from "@/components/virtual-try-on-canvas";
import { userService } from "@/services/user.service";
import "./virtual-try-on.css";

type Product = {
  product_id: string; 
  brand: string; 
  model: string; 
  color?: string; 
  colorName?: string;
  frontImage: string; 
  arModel: string | null; 
  faceShape?: string[];
  calibration?: { pitch: number; yaw: number; roll: number; scale: number; yOffset: number; zOffset: number; };
};

type Landmark = { 
  x: number; 
  y: number; 
};

const FACE_SHAPES = ["heart", "oblong", "oval", "round", "square"];

// Process uploaded photo to prevent crash
const processImageStatic = (file: File, maxWidth: number = 800): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        // Resize the image to prevent crash
        if (width > maxWidth || height > maxWidth) {
          const ratio = Math.min(maxWidth / width, maxWidth / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width; 
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true }); 
        
        // Draw the image on the canvas 
        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);
            const result = canvas.toDataURL("image/jpeg", 0.9); 
            ctx.clearRect(0, 0, width, height);
            canvas.width = 0; canvas.height = 0; // Clean up canvas 
            resolve(result);
        } else {
            resolve(event.target?.result as string); 
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// Process the face canvas to create an ONNX Runtime tensor for inference
const processImage = (faceCanvas: HTMLCanvasElement): ort.Tensor => {
  // Resize the faceCanvas to 224x224 
  const targetSize = 224;
  const resizeCanvas = document.createElement("canvas");

  resizeCanvas.width = targetSize; 
  resizeCanvas.height = targetSize;
  const ctx = resizeCanvas.getContext("2d", { willReadFrequently: true });
  
  if (ctx) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, targetSize, targetSize);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(faceCanvas, 0, 0, targetSize, targetSize);

    /*
    if (typeof window !== "undefined") {
      let debugDiv = document.getElementById("debug-onnx-input");
      if (!debugDiv) {
        debugDiv = document.createElement("div");
        debugDiv.id = "debug-onnx-input";
        debugDiv.style.position = "fixed";
        debugDiv.style.bottom = "10px";
        debugDiv.style.right = "10px";
        debugDiv.style.zIndex = "9999";
        debugDiv.style.background = "white";
        debugDiv.style.padding = "5px";
        debugDiv.style.border = "2px solid red";
        debugDiv.style.borderRadius = "8px";
        document.body.appendChild(debugDiv);
      }
      debugDiv.innerHTML = "<div style='font-size:12px; font-weight:bold; color:black; margin-bottom:5px;'>ONNX Input (224x224)</div>";
      const debugImg = document.createElement("img");
      debugImg.src = resizeCanvas.toDataURL("image/jpeg", 0.9);
      debugImg.style.width = "150px";
      debugImg.style.height = "150px";
      debugDiv.appendChild(debugImg);
    }
    */
  }

  // Convert the resized image data to a Float32Array normalized to [0,1]
  const float32Data = new Float32Array(3 * targetSize * targetSize);
  if (ctx) {
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize).data;
    for (let i = 0; i < targetSize * targetSize; i++) {
      float32Data[i] = imageData[i * 4] / 255.0;                 
      float32Data[targetSize * targetSize + i] = imageData[i * 4 + 1] / 255.0; 
      float32Data[2 * targetSize * targetSize + i] = imageData[i * 4 + 2] / 255.0; 
    }
  }
  
  resizeCanvas.width = 0; resizeCanvas.height = 0;
  return new ort.Tensor("float32", float32Data, [1, 3, targetSize, targetSize]);
};

let sharedFaceShapeModelPromise: Promise<ort.InferenceSession> | null = null;

export default function VirtualTryOnPage() {
  const router = useRouter();
  const params = useSearchParams();
  const productId = params.get("product_id");

  const [appStage, setAppStage] = useState<"SCANNING" | "TRY_ON">(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("vto_appStage");
      if (saved === "SCANNING" || saved === "TRY_ON") return saved;
    }
    return "SCANNING";
  });
  const [tryOnMode, setTryOnMode] = useState<"realtime" | "photo">(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("vto_tryOnMode");
      if (saved === "realtime" || saved === "photo") return saved;
    }
    return "realtime";
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<number>(0);
  const [faceShapeModel, setFaceShapeModel] = useState<ort.InferenceSession | null>(null);
  
  const [liveFaceShape, setLiveFaceShape] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem("vto_liveFaceShape") : null);
  const [liveFaceProb, setLiveFaceProb] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("vto_liveFaceProb");
      return saved ? parseFloat(saved) : null;
    }
    return null;
  });
  const [photoFaceShape, setPhotoFaceShape] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem("vto_photoFaceShape") : null);
  const [photoFaceProb, setPhotoFaceProb] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("vto_photoFaceProb");
      return saved ? parseFloat(saved) : null;
    }
    return null;
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedModel, setSelectedModel] = useState<Product | null>(null);
  const [selectedShapeFilter, setSelectedShapeFilter] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [alignHint, setAlignHint] = useState("Move into frame");
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem("vto_uploadedPhoto") : null);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showFileError, setShowFileError] = useState(false);
  const [isShapeExpanded, setIsShapeExpanded] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const faceServiceRef = useRef(sharedFaceLandmarkerService);
  const rafIdRef = useRef<number | null>(null); 
  const isMountedRef = useRef(true);

  const appStageRef = useRef(appStage);
  const isProcessingRef = useRef(isProcessing);
  const isFaceAlignedRef = useRef(isFaceAligned);
  const alignHintRef = useRef(alignHint);

  useEffect(() => { appStageRef.current = appStage; }, [appStage]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("vto_appStage", appStage);
      sessionStorage.setItem("vto_tryOnMode", tryOnMode);
      if (liveFaceShape) sessionStorage.setItem("vto_liveFaceShape", liveFaceShape); else sessionStorage.removeItem("vto_liveFaceShape");
      if (liveFaceProb !== null) sessionStorage.setItem("vto_liveFaceProb", liveFaceProb.toString()); else sessionStorage.removeItem("vto_liveFaceProb");
      if (photoFaceShape) sessionStorage.setItem("vto_photoFaceShape", photoFaceShape); else sessionStorage.removeItem("vto_photoFaceShape");
      if (photoFaceProb !== null) sessionStorage.setItem("vto_photoFaceProb", photoFaceProb.toString()); else sessionStorage.removeItem("vto_photoFaceProb");
      if (uploadedPhoto) sessionStorage.setItem("vto_uploadedPhoto", uploadedPhoto); else sessionStorage.removeItem("vto_uploadedPhoto");
    }
  }, [appStage, tryOnMode, liveFaceShape, liveFaceProb, photoFaceShape, photoFaceProb, uploadedPhoto]);

  useEffect(() => {
    isMountedRef.current = true;

    async function init() {
      if (appStageRef.current === "SCANNING") {
        await faceServiceRef.current.init("VIDEO");
        startCamera();
      }

      try {
        if (!sharedFaceShapeModelPromise) {
          ort.env.wasm.numThreads = 1;
          ort.env.wasm.simd = false; 
          sharedFaceShapeModelPromise = ort.InferenceSession.create("/face_shape_model/model.onnx", {
            executionProviders: ["wasm"], 
            graphOptimizationLevel: "all"
          });
        }
        const session = await sharedFaceShapeModelPromise;
        setFaceShapeModel(session);
      } catch (err) { console.error("ONNX Load Error:", err); }

      try {
        const productsData = await productService.getAllProducts();
        const mapped: Product[] = productsData.data.map((item: any) => ({
          product_id: item.product_id, 
          brand: item.brand, 
          model: item.model, 
          color: item.color,
          colorName: item.color ? namer(item.color).ntc[0].name : "",
          arModel: item.ar_model ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${item.ar_model.file_path}` : null,
          calibration: item.ar_model ? {
            pitch: item.ar_model.pitch ?? 0, yaw: item.ar_model.yaw ?? 0, roll: item.ar_model.roll ?? 0,
            scale: item.ar_model.scale ?? 1.0, yOffset: item.ar_model.y_offset ?? -0.01, zOffset: item.ar_model.z_offset ?? 0.05
          } : undefined,
          frontImage: item.images?.find((i: any) => i.view_type === "front") ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${item.images.find((i: any) => i.view_type === "front").image_url}` : "",
          faceShape: item.face_shape ? (Array.isArray(item.face_shape) ? item.face_shape : item.face_shape.split("_").map((s: string) => s.trim().toLowerCase()).filter(Boolean)) : [],
        }));

        setProducts(mapped);
        if (productId) {
          const matched = mapped.find(p => String(p.product_id) === String(productId));
          if (matched && matched.arModel) setSelectedModel(matched);
        } else {
          const first = mapped.find(p => p.arModel);
          if (first) setSelectedModel(first);
        }
        setLoadingProducts(false);
      } catch (err) { setLoadingProducts(false); }
    }
    init();

    return () => {
      isMountedRef.current = false;
      stopEverything(); 
      
      // Clear session storage on unmount so navigating away resets the state.
      // On a hard page refresh, this cleanup is bypassed by the browser, preserving the state.
      const keys = [
        "vto_appStage", "vto_tryOnMode", "vto_liveFaceShape", "vto_liveFaceProb", 
        "vto_photoFaceShape", "vto_photoFaceProb", "vto_uploadedPhoto"
      ];
      keys.forEach(k => sessionStorage.removeItem(k));
    };
  }, []);

  const updateHint = (hint: string, aligned: boolean) => {
    if (alignHintRef.current !== hint || isFaceAlignedRef.current !== aligned) {
      alignHintRef.current = hint;
      isFaceAlignedRef.current = aligned;
      setAlignHint(hint);
      setIsFaceAligned(aligned);
    }
  };

  const killPageCamera = () => {
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const stopEverything = () => {
    killPageCamera();
    if (videoRef.current) videoRef.current.srcObject = null;
    if (faceServiceRef.current) faceServiceRef.current.close();
    if (faceShapeModel) { faceShapeModel.release().catch(()=>{}); }
  };

  const startCamera = async () => {
    try {
      killPageCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (!isMountedRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => detectLoop()).catch(()=>{});
        };
      }
      setCameraAvailable(true);
    } catch (err) { setCameraAvailable(false); }
  };

  // Detect faces in real time
  const detectLoop = () => {
    if (!isMountedRef.current || appStageRef.current !== "SCANNING" || isProcessingRef.current) return;

    const service = faceServiceRef.current;
    if (!service.isReady() || !videoRef.current) {
      rafIdRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    const results = service.detectForVideo(videoRef.current, performance.now());
    const ctx = canvasRef.current?.getContext("2d");

    if (ctx && videoRef.current) {
      const vw = videoRef.current.videoWidth; const vh = videoRef.current.videoHeight;
      if (vw > 0 && vh > 0 && (ctx.canvas.width !== vw || ctx.canvas.height !== vh)) {
        ctx.canvas.width = vw; ctx.canvas.height = vh;
      }
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(videoRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    let currentLandmarks = results?.faceLandmarks?.[0] || service.latestLandmarks;

    if (currentLandmarks && currentLandmarks.length > 0) {
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      //Calculate bounding box of detected landmarks
      currentLandmarks.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      });

      // Standardize distance based on device screen width (horizontal FOV) to lock perspective
      const w = maxX - minX;
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      let newHint = "Align your face";
      let aligned = false;
      
      // Strict constraints based purely on width (w) to ensure 100% consistent perspective 
      // distortion across all devices.
      if (w < 0.30) newHint = "Move closer"; 
      else if (w > 0.38) newHint = "Move further away";
      else if (centerX < 0.42) newHint = "Move left"; 
      else if (centerX > 0.58) newHint = "Move right";
      else if (centerY < 0.40) newHint = "Move down"; 
      else if (centerY > 0.60) newHint = "Move up";
      else {
        aligned = true;
        newHint = "Perfect! Click Scan";
      }

      updateHint(newHint, aligned);

      if (ctx) {
        ctx.strokeStyle = aligned ? "#00FF00" : "red"; ctx.lineWidth = 2;
        ctx.strokeRect(minX * ctx.canvas.width, minY * ctx.canvas.height, (maxX - minX) * ctx.canvas.width, (maxY - minY) * ctx.canvas.height);
      }
    } else {
      updateHint("Move into frame", false);
    }

    rafIdRef.current = requestAnimationFrame(detectLoop);
  };

  // Draw landmarks for visual feedback
  const drawVisualLandmarks = (img: HTMLImageElement | HTMLCanvasElement, lm: Landmark[]) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    
    const cw = img.width; 
    const ch = img.height;
    canvasRef.current.width = cw; 
    canvasRef.current.height = ch;
    
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    
    ctx.fillStyle = "rgba(0, 20, 20, 0.4)";
    ctx.fillRect(0, 0, cw, ch);
    
    ctx.fillStyle = "#00FFFF"; 
    ctx.shadowColor = "#00FFFF"; 
    ctx.shadowBlur = 8;
    
    // Get the coordinates of the landmarks 
    const getP = (p: Landmark) => ({ x: p.x * cw, y: p.y * ch });

    // Connect the face landmark points to form an oval 
    const faceOvalIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
    ctx.beginPath();
    faceOvalIndices.forEach((idx, i) => {
      const p = getP(lm[idx]);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(0, 255, 255, 0.7)"; ctx.lineWidth = 1.5; ctx.stroke();
    
    lm.forEach(p => {
      const mapped = getP(p);
      ctx.beginPath(); ctx.arc(mapped.x, mapped.y, 1.2, 0, 2 * Math.PI); ctx.fill();
    });
    ctx.shadowBlur = 0;
  };

  // Predict face shape from image
  const predictFaceShape = async (imageSrc: string, bypassLandmarks: Landmark[] | null = null, skipDraw: boolean = false): Promise<{shape: string, prob: number} | null> => {
    if (!faceShapeModel || !imageSrc) return null;

    return new Promise((resolve) => {
      const img = new Image(); 
      img.src = imageSrc;
      img.onload = async () => {
        const cw = img.width; 
        const ch = img.height;

        let lm1 = bypassLandmarks;
        // Detect landmarks for uploaded photo
        if (!lm1) {
          let results1 = await faceServiceRef.current.detectImage(img);
          let retries = 10; 
          // Retry to ensure robust detection
          while ((!results1?.faceLandmarks || results1.faceLandmarks.length === 0) && retries > 0) {
             await new Promise(r => setTimeout(r, 100));
             results1 = await faceServiceRef.current.detectImage(img);
             retries--;
          }
          lm1 = results1?.faceLandmarks?.[0] || null;
        }

        if (!lm1) { resolve(null); return; }
        
        if (!skipDraw) {
          drawVisualLandmarks(img, lm1);
        }

        //Calculate eye angle for alignment
        const p1 = lm1[33].x < lm1[263].x ? lm1[33] : lm1[263];
        const p2 = lm1[33].x < lm1[263].x ? lm1[263] : lm1[33];
        const angleRad = Math.atan2((p2.y - p1.y) * ch, (p2.x - p1.x) * cw);

        //Align face based on eye angle and crop to bounding box with padding
        const alignedCanvas = document.createElement("canvas");
        alignedCanvas.width = cw; 
        alignedCanvas.height = ch;
        const aCtx = alignedCanvas.getContext("2d", { willReadFrequently: true });
        if (!aCtx) return;

        //Rotate around center and draw original image
        aCtx.fillStyle = "black";
        aCtx.fillRect(0, 0, cw, ch);
        
        aCtx.translate(cw / 2, ch / 2); 
        aCtx.rotate(-angleRad);
        aCtx.imageSmoothingEnabled = true;
        aCtx.imageSmoothingQuality = "high";
        aCtx.drawImage(img, -cw / 2, -ch / 2, cw, ch);
        aCtx.setTransform(1, 0, 0, 1, 0, 0); 

        // Run face landmark detection again on aligned image to get accurate bounding box
        let results2 = await faceServiceRef.current.detectImage(alignedCanvas);
        let retries2 = 10;
        while ((!results2?.faceLandmarks || results2.faceLandmarks.length === 0) && retries2 > 0) {
           await new Promise(r => setTimeout(r, 100));
           results2 = await faceServiceRef.current.detectImage(alignedCanvas);
           retries2--;
        }

        const lm2 = results2?.faceLandmarks?.[0];
        if (!lm2) { console.warn("2nd MediaPipe detection failed!"); resolve(null); return; }

        // Calculate bounding box of detected landmarks
        const xs = lm2.map(p => p.x * cw); 
        const ys = lm2.map(p => p.y * ch);
        const xMin = Math.min(...xs); // Most left point
        const xMax = Math.max(...xs); // Most right point
        const yMin = Math.min(...ys); // Most top point
        const yMax = Math.max(...ys); // Most bottom point

        // Helper function to run inference on a specific bounding box variation
        const runInferenceVariation = async (cropParams: {px: number, py: number, dy: number}): Promise<Float32Array | null> => {
           const padX = (xMax - xMin) * cropParams.px; 
           const padY = (yMax - yMin) * cropParams.py; 
           const offsetY = (yMax - yMin) * cropParams.dy;
           
           const x1 = Math.max(0, xMin - padX); // Left boundary 
           const x2 = Math.min(cw, xMax + padX); // Right boundary 
           const y1 = Math.max(0, yMin - padY + offsetY);  // Top boundary 
           const y2 = Math.min(ch, yMax + padY + offsetY); // Bottom boundary

           const faceCanvas = document.createElement("canvas");
           faceCanvas.width = Math.round(x2 - x1); 
           faceCanvas.height = Math.round(y2 - y1);
           const fCtx = faceCanvas.getContext("2d", { willReadFrequently: true });
         
           if (!fCtx) return null;
           fCtx.fillStyle = "black";
           fCtx.fillRect(0, 0, faceCanvas.width, faceCanvas.height);
           fCtx.drawImage(alignedCanvas, x1, y1, x2 - x1, y2 - y1, 0, 0, faceCanvas.width, faceCanvas.height);

           try {
             const inputTensor = processImage(faceCanvas);
             const feeds = { [faceShapeModel.inputNames[0]]: inputTensor };
             const output = await faceShapeModel.run(feeds);
             return output[faceShapeModel.outputNames[0]].data as Float32Array;
           } catch (e) {
             return null;
           }
        };

        try {
          const startTime = performance.now();
          
          // Reverted TTA Ensemble for speed. Running single standard inference.
          const data = await runInferenceVariation({px: 0.20, py: 0.30, dy: 0});
          
          const endTime = performance.now();
          console.log(`ONNX Inference took: ${(endTime - startTime).toFixed(2)} ms`);

          if (data) {
             const dataArray = Array.from(data);
             const classIdx = dataArray.indexOf(Math.max(...dataArray));
             resolve({ shape: FACE_SHAPES[classIdx], prob: Math.max(...dataArray) });
          } else {
             resolve(null);
          }
        } catch (error) { 
          console.error("ONNX inference failed:", error);
          resolve(null); 
        } 
        finally {
          alignedCanvas.width = 0; alignedCanvas.height = 0;
          img.src = "";
        }
      };
    });
  };

  // Handle real-time scan
  const handleLiveScan = async () => {
    // Stop scanning when face is not aligned
    if (!isFaceAlignedRef.current) return;

    const dataUrl = canvasRef.current?.toDataURL("image/jpeg", 0.9);
    if (!dataUrl) return;

    const currentLiveLandmarks = faceServiceRef.current.latestLandmarks;

    // Stop the camera and processing while we analyze the captured image
    killPageCamera(); 
    setIsProcessing(true);
    await faceServiceRef.current.init("IMAGE"); 

    try {
      // Pass the captured image and landmarks to predict face shape
      const result = await predictFaceShape(dataUrl, currentLiveLandmarks, false);
      if (result) {
        if (faceServiceRef.current) faceServiceRef.current.close();
        setTimeout(() => {
          setLiveFaceShape(result.shape);
          setLiveFaceProb(result.prob);
          setSelectedShapeFilter(result.shape);
          setTryOnMode("realtime"); // Access the real-time mode
          setIsProcessing(false);
          setAppStage("TRY_ON"); 
        }, 800); 
      } else { resetToScanning(); } // Reset to scanning mode
    } catch (error) { resetToScanning(); }
  };

  // Handle photo upload for virtual try on
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setShowFileError(true);
      e.target.value = '';
      return;
    }

    killPageCamera(); 
    
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    setTryOnMode("photo");
    setAppStage("TRY_ON"); 
    setIsProcessing(true); 

    setPhotoFaceShape(null); 
    setPhotoFaceProb(null);

    await faceServiceRef.current.init("IMAGE"); 
    
    const compressedDataUrl = await processImageStatic(file, 800);

    setUploadSessionId(Date.now());
    
    setUploadedPhoto(compressedDataUrl);
    await new Promise(resolve => setTimeout(resolve, 50));

    const result = await predictFaceShape(compressedDataUrl, null, true);

    if (result) {
      if (faceServiceRef.current) faceServiceRef.current.close();
      setPhotoFaceShape(result.shape); 
      setPhotoFaceProb(result.prob);
      setSelectedShapeFilter(result.shape);
      setIsProcessing(false);
    } else {
      setErrorMessage("No face detected. Please use a clear front-facing photo.");
      setShowErrorModal(true);
      setUploadedPhoto(null);
      if (faceServiceRef.current) faceServiceRef.current.close();
      setIsProcessing(false);
    }
  };

  // Reset to scanning mode
  const resetToScanning = async () => {
    setIsProcessing(false);
    setAppStage("SCANNING");
    await faceServiceRef.current.init("VIDEO");
    startCamera(); 
  };

  const getConfidenceMessage = (prob: number) => {
    if (prob >= 0.9) return { text: "High confidence", color: "#155724", bg: "#d4edda", border: "#c3e6cb", icon: "bi-check-circle-fill" };
    if (prob >= 0.6) return { text: "Medium confidence", color: "#856404", bg: "#fff3cd", border: "#ffeeba", icon: "bi-exclamation-triangle-fill" };
    return { text: "Low confidence", color: "#721c24", bg: "#f8d7da", border: "#f5c6cb", icon: "bi-x-circle-fill" };
  };

  const handleSaveFaceShape = async () => {
    const activeShape = tryOnMode === "photo" ? photoFaceShape : liveFaceShape;
    if (!activeShape) return;
    setSaveStatus("saving");
    try {
      const profileRes = await userService.getProfile();
      const profile = profileRes.data;
      await userService.updateProfile(profile.username, profile.gender, profile.phone_number, activeShape);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      console.error("Failed to save face shape:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  };

  // Derived state calculations
  const activeShape = tryOnMode === "photo" ? photoFaceShape : liveFaceShape;
  const activeProb = tryOnMode === "photo" ? photoFaceProb : liveFaceProb;
  const activeShapeForFilter = activeShape || "oval";
  
  const filteredProducts = products.filter(p => p.arModel).filter(p => {
    if (!selectedShapeFilter) return true;
    return p.faceShape?.includes(selectedShapeFilter);
  }).sort((a, b) => {
    const aMatch = a.faceShape?.includes(activeShapeForFilter) ? 1 : 0;
    const bMatch = b.faceShape?.includes(activeShapeForFilter) ? 1 : 0;
    return bMatch - aMatch;
  });

  return (
    <div className="vto-page">
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} />

      <div className="vto-top">
        <div className="vto-left">
          <div className="d-flex align-items-center mb-3 mb-md-4">
            <button className="btn btn-dark" onClick={() => {
              if (appStage === "TRY_ON") resetToScanning();
              else router.back();
            }}>
              <i className="bi bi-arrow-left"></i>
            </button>
            <span className="ms-2 text-muted fw-semibold text-uppercase small cursor-pointer" onClick={() => {
              if (appStage === "TRY_ON") resetToScanning();
              else router.back();
            }}>Back</span>
          </div>

          {appStage === "TRY_ON" && (
            <div className="shape-result">
              <div className="shape-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', paddingBottom: '8px' }} onClick={() => setIsShapeExpanded(!isShapeExpanded)}>
                <h3 style={{ textAlign: 'center', margin: 0 }}>Your Face Shape</h3>
                <i className={`bi bi-chevron-${isShapeExpanded ? 'up' : 'down'} mobile-only-icon`}></i>
              </div>
              
              <div className={`shape-result-content ${isShapeExpanded ? 'expanded' : ''}`}>
                {activeShape ? (
                  <>
                    <div className="shape-badge" style={{ textTransform: 'capitalize', fontSize: '20px', padding: '6px 24px', borderRadius: '25px', background: 'var(--primary-color, #d32f2f)', color: 'white', fontWeight: 'bold' }}>
                      {activeShape}
                    </div>
                    {activeProb !== null && (
                      <div style={{ fontSize: '13px', padding: '4px 12px', borderRadius: '12px', fontWeight: '600', color: activeProb >= 0.9 ? '#155724' : activeProb >= 0.6 ? '#856404' : '#721c24', backgroundColor: activeProb >= 0.9 ? '#d4edda' : activeProb >= 0.6 ? '#fff3cd' : '#f8d7da', border: `1px solid ${activeProb >= 0.9 ? '#c3e6cb' : activeProb >= 0.6 ? '#ffeeba' : '#f5c6cb'}` }}>
                        Confidence: {(activeProb * 100).toFixed(0)}%
                      </div>
                    )}
                    {activeProb !== null && (() => {
                      const conf = getConfidenceMessage(activeProb);
                      return (
                        <div style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "12px", fontWeight: 500, color: conf.color, backgroundColor: conf.bg, border: `1px solid ${conf.border}`, textAlign: "center", maxWidth: "220px" }}>
                          <i className={`bi ${conf.icon} me-1`} /> {conf.text}
                        </div>
                      );
                    })()}
                    {userService.hasValidToken() && (
                      <button 
                        className={`btn mt-2 w-100 ${saveStatus === 'saved' ? 'btn-success' : saveStatus === 'error' ? 'btn-danger' : 'btn-outline-primary'}`} 
                        onClick={handleSaveFaceShape} 
                        disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                        style={{ maxWidth: '220px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}
                      >
                        {saveStatus === 'idle' && <span>Save Face Shape</span>}
                        {saveStatus === 'saving' && <span><span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Saving...</span>}
                        {saveStatus === 'saved' && <span><i className="bi bi-check-circle-fill me-1"></i>Saved!</span>}
                        {saveStatus === 'error' && <span><i className="bi bi-exclamation-triangle-fill me-1"></i>Error</span>}
                      </button>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#888', fontSize: '14px', fontStyle: 'italic', padding: '10px 0' }}>
                    Waiting for photo...
                  </div>
                )}

                <div style={{ marginTop: '20px', textAlign: 'center', width: '100%' }}>
                  <div style={{fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: 'bold'}}>
                    {tryOnMode === "realtime" ? "Switch to Photo Mode:" : "Switch to Live Camera:"}
                  </div>
                  <button className="upload-btn" disabled={isProcessing} onClick={() => {
                    if (tryOnMode === "realtime") {
                       setTryOnMode("photo");
                       killPageCamera(); 
                    } else {
                       setIsProcessing(true);
                       setTimeout(() => {
                         setTryOnMode("realtime");
                         setIsProcessing(false);
                       }, 600);
                    }
                  }}>
                    {tryOnMode === "realtime" ? "Upload Photo" : "Real Time"}
                  </button>
                  {tryOnMode === "photo" && uploadedPhoto && (
                    <div style={{ marginTop: '15px' }}>
                      <div style={{fontSize: '12px', color: '#666', marginBottom: '8px', fontWeight: 'bold'}}>Try another photo:</div>
                      <button className="upload-btn" disabled={isProcessing} style={{background: '#444'}} onClick={() => fileInputRef.current?.click()}>Change Photo</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="vto-center" style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: tryOnMode === "photo" ? '#111' : 'transparent' }}>
          
          {isProcessing && (
            <div className="face-scanner-overlay" style={{ 
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)', 
              backdropFilter: 'blur(4px)', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center',
              zIndex: 10
            }}>
                <div className="hint-text" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white' }}>
                  <div className="spinner-border spinner-border-sm text-light" role="status"></div>
                  Analyzing Face...
                </div>
            </div>
          )}

          {appStage === "TRY_ON" && !isProcessing && (
            tryOnMode === "photo" && !uploadedPhoto ? (
              <div className="vto-ar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa', height: '100%', width: '100%' }}>
                  <p style={{marginBottom: '20px'}}>Please upload a clear selfie to try on glasses.</p>
                  <button className="center-upload-btn" onClick={() => fileInputRef.current?.click()}>Upload Photo</button>
              </div>
            ) : (
              selectedModel ? (
                <VirtualTryOnCanvas
                  key={`ar-canvas-${tryOnMode}-${tryOnMode === 'photo' ? uploadSessionId : 'live'}`} 
                  modelPath={selectedModel.arModel!} 
                  initialCalibration={selectedModel.calibration} 
                  staticImageSrc={tryOnMode === "photo" ? uploadedPhoto : null} 
                />
              ) : (
                <div className="loading">Loading model...</div>
              )
            )
          )}

          <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />
          
          <canvas
            ref={canvasRef}
            style={{ 
               width: "100%", 
               height: "100%", 
               objectFit: "cover", 
               transform: "scaleX(-1)",
               display: (appStage === "SCANNING" || (isProcessing && tryOnMode === "realtime")) ? "block" : "none" 
            }}
          />

          {appStage === "SCANNING" && !isProcessing && (
            cameraAvailable ? (
              <div className="face-scanner-overlay aligned" style={{ position: 'absolute', pointerEvents: 'none' }}>
                <div className={`guide-oval ${isFaceAligned ? "active" : ""}`}>
                  <div className="corner-mark tl"></div><div className="corner-mark tr"></div>
                  <div className="corner-mark bl"></div><div className="corner-mark br"></div>
                </div>
                <div className="hint-text">{alignHint}</div>
              </div>
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8f9fa', padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '10px' }}>Webcam Unavailable</p>
                <p style={{ fontSize: '15px', color: '#555', maxWidth: '350px', lineHeight: '1.5', margin: 0 }}>
                  We couldn't access your camera. Please click <b>"Or upload a photo"</b> below to use the Photo Try-On feature.
                </p>
              </div>
            )
          )}
        </div>

        <div className="vto-right">
          {appStage === "TRY_ON" && (
            <div className="filter-panel">
              <h3>Filter by Face Shape</h3>
              {FACE_SHAPES.map(shape => (
                <button key={shape} className={`filter-btn ${selectedShapeFilter === shape ? "active" : ""}`} onClick={() => setSelectedShapeFilter(selectedShapeFilter === shape ? null : shape)}>
                  {shape}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="vto-bottom product-area">
        {appStage === "SCANNING" && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <button 
              onClick={handleLiveScan} 
              className="scan-btn" 
              disabled={!isFaceAligned || !faceShapeModel || isProcessing}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                minWidth: '180px',
                transition: 'all 0.3s ease'
              }}
            >
              {!faceShapeModel ? (
                <>
                  <div className="spinner-border spinner-border-sm text-light" role="status"></div>
                  <span>Loading Engine...</span>
                </>
              ) : (
                "Scan Face"
              )}
            </button>
            
            {!cameraAvailable && (
              <button 
                disabled={isProcessing} 
                onClick={ () => {
                  killPageCamera();
                  setUploadedPhoto(null);
                  setTryOnMode("photo");
                  setAppStage("TRY_ON");
                }}
                className="upload-link-btn" 
                style={{ marginTop: '12px'}}
              >
                Or upload a photo
              </button>
            )}
          </div>
        )}

        {appStage === "TRY_ON" && (
          loadingProducts ? (
            <div className="loading">Loading products...</div>
          ) : (
            <div className="product-grid">
              {filteredProducts.length > 0 ? (
                filteredProducts.map(p => (
                  <div key={p.product_id} className={`product-card ${selectedModel?.arModel === p.arModel ? "active" : ""}`} onClick={() => setSelectedModel(p)}>
                    <img src={p.frontImage} />
                    <div className="info" style={{textAlign: 'center'}}>
                      <div className="brand">{p.brand}</div>
                      <div className="model">{p.model}</div>
                      <div className="color">
                        {p.color && (
                          <span className="badge border d-inline-flex align-items-center gap-1" style={{ fontSize: "9px", padding: "3px 6px" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: p.color, display: "inline-block" }}></span>
                            <span className="text-dark">{p.colorName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: "center", padding: "2rem", color: "#888", gridColumn: "1 / -1" }}>
                  <p style={{ margin: 0 }}>No product suitable for selected face shape, try others</p>
                </div>
              )}
            </div>
          )
        )}
      </div>

      <Modal show={showErrorModal} centered onHide={() => {setShowErrorModal(false); if (tryOnMode === "realtime") resetToScanning();}}>
        <Modal.Header closeButton><Modal.Title style={{ color: 'black' }}>Detection Failed</Modal.Title></Modal.Header>
        <Modal.Body className="text-center p-4">
          <p style={{ color: '#333' }}>{errorMessage}</p>
          <Button variant="danger" onClick={() => {setShowErrorModal(false); if (tryOnMode === "realtime") resetToScanning();}} className="mt-3">Okay</Button>
        </Modal.Body>
      </Modal>

      <Modal show={showFileError} centered onHide={() => setShowFileError(false)}>
        <Modal.Body className="text-center p-4">
          <div className="text-danger mb-3">
            <i className="bi bi-file-earmark-x" style={{ fontSize: "3rem" }}></i>
          </div>
          <h5 style={{ color: 'black' }}>Invalid File Format!</h5>
          <p className="text-muted">Only <strong>.jpg, .jpeg,</strong> and <strong>.png</strong> files are supported for photo try-on.</p>
          <Button variant="danger" className="px-4" onClick={() => setShowFileError(false)}>
            Close
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}