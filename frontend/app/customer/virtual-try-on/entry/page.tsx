"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import * as ort from "onnxruntime-web";
import { FaceLandmarkerService } from "@/services/face-landmarker.service";
import "../virtual-try-on.css";

// --- 完美复刻 4_predict_face.py 的预处理逻辑 ---
function preprocessImage(canvas: HTMLCanvasElement): { tensor: ort.Tensor, debugUrl: string } {
  // 1. 保持比例缩放，让最短边绝对不小于 224
  const w = canvas.width;
  const h = canvas.height;
  const scale = 224.0 / Math.min(h, w);
  
  const new_w = Math.max(224, Math.round(w * scale));
  const new_h = Math.max(224, Math.round(h * scale));
  
  const scaledCanvas = document.createElement("canvas");
  scaledCanvas.width = new_w;
  scaledCanvas.height = new_h;
  const sCtx = scaledCanvas.getContext("2d");
  if (sCtx) sCtx.drawImage(canvas, 0, 0, new_w, new_h);
  
  // 2. 从正中心裁剪出 224x224 的区域
  const top = Math.floor((new_h - 224) / 2);
  const left = Math.floor((new_w - 224) / 2);
  
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = 224;
  cropCanvas.height = 224;
  const cCtx = cropCanvas.getContext("2d");
  if (cCtx) cCtx.drawImage(scaledCanvas, left, top, 224, 224, 0, 0, 224, 224);
  
  // 3. 归一化和维度转换 (HWC -> CHW)
  const float32Data = new Float32Array(3 * 224 * 224);
  if (cCtx) {
    const imageData = cCtx.getImageData(0, 0, 224, 224).data;
    for (let i = 0; i < 224 * 224; i++) {
      float32Data[i] = imageData[i * 4] / 255.0;                 // R
      float32Data[224 * 224 + i] = imageData[i * 4 + 1] / 255.0; // G
      float32Data[2 * 224 * 224 + i] = imageData[i * 4 + 2] / 255.0; // B
    }
  }
  
  const tensor = new ort.Tensor("float32", float32Data, [1, 3, 224, 224]);
  return { tensor, debugUrl: cropCanvas.toDataURL("image/jpeg") };
}

type Landmark = { x: number; y: number };

const CLASS_NAMES = ["heart", "oblong", "oval", "round", "square"];

