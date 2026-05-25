"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import * as ort from "onnxruntime-web";
import axiosInstance from "@/services/axios-instance";
import namer from "color-namer";
import { Modal, Button } from "react-bootstrap";

import { FaceLandmarkerService } from "@/services/face-landmarker.service";
import VirtualTryOnCanvas from "@/components/virtual-try-on-canvas";
import "./virtual-try-on.css";

const isMobile = typeof window !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const downscaleImage = (file: File, maxWidth: number = 800): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) { height = Math.round((height * maxWidth) / width); width = maxWidth; } 
          else { width = Math.round((width * maxWidth) / height); height = maxWidth; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const result = canvas.toDataURL("image/jpeg", 0.8);
        ctx?.clearRect(0, 0, width, height);
        canvas.width = 0; canvas.height = 0; img.src = ""; resolve(result);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const processImageForConsistency = (file: File, maxWidth: number = 800): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        
        if (width > maxWidth || height > maxWidth) {
          const ratio = Math.min(maxWidth / width, maxWidth / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width; 
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true }); 
        
        if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);
            const result = canvas.toDataURL("image/jpeg", 0.9); 
            ctx.clearRect(0, 0, width, height);
            canvas.width = 0; canvas.height = 0; 
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

function preprocessImage(faceCanvas: HTMLCanvasElement): ort.Tensor {
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
  }

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
}

type Product = {
  product_id: string; brand: string; model: string; color?: string; colorName?: string;
  frontImage: string; arModel: string | null; faceShape?: string[];
  calibration?: { pitch: number; yaw: number; roll: number; scale: number; yOffset: number; zOffset: number; };
};

type Landmark = { x: number; y: number };
const CLASS_NAMES = ["heart", "oblong", "oval", "round", "square"];
const FACE_SHAPES = ["heart", "oblong", "oval", "round", "square"];

