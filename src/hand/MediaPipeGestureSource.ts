import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { ConfirmedGesture, GestureSource } from "./GestureSource";
import { classifyPose, type Landmark, type PoseResult } from "./gestureClassifier";
import { GestureStabilizer } from "./gestureStability";
import { shouldSample } from "./frameThrottle";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL = "/models/hand_landmarker.task";

// Gesture confirmation needs a 120ms hold, so sampling faster than this only costs GPU time.
const MIN_DETECT_INTERVAL_MS = 66;

type Options = {
  onFrame?: (hands: Landmark[][], pose: PoseResult | null) => void;
};

export class MediaPipeGestureSource implements GestureSource {
  private landmarker: HandLandmarker | null = null;
  private stabilizer = new GestureStabilizer();
  private running = false;
  private lastDetectAt: number | null = null;
  private animationFrame: number | null = null;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly options: Options = {},
  ) {}

  // Prefers requestVideoFrameCallback (one tick per decoded camera frame); older browsers lack
  // it, where calling it would throw and take hand tracking down entirely.
  private scheduleFrame(onGesture: (gesture: ConfirmedGesture) => void): void {
    if (!this.running) return;
    if (typeof this.video.requestVideoFrameCallback === "function") {
      this.video.requestVideoFrameCallback(() => this.tick(onGesture));
      return;
    }
    this.animationFrame = requestAnimationFrame(() => this.tick(onGesture));
  }

  async start(onGesture: (gesture: ConfirmedGesture) => void): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
    });

    this.running = true;
    this.scheduleFrame(onGesture);
  }

  stop(): void {
    this.running = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.landmarker?.close();
    this.landmarker = null;
  }

  private tick(onGesture: (gesture: ConfirmedGesture) => void): void {
    if (!this.running || !this.landmarker) return;

    const at = Math.round(performance.now());

    if (document.hidden || !shouldSample(this.lastDetectAt, at, MIN_DETECT_INTERVAL_MS)) {
      this.scheduleFrame(onGesture);
      return;
    }
    this.lastDetectAt = at;

    const result = this.landmarker.detectForVideo(this.video, at);
    const hands = result.landmarks as Landmark[][];

    const pose = classifyPose(hands);
    this.options.onFrame?.(hands, pose);

    const confirmed = this.stabilizer.observe(pose, at);
    if (confirmed) {
      onGesture({ playerId: "PLAYER_A", gesture: confirmed.gesture, confidence: confirmed.confidence, at: confirmed.at });
    }

    this.scheduleFrame(onGesture);
  }
}
