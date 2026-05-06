// "use client";

// import { useState, useRef, useEffect } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import * as tf from "@tensorflow/tfjs";
// import { FaceLandmarkerService } from "@/services/face-landmarker.service";
// import VirtualTryOnCanvas from "@/components/virtual-try-on-canvas";

// type Landmark = { x: number; y: number };
// const CLASS_NAMES = ["oval", "round", "square", "heart", "long"];

// export default function UploadPhotoPage() {
//   const router = useRouter();
//   const params = useSearchParams();
//   const productId = params.get("product_id");
//   const detectedShape = params.get("shape") || "oval";

//   const [image, setImage] = useState<string | null>(null);
//   const [faceShape, setFaceShape] = useState<string | null>(detectedShape);
//   const [arModel, setArModel] = useState<tf.LayersModel | null>(null);

//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const canvasRef = useRef<HTMLCanvasElement>(null);
//   const faceServiceRef = useRef(new FaceLandmarkerService());

//   // ======================
//   // 初始化 FaceLandmarkerService & 模型
//   // ======================
//   useEffect(() => {
//     (async () => {
//       await faceServiceRef.current.init();
//       const model = await tf.loadLayersModel("/face_shape_model/model.json");
//       setArModel(model);
//     })();
//   }, []);

//   // ======================
//   // 图片上传处理
//   // ======================
//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = (event) => {
//       setImage(event.target?.result as string);
//     };
//     reader.readAsDataURL(file);
//   };

//   // ======================
//   // 人脸检测 & 脸型预测
//   // ======================
//   const predictFaceShape = async (): Promise<void> => {
//     if (!canvasRef.current || !arModel || !image) return;

//     const ctx = canvasRef.current.getContext("2d");
//     if (!ctx) return;

//     const img = new Image();
//     img.src = image;
//     img.onload = async () => {
//       // 绘制图片到 canvas
// ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
// ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);

// // --- 将 canvas 转成 ImageBitmap 传给 detectImage
// const bitmap = await createImageBitmap(canvasRef.current!);
// const results = await faceServiceRef.current.detectImage(bitmap as unknown as HTMLImageElement);
//       const landmarks: Landmark[] | undefined = results?.faceLandmarks?.[0];

//       if (!landmarks || landmarks.length === 0) {
//         alert("No face detected. Please try another photo.");
//         return;
//       }

//       // --- Step 1: Prepare image tensor
//       let imgTensor = tf.browser.fromPixels(canvasRef.current! as HTMLCanvasElement).toFloat();
//       imgTensor = tf.image.resizeBilinear(imgTensor, [224, 224]);
//       imgTensor = imgTensor.div(127.5).sub(1);
//       imgTensor = imgTensor.expandDims(0);

//       // --- Step 2: Prepare landmarks tensor
//       const lmArray: number[] = [];
//       landmarks.slice(0, 468).forEach((p: Landmark) => lmArray.push(p.x, p.y));

//       const xs = landmarks.map((p: Landmark) => p.x);
//       const ys = landmarks.map((p: Landmark) => p.y);
//       const width = Math.max(...xs) - Math.min(...xs);
//       const height = Math.max(...ys) - Math.min(...ys);
//       const ratio = width / (height + 1e-6);
//       lmArray.push(width, height, ratio);

//       const lmTensor = tf.tensor2d([lmArray]);

//       // --- Step 3: Predict
//       const pred = arModel!.predict([imgTensor, lmTensor]) as tf.Tensor;
//       const predArray = (await pred.array()) as number[][];
//       const classIdx = predArray[0].indexOf(Math.max(...predArray[0]));
//       const shape = CLASS_NAMES[classIdx];

//       setFaceShape(shape);

//       // --- Step 4: Cleanup
//       imgTensor.dispose();
//       lmTensor.dispose();
//       pred.dispose();
//     };
//   };

//   // ======================
//   // 页面渲染
//   // ======================
//   return (
//     <div className="vto-page">
//       {/* ===== CENTER: 图片展示 / Canvas ===== */}
//       <div className="vto-center">
//         <canvas
//           ref={canvasRef}
//           width={640}
//           height={480}
//           style={{ display: "none" }}
//         />
//         {image && (
//           <img
//             src={image}
//             style={{ maxWidth: "100%", maxHeight: "80vh" }}
//             alt="Uploaded"
//           />
//         )}
//       </div>

//       {/* ===== BOTTOM: 上传 & 检测 & 尝试 ===== */}
//       <div className="vto-bottom">
//         <input
//           type="file"
//           accept="image/*"
//           ref={fileInputRef}
//           onChange={handleFileChange}
//         />
//         <button onClick={predictFaceShape} disabled={!image}>
//           Detect Face
//         </button>