export default function VirtualTryOnApp() {
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [tryOnMode, setTryOnMode] = useState<"realtime" | "photo">(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("vto_tryOnMode");
      if (saved === "realtime" || saved === "photo") return saved;
    }
    return "realtime";
  });

  const [uploadSessionId, setUploadSessionId] = useState<number>(0);

  const [arModel, setArModel] = useState<ort.InferenceSession | null>(null);
  
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

  const activeShape = tryOnMode === "photo" ? photoFaceShape : liveFaceShape;
  const activeProb = tryOnMode === "photo" ? photoFaceProb : liveFaceProb;

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedModel, setSelectedModel] = useState<Product | null>(null);
  const [selectedShapeFilter, setSelectedShapeFilter] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [alignHint, setAlignHint] = useState("Move into frame");
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(() => typeof window !== "undefined" ? sessionStorage.getItem("vto_uploadedPhoto") : null);

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
  
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isShapeExpanded, setIsShapeExpanded] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const faceServiceRef = useRef(new FaceLandmarkerService());
  const rafIdRef = useRef<number | null>(null); 
  const isMountedRef = useRef(true);

  const appStageRef = useRef(appStage);
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => { appStageRef.current = appStage; }, [appStage]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  
  const isFaceAlignedRef = useRef(isFaceAligned);
  const alignHintRef = useRef(alignHint);

  const updateHint = (hint: string, aligned: boolean) => {
    if (alignHintRef.current !== hint || isFaceAlignedRef.current !== aligned) {
      alignHintRef.current = hint;
      isFaceAlignedRef.current = aligned;
      setAlignHint(hint);
      setIsFaceAligned(aligned);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    async function init() {
      if (appStageRef.current === "SCANNING") {
        await faceServiceRef.current.init("VIDEO");
        startCamera();
      }

      try {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = false; 
        
        const session = await ort.InferenceSession.create("/face_shape_model/model.onnx", {
          executionProviders: ["wasm"], 
          graphOptimizationLevel: "all"
        });
        setArModel(session);
      } catch (err) { console.error("ONNX Load Error:", err); }

      try {
        const res = await axiosInstance.get("/products");
        const mapped: Product[] = res.data.map((item: any) => ({
          product_id: item.product_id, brand: item.brand, model: item.model, color: item.color,
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
    };
  }, []);

  const killPageCamera = () => {
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const stopEverything = () => {
    killPageCamera();
    if (videoRef.current) videoRef.current.srcObject = null;
    if (faceServiceRef.current) faceServiceRef.current.close();
    if (arModel) { arModel.release().catch(()=>{}); }
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
      currentLandmarks.forEach(p => {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      });

      const w = maxX - minX;
      let newHint = "Align your face";
      let aligned = false;
      
      if (w < 0.2) newHint = "Move closer"; else if (w > 0.6) newHint = "Move further away";
      else if (minX < 0.2) newHint = "Move left"; else if (maxX > 0.8) newHint = "Move right";
      else if (minY < 0.2) newHint = "Move down"; else if (maxY > 0.8) newHint = "Move up";
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

  const drawSciFiLandmarks = (img: HTMLImageElement | HTMLCanvasElement, lm: Landmark[]) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    
    const cw = img.width; const ch = img.height;
    canvasRef.current.width = cw; canvasRef.current.height = ch;
    
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    
    ctx.fillStyle = "rgba(0, 20, 20, 0.4)";
    ctx.fillRect(0, 0, cw, ch);
    
    ctx.fillStyle = "#00FFFF"; ctx.shadowColor = "#00FFFF"; ctx.shadowBlur = 8;
    
    const getP = (p: Landmark) => ({ x: p.x * cw, y: p.y * ch });

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

  const predictFaceShape = async (imageSrc: string, bypassLandmarks: Landmark[] | null = null, skipDraw: boolean = false): Promise<{shape: string, prob: number} | null> => {
    if (!arModel || !imageSrc) return null;

    return new Promise((resolve) => {
      const img = new Image(); img.src = imageSrc;
      img.onload = async () => {
        const cw = img.width; const ch = img.height;

        let lm1 = bypassLandmarks;
        if (!lm1) {
          let results1 = await faceServiceRef.current.detectImage(img);
          let retries = 10; 
          while ((!results1?.faceLandmarks || results1.faceLandmarks.length === 0) && retries > 0) {
             await new Promise(r => setTimeout(r, 100));
             results1 = await faceServiceRef.current.detectImage(img);
             retries--;
          }
          lm1 = results1?.faceLandmarks?.[0] || null;
        }

        if (!lm1) { resolve(null); return; }
        
        if (!skipDraw) {
          drawSciFiLandmarks(img, lm1);
        }

        const p1 = lm1[33].x < lm1[263].x ? lm1[33] : lm1[263];
        const p2 = lm1[33].x < lm1[263].x ? lm1[263] : lm1[33];
        const angleRad = Math.atan2((p2.y - p1.y) * ch, (p2.x - p1.x) * cw);

        const alignedCanvas = document.createElement("canvas");
        alignedCanvas.width = cw; alignedCanvas.height = ch;
        const aCtx = alignedCanvas.getContext("2d", { willReadFrequently: true });
        if (!aCtx) return;

        aCtx.fillStyle = "black";
        aCtx.fillRect(0, 0, cw, ch);
        
        aCtx.translate(cw / 2, ch / 2); 
        aCtx.rotate(-angleRad);
        aCtx.imageSmoothingEnabled = true;
        aCtx.imageSmoothingQuality = "high";
        aCtx.drawImage(img, -cw / 2, -ch / 2, cw, ch);
        aCtx.setTransform(1, 0, 0, 1, 0, 0); 

        let results2 = await faceServiceRef.current.detectImage(alignedCanvas);
        let retries2 = 10;
        while ((!results2?.faceLandmarks || results2.faceLandmarks.length === 0) && retries2 > 0) {
           await new Promise(r => setTimeout(r, 100));
           results2 = await faceServiceRef.current.detectImage(alignedCanvas);
           retries2--;
        }

        const lm2 = results2?.faceLandmarks?.[0];
        if (!lm2) { console.warn("2nd MediaPipe detection failed!"); resolve(null); return; }

        const xs = lm2.map(p => p.x * cw); const ys = lm2.map(p => p.y * ch);
        const xMin = Math.min(...xs); const xMax = Math.max(...xs);
        const yMin = Math.min(...ys); const yMax = Math.max(...ys);

        const padX = (xMax - xMin) * 0.2; const padY = (yMax - yMin) * 0.3; 
        
        const x1 = Math.max(0, xMin - padX); const x2 = Math.min(cw, xMax + padX);
        const y1 = Math.max(0, yMin - padY); const y2 = Math.min(ch, yMax + padY);

        const faceCanvas = document.createElement("canvas");
        faceCanvas.width = Math.round(x2 - x1); 
        faceCanvas.height = Math.round(y2 - y1);
        const fCtx = faceCanvas.getContext("2d", { willReadFrequently: true });
        if (fCtx) {
           fCtx.fillStyle = "black";
           fCtx.fillRect(0, 0, faceCanvas.width, faceCanvas.height);
           fCtx.drawImage(alignedCanvas, x1, y1, x2 - x1, y2 - y1, 0, 0, faceCanvas.width, faceCanvas.height);
        }

        try {
          const inputTensor = preprocessImage(faceCanvas);
          const feeds = { [arModel.inputNames[0]]: inputTensor };
          const output = await arModel.run(feeds);
          const data = output[arModel.outputNames[0]].data as Float32Array;
          const classIdx = data.indexOf(Math.max(...Array.from(data)));
          resolve({ shape: CLASS_NAMES[classIdx], prob: Math.max(...Array.from(data)) });
        } catch (error) { 
          console.error("ONNX inference failed:", error);
          resolve(null); 
        } 
        finally {
          alignedCanvas.width = 0; alignedCanvas.height = 0;
          faceCanvas.width = 0; faceCanvas.height = 0; img.src = "";
        }
      };
    });
  };

  const handleLiveScan = async () => {
    if (!isFaceAlignedRef.current) return;
    const dataUrl = canvasRef.current?.toDataURL("image/jpeg", 0.9);
    if (!dataUrl) return;

    const currentLiveLandmarks = faceServiceRef.current.latestLandmarks;

    killPageCamera(); 
    setIsProcessing(true);
    await faceServiceRef.current.init("IMAGE"); 

    try {
      const result = await predictFaceShape(dataUrl, currentLiveLandmarks, false);
      if (result) {
        if (faceServiceRef.current) faceServiceRef.current.close();
        setTimeout(() => {
          setLiveFaceShape(result.shape);
          setLiveFaceProb(result.prob);
          setTryOnMode("realtime");
          setIsProcessing(false);
          setAppStage("TRY_ON"); 
        }, 800); 
      } else { resetToScanning(); }
    } catch (error) { resetToScanning(); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
    
    const compressedDataUrl = await processImageForConsistency(file, 800);

    setUploadSessionId(Date.now());
    
    setUploadedPhoto(compressedDataUrl);
    await new Promise(resolve => setTimeout(resolve, 50));

    const result = await predictFaceShape(compressedDataUrl, null, true);

    if (result) {
      if (faceServiceRef.current) faceServiceRef.current.close();
      setPhotoFaceShape(result.shape); 
      setPhotoFaceProb(result.prob);
      setIsProcessing(false);
    } else {
      setErrorMessage("No face detected. Please use a clear front-facing photo.");
      setShowErrorModal(true);
      setUploadedPhoto(null);
      if (faceServiceRef.current) faceServiceRef.current.close();
      setIsProcessing(false);
    }
  };

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
          {appStage === "SCANNING" && productId && (
            <button className="back-btn" onClick={() => router.back()}>← back</button>
          )}

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
            <div className="face-scanner-overlay aligned" style={{ position: 'absolute', pointerEvents: 'none' }}>
              <div className={`guide-oval ${isFaceAligned ? "active" : ""}`}>
                <div className="corner-mark tl"></div><div className="corner-mark tr"></div>
                <div className="corner-mark bl"></div><div className="corner-mark br"></div>
              </div>
              <div className="hint-text">{alignHint}</div>
            </div>
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
              disabled={!isFaceAligned || !arModel || isProcessing}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                minWidth: '180px',
                transition: 'all 0.3s ease'
              }}
            >
              {!arModel ? (
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
              {filteredProducts.map(p => (
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
              ))}
            </div>
          )
        )}
      </div>

      <Modal show={showErrorModal} centered onHide={() => {setShowErrorModal(false); if (tryOnMode === "realtime") resetToScanning();}}>
        <Modal.Header closeButton><Modal.Title style={{ color: 'black' }}>Detection Failed</Modal.Title></Modal.Header>
        <Modal.Body className="text-center p-4">
          <p style={{ color: '#333' }}>{errorMessage}</p>
          <Button variant="danger" onClick={() => {setShowErrorModal(false); if (tryOnMode === "realtime") resetToScanning();}} className="mt-3">OK</Button>
        </Modal.Body>
      </Modal>
    </div>
  );
}