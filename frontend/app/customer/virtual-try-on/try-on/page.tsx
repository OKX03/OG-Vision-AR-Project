"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import axiosInstance from "@/services/axios-instance";
import * as ort from "onnxruntime-web";
import { FaceLandmarkerService } from "@/services/face-landmarker.service";
import { Modal, Button } from "react-bootstrap";

import VirtualTryOnCanvas from "@/components/virtual-try-on-canvas";
import "../virtual-try-on.css";

function preprocessImage(canvas: HTMLCanvasElement): { tensor: ort.Tensor, debugUrl: string } {
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
  
  const top = Math.floor((new_h - 224) / 2);
  const left = Math.floor((new_w - 224) / 2);
  
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = 224;
  cropCanvas.height = 224;
  const cCtx = cropCanvas.getContext("2d");
  if (cCtx) cCtx.drawImage(scaledCanvas, left, top, 224, 224, 0, 0, 224, 224);
  
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

type Product = {
  product_id: string;
  brand: string;
  model: string;
  color?: string;
  frontImage: string;
  arModel: string | null;
  calibration?: {
    pitch: number;
    yaw: number;
    roll: number;
    scale: number;
    yOffset: number;
    zOffset: number;
  };
  faceShape?: string[];
};

type Landmark = { x: number; y: number };

const FACE_SHAPES = ['heart', 'oblong', 'oval', 'round', 'square'];
const CLASS_NAMES = ["oval", "round", "square", "heart", "long"]; 

export default function TryOnPage() {
  const router = useRouter();
  const params = useSearchParams();
  const detectedShapeRaw = params.get("shape") || "oval";
  const productId = params.get("product_id");

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedShapeFilter, setSelectedShapeFilter] = useState<string | null>(null);
  const [model, setModel] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const [tryOnMode, setTryOnMode] = useState<"realtime" | "photo">("realtime");
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [photoFaceShape, setPhotoFaceShape] = useState<string | null>(null);
  
  const [isDetectingFace, setIsDetectingFace] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [arModel, setArModel] = useState<ort.InferenceSession | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceServiceRef = useRef(new FaceLandmarkerService());
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeDetectedShape = tryOnMode === "photo" 
    ? (photoFaceShape ? photoFaceShape : "--") 
    : detectedShapeRaw;

  useEffect(() => {
    (async () => {
      await faceServiceRef.current.init("IMAGE");
      try {
        ort.env.wasm.numThreads = 1;
        const session = await ort.InferenceSession.create("/face_shape_model/best.onnx", {
          executionProviders: ['webgl', 'wasm']
        });
        setArModel(session);
        console.log("ONNX Face shape prediction model loaded for Photo Trial");
      } catch (e) {
        console.error("Failed to load ONNX model", e);
      }
    })();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await axiosInstance.get("/products");
        const data = res.data;

        const mapped: Product[] = data.map((item: any) => {
          const frontImage = item.images?.find(
            (i: any) => i.view_type === "front"
          );

          return {
            product_id: item.product_id,
            brand: item.brand,
            model: item.model,
            color: item.color,
            arModel: item.ar_model
              ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${item.ar_model.file_path}`
              : null,
            calibration: item.ar_model ? {
              pitch: item.ar_model.pitch ?? 0,
              yaw: item.ar_model.yaw ?? 0,
              roll: item.ar_model.roll ?? 0,
              scale: item.ar_model.scale ?? 1.0,
              yOffset: item.ar_model.y_offset ?? -0.01,
              zOffset: item.ar_model.z_offset ?? 0.05
            } : undefined,
            frontImage: frontImage
              ? `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${frontImage.image_url}`
              : "",
            faceShape: (() => {
              if (!item.face_shape) return [];
              if (Array.isArray(item.face_shape)) return item.face_shape;
              return item.face_shape
                .split("_")
                .map((s: string) => s.trim().toLowerCase())
                .filter(Boolean);
            })(),
          };
        });

        setProducts(mapped);

        if (!productId) {
          const first = mapped.find(p => p.arModel);
          if (first) setModel(first);
        }
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        setLoading(false);
      }
    };
    fetchProducts();
  }, [productId]);

  useEffect(() => {
    if (productId && products.length > 0) {
      const selected = products.find(p => String(p.product_id) === String(productId));
      if (selected && selected.arModel) {
        setModel(selected);
      }
    }
  }, [productId, products]);

  const filteredProducts = products
    .filter(p => p.arModel)
    .filter(p => {
      if (!selectedShapeFilter) return true;
      return p.faceShape?.includes(selectedShapeFilter);
    })
    .sort((a, b) => {
      const aMatch = a.faceShape?.includes(activeDetectedShape) ? 1 : 0;
      const bMatch = b.faceShape?.includes(activeDetectedShape) ? 1 : 0;
      return bMatch - aMatch;
    });



  const predictFaceShapeFromPhoto = async (imageSrc: string) => {
    if (!canvasRef.current || !arModel) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = async () => {
      ctx.canvas.width = img.width;
      ctx.canvas.height = img.height;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);

      const bitmap = await createImageBitmap(canvasRef.current!);
      const results = await faceServiceRef.current.detectImage(bitmap as unknown as HTMLImageElement);
      const landmarks = results?.faceLandmarks?.[0];

      if (!landmarks || landmarks.length === 0) {
        setIsDetectingFace(false);
        setErrorMessage("Cannot detect face shape. Please upload a proper front-facing photo with your face clearly visible.");
        setShowErrorModal(true);
        return;
      }

      setUploadedPhoto(imageSrc);

      try {
        const { tensor: inputTensor } = preprocessImage(canvasRef.current!);
        const feeds: Record<string, ort.Tensor> = {};
        feeds[arModel.inputNames[0]] = inputTensor;
        
        const outputResults = await arModel.run(feeds);
        const output = outputResults[arModel.outputNames[0]];
        const data = output.data as Float32Array;
        
        let classIdx = 0;
        let maxProb = data[0];
        for (let i = 1; i < data.length; i++) {
          if (data[i] > maxProb) {
            maxProb = data[i];
            classIdx = i;
          }
        }
        
        // Match Python sorting ('heart', 'oblong', 'oval', 'round', 'square')
        const ONNX_CLASS_NAMES = ['heart', 'oblong', 'oval', 'round', 'square'];
        const shape = ONNX_CLASS_NAMES[classIdx];
        setPhotoFaceShape(shape);
      } catch (err) {
        console.error("ONNX Prediction Error:", err);
      }

      setIsDetectingFace(false);
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsDetectingFace(true);
    setUploadedPhoto(null);
    setPhotoFaceShape(null); // reset until detected

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      predictFaceShapeFromPhoto(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="vto-page">
      <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />

      <div className="vto-top">
        <div className="vto-left">
          <div className="shape-result">
            <h3>Your Face Shape</h3>
            <div className="shape-badge">{activeDetectedShape}</div>
            
            {tryOnMode === "realtime" ? (
              <div style={{ marginTop: '30px', textAlign: 'center'}}>
                <p style={{fontSize: '12px', color: '#888', marginBottom: '10px'}}>Switch to Photo Upload Try-On</p>
                <button
                  className="upload-btn"
                  onClick={() => setTryOnMode("photo")}
                >
                  Upload Photo
                </button>
              </div>
            ) : (
             <div style={{ marginTop: '30px' }}>
                <p style={{fontSize: '12px', color: '#888', marginBottom: '10px'}}>Switch to Real-Time Try-On</p>
                <button
                  className="upload-btn"
                  onClick={() => {
                    setTryOnMode("realtime");
                    setUploadedPhoto(null);
                    setPhotoFaceShape(null);
                  }}
                >
                  Real Time
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="vto-center">
          {tryOnMode === "realtime" ? (
            model ? (
              <VirtualTryOnCanvas 
                key={`rt-canvas`}
                modelPath={model.arModel} 
                initialCalibration={model.calibration} 
              />
            ) : (
              <div className="loading">Loading model...</div>
            )
          ) : (
            isDetectingFace ? (
               <div className="vto-ar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa', gap: '15px' }}>
                   <div className="spinner-border text-light" role="status" style={{ width: '3rem', height: '3rem' }}></div>
                   <p style={{ margin: 0 }}>Analyzing photo, please wait...</p>
               </div>
            ) : uploadedPhoto ? (
               model ? (
                 <VirtualTryOnCanvas 
                    key={`photo-canvas-${uploadedPhoto}`}
                    modelPath={model.arModel} 
                    initialCalibration={model.calibration} 
                    staticImageSrc={uploadedPhoto}
                 />
               ) : <div className="loading">Loading model...</div>
            ) : (
               <div className="vto-ar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
                   <p style={{marginBottom: '20px'}}>Please upload a clear selfie to try on glasses.</p>
               </div>
            )
          )}
        </div>

        <div className="vto-right">
          {tryOnMode === "realtime" ? (
            <div className="filter-panel">
              <h3>Filter by Face Shape</h3>
              {FACE_SHAPES.map(shape => (
                <button
                  key={shape}
                  className={`filter-btn ${selectedShapeFilter === shape ? "active" : ""}`}
                  onClick={() =>
                    setSelectedShapeFilter(selectedShapeFilter === shape ? null : shape)
                  }
                >
                  {shape}
                </button>
              ))}
            </div>
          ) : (
             model && (
               <div className="selected-model-panel">
                 <h3 style={{marginBottom: '20px', fontSize: '15px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '1px'}}>Selected Model</h3>
                 <div className="product-card active" style={{width: '200px', margin: '0 auto', cursor: 'default'}}>
                   <img src={model.frontImage} />
                   <div className="info">
                     <div className="brand">{model.brand}</div>
                     <div className="model">{model.model}</div>
                     <div className="color">{model.color}</div>
                   </div>
                 </div>
               </div>
             )
          )}
        </div>
      </div>

      {/* === BOTTOM PANEL === */}
      <div className="vto-bottom product-area">
        {tryOnMode === "realtime" ? (
          loading ? (
            <div className="loading">Loading products...</div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map(p => (
                <div
                  key={p.product_id}
                  className={`product-card ${model?.arModel === p.arModel ? "active" : ""}`}
                  onClick={() => setModel(p)}
                >
                  <img src={p.frontImage} />
                  <div className="info">
                    <div className="brand">{p.brand}</div>
                    <div className="model">{p.model}</div>
                    <div className="color">{p.color}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
           <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
             <button className="upload-btn" style={{width: '200px'}} onClick={() => fileInputRef.current?.click()}>
                Upload Photo
             </button>
           </div>
        )}
      </div>

      {/* Error Modal */}
      <Modal show={showErrorModal} centered onHide={() => setShowErrorModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title style={{ color: 'black' }}>Detection Failed</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center p-4">
          <p style={{ color: '#333' }}>{errorMessage}</p>
          <Button variant="danger" onClick={() => setShowErrorModal(false)} className="mt-3">
            OK
          </Button>
        </Modal.Body>
      </Modal>

    </div>
  );
}