//         {faceShape && (
//           <button
//             onClick={() =>
//               router.push(
//                 `/customer/virtual-try-on/try-on?shape=${faceShape}${
//                   productId ? `&product_id=${productId}` : ""
//                 }`
//               )
//             }
//           >
//             Try On Glasses
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }

// "use client";

// import { useState, useRef, useEffect } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import * as ort from "onnxruntime-web";
// import { FaceLandmarkerService } from "@/services/face-landmarker.service";

// // ==========================================
// // 1. 预处理函数 (完全对齐 YOLOv8)
// // ==========================================
// function preprocessImage(canvas: HTMLCanvasElement): { tensor: ort.Tensor, debugUrl: string } {
//   const w = canvas.width;
//   const h = canvas.height;
//   const scale = 224.0 / Math.min(h, w);
  
//   const new_w = Math.max(224, Math.round(w * scale));
//   const new_h = Math.max(224, Math.round(h * scale));
  
//   const scaledCanvas = document.createElement("canvas");
//   scaledCanvas.width = new_w;
//   scaledCanvas.height = new_h;
//   const sCtx = scaledCanvas.getContext("2d");
//   if (sCtx) sCtx.drawImage(canvas, 0, 0, new_w, new_h);
  
//   // const top = Math.floor((new_h - 224) / 2);
//   const left = Math.floor((new_w - 224) / 2);
  
//   const cropCanvas = document.createElement("canvas");
//   cropCanvas.width = 224;
//   cropCanvas.height = 224;
//   const cCtx = cropCanvas.getContext("2d");
//   if (cCtx) cCtx.drawImage(scaledCanvas, left, top, 224, 224, 0, 0, 224, 224);
  
//   const float32Data = new Float32Array(3 * 224 * 224);
//   if (cCtx) {
//     const imageData = cCtx.getImageData(0, 0, 224, 224).data;
//     for (let i = 0; i < 224 * 224; i++) {
//       float32Data[i] = imageData[i * 4] / 255.0;                 // R
//       float32Data[224 * 224 + i] = imageData[i * 4 + 1] / 255.0; // G
//       float32Data[2 * 224 * 224 + i] = imageData[i * 4 + 2] / 255.0; // B
//     }
//   }
  
//   const tensor = new ort.Tensor("float32", float32Data, [1, 3, 224, 224]);
//   return { tensor, debugUrl: cropCanvas.toDataURL("image/jpeg") };
// }

// // 辅助函数：计算 Softmax 概率
// function softmax(arr: Float32Array | number[]): number[] {
//   const max = Math.max(...Array.from(arr));
//   const exps = Array.from(arr).map(x => Math.exp(x - max));
//   const sum = exps.reduce((a, b) => a + b, 0);
//   return exps.map(x => x / sum);
// }

// const CLASS_NAMES = ["heart", "oblong", "oval", "round", "square"];

// export default function UploadPhotoPage() {
//   const router = useRouter();
//   const params = useSearchParams();
//   const productId = params.get("product_id");
//   const detectedShape = params.get("shape") || "oval";

//   const [image, setImage] = useState<string | null>(null);
//   const [faceShape, setFaceShape] = useState<string | null>(detectedShape);
//   const [arModel, setArModel] = useState<ort.InferenceSession | null>(null);
//   const [debugCropUrl, setDebugCropUrl] = useState<string | null>(null); 
//   const [modelStatus, setModelStatus] = useState<string>("Loading Model...");

//   const fileInputRef = useRef<HTMLInputElement>(null);
//   const faceServiceRef = useRef(new FaceLandmarkerService());

//   // ==========================================
//   // 2. 加载模型
//   // ==========================================
//   useEffect(() => {
//     (async () => {
//       await faceServiceRef.current.init();
//       try {
//         ort.env.wasm.numThreads = 1;
//         // 注意：这里默认你的 best.onnx 放在了 public/face_shape_model/ 文件夹下。
//         // 如果你的文件直接在 public/ 下，请改成 "/best.onnx"
//         const session = await ort.InferenceSession.create("/face_shape_model/best.onnx", {
//           // 移除 WebGL 强制使用 WASM，兼容性最强，防止浏览器引擎崩溃
//           executionProviders: ['wasm'] 
//         });
//         setArModel(session);
//         setModelStatus("Model Ready ✓");
//         console.log("✅ ONNX model loaded successfully");
//       } catch (err) {
//         setModelStatus("Model Failed to Load ❌");
//         console.error("❌ Failed to load ONNX model:", err);
//       }
//     })();
//   }, []);

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     const file = e.target.files?.[0];
//     if (!file) return;

//     const reader = new FileReader();
//     reader.onload = (event) => {
//       setImage(event.target?.result as string);
//       setFaceShape(null);
//       setDebugCropUrl(null);
//     };
//     reader.readAsDataURL(file);
//   };

