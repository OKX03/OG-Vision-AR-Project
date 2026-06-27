class OnnxFaceShapeService {
  private sessionPromise: Promise<any> | null = null;
  private isInitializing = false;

  // Initialize the ONNX model dynamically in the background to prevent main bundle bloat
  public init() {
    if (this.sessionPromise || this.isInitializing) return this.sessionPromise;
    this.isInitializing = true;
    
    this.sessionPromise = (async () => {
      try {
        // Dynamically import ONNX Runtime
        const ort = await import("onnxruntime-web");
        
        ort.env.wasm.numThreads = 1;
        // Keep SIMD disabled as some mobile browsers have poor support and crash
        ort.env.wasm.simd = false; 
        
        const session = await ort.InferenceSession.create("/face_shape_model/model.onnx", {
          executionProviders: ["wasm"], 
          graphOptimizationLevel: "all"
        });
        return session;
      } catch (err) {
        console.error("ONNX Load Error:", err);
        throw err;
      }
    })();

    return this.sessionPromise;
  }

  public async getSession(): Promise<any | null> {
    if (!this.sessionPromise) {
      this.init();
    }
    try {
      return await this.sessionPromise;
    } catch {
      return null;
    }
  }
}

export const sharedOnnxFaceShapeService = new OnnxFaceShapeService();