export default function EntryPage() {
  const router = useRouter();
  const params = useSearchParams();
  const productId = params.get("product_id");

  const [arModel, setArModel] = useState<ort.InferenceSession | null>(null);
  const [hasFace, setHasFace] = useState(false);
  const [isFaceAligned, setIsFaceAligned] = useState(false);
  const [debug, setDebug] = useState({ x: 0, y: 0, w: 0, h: 0, stable: 0 });
  const [stage, setStage] = useState<"camera" | "processing">("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [debugCropUrl, setDebugCropUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const faceServiceRef = useRef(new FaceLandmarkerService());
  const stableCountRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    async function init() {
      await faceServiceRef.current.init();
      startCamera();

      try {
        ort.env.wasm.numThreads = 1;
        const session = await ort.InferenceSession.create("/face_shape_model/best.onnx", {
          executionProviders: ['webgl', 'wasm']
        });
        setArModel(session);
        console.log("ONNX model loaded successfully");
      } catch (err) {
        console.error("Failed to load ONNX model:", err);
      }
    }
    init();

    return () => {
      isMountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current?.play();
          detectLoop();
        };
      }
    } catch (err) {
      console.warn("Webcam unavailable", err);
      setCameraAvailable(false);
    }
  };

  const detectLoop = () => {
    if (!isMountedRef.current || stage !== "camera") return;
    
    const service = faceServiceRef.current;
    if (!service.isReady() || !videoRef.current) {
      requestAnimationFrame(detectLoop);
      return;
    }

    const results = service.detectForVideo(videoRef.current, performance.now());
    const ctx = canvasRef.current?.getContext("2d");

    if (ctx && videoRef.current) {
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      if (vw > 0 && vh > 0 && (ctx.canvas.width !== vw || ctx.canvas.height !== vh)) {
        ctx.canvas.width = vw;
        ctx.canvas.height = vh;
      }
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(videoRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    if (results && results.faceLandmarks.length > 0) {
      const landmarks = results.faceLandmarks[0];
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      landmarks.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });

      const aligned = minX >= 0.15 && maxX <= 0.85 && minY >= 0.15 && maxY <= 0.85;

      if (aligned) {
        stableCountRef.current += 1;
        if (stableCountRef.current > 8) setIsFaceAligned(true);
      } else {
        stableCountRef.current = 0;
        setIsFaceAligned(false);
      }

      setHasFace(true);
      setDebug({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY, stable: stableCountRef.current });

      if (ctx) {
        ctx.strokeStyle = aligned ? "#00FF00" : "red";
        ctx.lineWidth = 2;
        ctx.strokeRect(minX * ctx.canvas.width, minY * ctx.canvas.height, (maxX - minX) * ctx.canvas.width, (maxY - minY) * ctx.canvas.height);
      }
    } else {
      setHasFace(false);
      setIsFaceAligned(false);
      stableCountRef.current = 0;
    }
    requestAnimationFrame(detectLoop);
  };

  const predictFaceShape = async (imageSrc: string): Promise<string | null> => {
    if (!arModel || !imageSrc) return null;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;
      
      img.onload = async () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const bitmap1 = await createImageBitmap(canvas);
        const results1 = await faceServiceRef.current.detectImage(bitmap1 as unknown as HTMLImageElement);
        const lm1: Landmark[] | undefined = results1?.faceLandmarks?.[0];

        if (!lm1 || lm1.length === 0) {
          alert("No face detected in snapshot. Please try another photo.");
          resolve(null);
          return;
        }

        const cw = canvas.width;
        const ch = canvas.height;

        const xs1 = lm1.map((p: Landmark) => p.x * cw);
        const ys1 = lm1.map((p: Landmark) => p.y * ch);
        
        let initMinX = Math.min(...xs1);
        let initMaxX = Math.max(...xs1);
        let initMinY = Math.min(...ys1);
        let initMaxY = Math.max(...ys1);

        const initPadX = (initMaxX - initMinX) * 0.5;
        const initPadY = (initMaxY - initMinY) * 0.5;

        initMinX = Math.max(0, initMinX - initPadX);
        initMaxX = Math.min(cw, initMaxX + initPadX);
        initMinY = Math.max(0, initMinY - initPadY);
        initMaxY = Math.min(ch, initMaxY + initPadY);

        const initCropW = initMaxX - initMinX;
        const initCropH = initMaxY - initMinY;

        const broadCanvas = document.createElement("canvas");
        broadCanvas.width = initCropW;
        broadCanvas.height = initCropH;
        const broadCtx = broadCanvas.getContext("2d");
        if (!broadCtx) { resolve(null); return; }
        broadCtx.drawImage(canvas, initMinX, initMinY, initCropW, initCropH, 0, 0, initCropW, initCropH);

        const leftEye1 = lm1[33];
        const rightEye1 = lm1[263];
        const dx = (rightEye1.x - leftEye1.x) * cw;
        const dy = (rightEye1.y - leftEye1.y) * ch;
        const angle = Math.atan2(dy, dx); 

        const alignedCanvas = document.createElement("canvas");
        alignedCanvas.width = initCropW;
        alignedCanvas.height = initCropH;
        const aCtx = alignedCanvas.getContext("2d");
        if (!aCtx) { resolve(null); return; }

        aCtx.fillStyle = "black";
        aCtx.fillRect(0, 0, initCropW, initCropH);
        aCtx.translate(initCropW / 2, initCropH / 2);
        aCtx.rotate(-angle); 
        aCtx.drawImage(broadCanvas, -initCropW / 2, -initCropH / 2);

        const bitmap2 = await createImageBitmap(alignedCanvas);
        const results2 = await faceServiceRef.current.detectImage(bitmap2 as unknown as HTMLImageElement);
        const lm2: Landmark[] | undefined = results2?.faceLandmarks?.[0];

        if (!lm2 || lm2.length === 0) {
          alert("Face lost after alignment. Please try another photo.");
          resolve(null);
          return;
        }

        const xs2 = lm2.map((p: Landmark) => p.x * initCropW);
        const ys2 = lm2.map((p: Landmark) => p.y * initCropH);

        let finalMinX = Math.min(...xs2);
        let finalMaxX = Math.max(...xs2);
        let finalMinY = Math.min(...ys2);
        let finalMaxY = Math.max(...ys2);

        const finalPadX = (finalMaxX - finalMinX) * 0.2;
        const finalPadY = (finalMaxY - finalMinY) * 0.3;

        finalMinX = Math.max(0, finalMinX - finalPadX);
        finalMaxX = Math.min(initCropW, finalMaxX + finalPadX);
        finalMinY = Math.max(0, finalMinY - finalPadY);
        finalMaxY = Math.min(initCropH, finalMaxY + finalPadY);

        const finalCropW = finalMaxX - finalMinX;
        const finalCropH = finalMaxY - finalMinY;

        const faceCanvas = document.createElement("canvas");
        faceCanvas.width = finalCropW;
        faceCanvas.height = finalCropH;
        const fCtx = faceCanvas.getContext("2d");
        if (!fCtx) { resolve(null); return; }

        fCtx.drawImage(alignedCanvas, finalMinX, finalMinY, finalCropW, finalCropH, 0, 0, finalCropW, finalCropH);

        const { tensor: inputTensor, debugUrl } = preprocessImage(faceCanvas);
        setDebugCropUrl(debugUrl);

        try {
          const feeds: Record<string, ort.Tensor> = {};
          feeds[arModel.inputNames[0]] = inputTensor;
          
          const results = await arModel.run(feeds);
          const output = results[arModel.outputNames[0]];
          const data = output.data as Float32Array;
          
          let classIdx = 0;
          let maxProb = data[0];
          for (let i = 1; i < data.length; i++) {
            if (data[i] > maxProb) {
              maxProb = data[i];
              classIdx = i;
            }
          }
          
          const shape = CLASS_NAMES[classIdx];
          console.log("ONNX Prediction Probabilities:", data);
          resolve(shape); 
        } catch (err) {
          console.error("ONNX Prediction Error:", err);
          resolve(null);
        }
      };
      
      img.onerror = () => {
        alert("Failed to process image.");
        resolve(null);
      };
    });
  };

  const handleScan = async () => {
    if (!isFaceAligned) return;

    const dataUrl = canvasRef.current?.toDataURL("image/jpeg");
    if (!dataUrl) return;

    setCapturedImage(dataUrl);
    setStage("processing");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    try {
      await faceServiceRef.current.init("IMAGE");

      const predictedShape = await predictFaceShape(dataUrl);
      
      if (predictedShape) {
        setTimeout(() => {
          router.push(
            productId
              ? `/customer/virtual-try-on/try-on?shape=${predictedShape}&product_id=${productId}`
              : `/customer/virtual-try-on/try-on?shape=${predictedShape}`
          );
        }, 500);
      } else {
        resetToCamera();
      }
    } catch (error) {
      console.error(error);
      resetToCamera();
    }
  };

  const resetToCamera = async () => {
    setStage("camera");
    await faceServiceRef.current.init("VIDEO"); 
    startCamera();
  };

  let hint = "Move into frame";
  if (stage === "camera") {
    if (hasFace && !isFaceAligned) hint = "Align your face";
    if (isFaceAligned) hint = "Perfect! Click Scan";
  } else {
    hint = "Analyzing...";
  }

  return (
    <div className="vto-page">
      <div className="vto-top">
        <div className="vto-left">
          {productId && <button className="back-btn" onClick={() => router.back()}>← back</button>}
        </div>
        <div className="vto-center">
          {stage === "camera" ? (
            <>
              <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />
              <canvas
                ref={canvasRef}
                style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
              />
            </>
          ) : (
            capturedImage && <img src={capturedImage} className="frozen-frame" style={{ transform: "scaleX(-1)" }} />
          )}

          <div className="face-scanner-overlay aligned">
            <div className={`guide-oval ${isFaceAligned ? "active" : ""}`}>
              <div className="corner-mark tl"></div>
              <div className="corner-mark tr"></div>
              <div className="corner-mark bl"></div>
              <div className="corner-mark br"></div>
            </div>
            <div className="hint-text">{hint}</div>
          </div>

          {/* Debug Overlay */}
          <div style={{ position: "absolute", top: 10, left: 10, color: "lime", fontSize: "12px", background: "rgba(0,0,0,0.6)", padding: "8px", borderRadius: "6px" }}>
            X: {debug.x.toFixed(2)} | Y: {debug.y.toFixed(2)} <br />
            W: {debug.w.toFixed(2)} | H: {debug.h.toFixed(2)} <br />
            Stable: {debug.stable}
          </div>
        </div>
        <div className="vto-right"></div>
      </div>

      <div className="vto-bottom">
        {stage === "camera" && (
          <>
            <button onClick={handleScan} className="scan-btn" disabled={!isFaceAligned}>
              Scan
            </button>
            {!cameraAvailable && (
              <button onClick={() => router.push("/customer/upload")} className="upload-link-btn">
                Or upload a photo
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}