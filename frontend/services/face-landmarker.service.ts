import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export class FaceLandmarkerService {
  private faceLandmarker?: FaceLandmarker;
  private ready = false;
  private mode: "VIDEO" | "IMAGE" = "VIDEO";

  public latestLandmarks: { x: number; y: number }[] = [];

  private initPromise: Promise<void> | null = null;
  private lastVideoTime = -1;

  async init(mode: "VIDEO" | "IMAGE" = "VIDEO"): Promise<void> {
    if (this.ready && this.mode === mode) return;

    if (this.initPromise) {
      await this.initPromise;
      if (this.mode === mode) return;
    }

    this.initPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      if (this.faceLandmarker) {
        this.faceLandmarker.close();
      }

      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
        },
        runningMode: mode,
        numFaces: 1,
      });

      this.mode = mode;
      this.ready = true;
      console.log("FaceLandmarker initialized:", mode);
    })();

    await this.initPromise;
  }

  isReady() {
    return this.ready;
  }

  detectForVideo(video: HTMLVideoElement, timestamp: number) {
    if (!this.faceLandmarker || this.mode !== "VIDEO") return null;

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    if (timestamp <= this.lastVideoTime) {
      return null;
    }
    this.lastVideoTime = timestamp;

    try {
      const results = this.faceLandmarker.detectForVideo(video, timestamp);
      if (results && results.faceLandmarks.length > 0) {
        const lm = results.faceLandmarks[0].map((p: any) => ({ x: p.x, y: p.y, z: p.z }));
        this.latestLandmarks = lm;
      } else {
        this.latestLandmarks = [];
      }
      return results;
    } catch (err) {
      console.warn("MediaPipe dropped a frame:", err);
      return null;
    }
  }

  async detectImage(image: HTMLImageElement | ImageBitmap | HTMLCanvasElement) {
    if (!this.faceLandmarker || this.mode !== "IMAGE") return null;
    
    try {
      const results = await this.faceLandmarker.detect(image);

      if (results && results.faceLandmarks.length > 0) {
        const lm = results.faceLandmarks[0].map((p: any) => ({ x: p.x, y: p.y, z: p.z }));
        this.latestLandmarks = lm;
      } else {
        this.latestLandmarks = [];
      }

      return results;
    } catch (err) {
      console.warn("MediaPipe failed to process static image:", err);
      return null;
    }
  }
}