//   // ==========================================
//   // 3. 执行预测
//   // ==========================================
//   const predictFaceShape = async (): Promise<void> => {
//     console.log("▶️ Detect Face Button Clicked");

//     if (!arModel) {
//       alert("AI 模型尚未加载完毕或加载失败！请检查按 F12 检查 Console 的 404 报错。");
//       return;
//     }
//     if (!image) {
//       alert("请先上传图片！");
//       return;
//     }

//     try {
//       // 使用 Promise 确保图片完全加载后再往下走
//       const img = new Image();
//       img.src = image;
//       await new Promise((resolve, reject) => {
//         img.onload = resolve;
//         img.onerror = reject;
//       });
//       console.log("✅ 阶段 1: 图片加载成功");

//       const rawCanvas = document.createElement("canvas");
//       rawCanvas.width = img.width;
//       rawCanvas.height = img.height;
//       const rawCtx = rawCanvas.getContext("2d");
//       if (!rawCtx) throw new Error("无法创建 Canvas Context");
//       rawCtx.drawImage(img, 0, 0, img.width, img.height);
//       console.log("✅ 阶段 2: 原图 Canvas 绘制成功");

//       // 执行裁切和预处理
//       const { tensor: inputTensor, debugUrl } = preprocessImage(rawCanvas);
//       setDebugCropUrl(debugUrl); // 更新前端的小截切图
//       console.log("✅ 阶段 3: 图像中心裁切 & 预处理完成 (debugUrl 已生成)");

//       // 喂给 ONNX
//       const feeds: Record<string, ort.Tensor> = {};
//       feeds[arModel.inputNames[0]] = inputTensor;
//       console.log("⏳ 阶段 4: 正在进行 ONNX 推理...");
      
//       const results = await arModel.run(feeds);
//       const output = results[arModel.outputNames[0]];
//       const data = output.data as Float32Array;
      
//       // 使用 Softmax 计算准确百分比
//       const probabilities = softmax(data);
      
//       let classIdx = 0;
//       let maxProb = probabilities[0];
//       for (let i = 1; i < probabilities.length; i++) {
//         if (probabilities[i] > maxProb) {
//           maxProb = probabilities[i];
//           classIdx = i;
//         }
//       }
      
//       const shape = CLASS_NAMES[classIdx];

//       console.log("✅ 阶段 5: 推理完成！");
//       console.log("📊 [置信度输出]:");
//       CLASS_NAMES.forEach((name, i) => {
//         console.log(`- ${name}: ${(probabilities[i] * 100).toFixed(2)}%`);
//       });

//       setFaceShape(shape);
      
//     } catch (err) {
//       console.error("❌ 预测过程中发生严重错误:", err);
//       alert("预测失败，请按 F12 检查 Console 查看详细报错。");
//     }
//   };

//   return (
//     <div className="vto-page">
//       <div className="vto-center" style={{ position: "relative" }}>
        
//         {/* 模型状态提示 */}
//         <div style={{ position: "absolute", top: 10, left: 10, background: "black", color: modelStatus.includes("Ready") ? "lime" : "red", padding: "5px 10px", fontSize: "12px", zIndex: 10 }}>
//           {modelStatus}
//         </div>

//         {image && (
//           <img
//             src={image}
//             style={{ maxWidth: "100%", maxHeight: "80vh" }}
//             alt="Uploaded"
//           />
//         )}
        
//         {faceShape && (
//           <div style={{ position: "absolute", top: 50, background: "rgba(0,0,0,0.7)", color: "white", padding: "10px 20px", borderRadius: "8px", zIndex: 10 }}>
//             Detected Shape: <strong style={{ color: "lime" }}>{faceShape.toUpperCase()}</strong>
//           </div>
//         )}

//         {/* 调试用小窗口：显示最终送给 ONNX 吃的 224x224 图像 */}
//         {debugCropUrl && (
//           <div style={{ position: "absolute", bottom: 20, right: 20, border: "2px solid lime", background: "black", padding: "5px", zIndex: 20 }}>
//             <span style={{ color: "lime", fontSize: "12px", display: "block", marginBottom: "4px" }}>ONNX Input (224x224)</span>
//             <img src={debugCropUrl} alt="Crop Debug" style={{ width: "120px", height: "120px" }} />
//           </div>
//         )}
//       </div>

//       <div className="vto-bottom">
//         <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} />
//         <button onClick={predictFaceShape} disabled={!image}>
//           Detect Face
//         </button>

//         {faceShape && (
//           <button
//             onClick={() => router.push(`/customer/virtual-try-on/try-on?shape=${faceShape}${productId ? `&product_id=${productId}` : ""}`)}
//           >
//             Try On Glasses
//           </button>
//         )}
//       </div>
//     </div>
//   );
// }