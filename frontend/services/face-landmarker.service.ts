import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export class FaceLandmarkerService {
  private faceLandmarker?: FaceLandmarker;
  private ready = false;
  private mode: "VIDEO" | "IMAGE" = "VIDEO";

  public latestLandmarks: { x: number; y: number }[] = [];

  // Get the face mesh triangulation from MediaPipe
  static get faceTesselation() {
    return FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  }

  private initPromise: Promise<void> | null = null;
  private lastVideoTime = -1;

  // Initializes the MediaPipe FaceLandmarker task.
  async init(mode: "VIDEO" | "IMAGE" = "VIDEO"): Promise<void> {
    // Prevent reinitialization
    if (this.ready && this.mode === mode) return;

    if (this.initPromise) {
      await this.initPromise;
      if (this.mode === mode) return;
    }

    this.initPromise = (async () => {
      if (this.faceLandmarker) {
        await this.faceLandmarker.setOptions({ runningMode: mode });
        this.mode = mode;
        this.ready = true;
        return;
      }

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      // Initialize the Face Landmarker model
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
        },
        runningMode: mode,
        numFaces: 1, // Enforce single-face tracking
      });

      this.mode = mode;
      this.ready = true;
      console.log("FaceLandmarker initialized:", mode);
    })();

    await this.initPromise;
  }

  // Checks if the landmarker is fully initialized and ready to process frames.
  isReady() {
    return this.ready;
  }

  // Processes a single video frame to detect face landmarks.
  detectForVideo(video: HTMLVideoElement, timestamp: number) {
    if (!this.faceLandmarker || this.mode !== "VIDEO") {
      return null;
    }

    //Skip frames if video stream isn't loaded
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    //Prevent redundant processing
    if (timestamp <= this.lastVideoTime) {
      return null;
    }
    this.lastVideoTime = timestamp;

    try {
      // Process the video frame and extract landmarks
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

  // Processes a static image to detect face landmarks.
  async detectImage(image: HTMLImageElement | ImageBitmap | HTMLCanvasElement) {
    if (!this.faceLandmarker || this.mode !== "IMAGE") {
      return null;
    }

    try {
      // Process the image and extract landmarks
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

  // Closes the FaceLandmarker instance and releases its resources.
  close() {
    if (this.faceLandmarker) {
      this.faceLandmarker.close();
      this.faceLandmarker = undefined;
    }
    this.ready = false;
    this.initPromise = null;
    this.lastVideoTime = -1;
    this.latestLandmarks = [];
  
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }
}

export const sharedFaceLandmarkerService = new FaceLandmarkerService();