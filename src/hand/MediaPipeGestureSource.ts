import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { ConfirmedGesture, GestureSource } from "./GestureSource";
import { classifyPose, classifyThrust, type FistSample, type Landmark, type PoseResult } from "./gestureClassifier";
import { GestureStabilizer } from "./gestureStability";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const FIST_HISTORY_MS = 400;
const FIST_SCALE_A = 0;
const FIST_SCALE_B = 9; // wrist, middle_mcp — same pair gestureClassifier.handScale() uses

type Options = {
  onFrame?: (hands: Landmark[][], pose: PoseResult | null) => void;
};

export class MediaPipeGestureSource implements GestureSource {
  private landmarker: HandLandmarker | null = null;
  private fistHistory: FistSample[] = [];
  private stabilizer = new GestureStabilizer();
  private running = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly options: Options = {},
  ) {}

  async start(onGesture: (gesture: ConfirmedGesture) => void): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numHands: 2,
    });

    this.running = true;
    this.video.requestVideoFrameCallback(() => this.tick(onGesture));
  }

  stop(): void {
    this.running = false;
    this.landmarker?.close();
    this.landmarker = null;
    this.fistHistory = [];
  }

  private tick(onGesture: (gesture: ConfirmedGesture) => void): void {
    if (!this.running || !this.landmarker) return;

    const at = Math.round(performance.now());
    const result = this.landmarker.detectForVideo(this.video, at);
    const hands = result.landmarks as Landmark[][];

    const pose = classifyPose(hands);
    this.options.onFrame?.(hands, pose);

    if (pose?.gesture === "FIST") {
      const scale = Math.hypot(
        hands[0][FIST_SCALE_A].x - hands[0][FIST_SCALE_B].x,
        hands[0][FIST_SCALE_A].y - hands[0][FIST_SCALE_B].y,
      );
      this.fistHistory = [...this.fistHistory, { scale, at }].filter(
        (sample) => at - sample.at <= FIST_HISTORY_MS,
      );
    } else {
      this.fistHistory = [];
    }

    const candidate = classifyThrust(this.fistHistory) ? { gesture: "THRUST" as const, confidence: 0.9 } : pose;
    const confirmed = this.stabilizer.observe(candidate, at);
    if (confirmed) {
      onGesture({ playerId: "PLAYER_A", gesture: confirmed.gesture, confidence: confirmed.confidence, at: confirmed.at });
    }

    this.video.requestVideoFrameCallback(() => this.tick(onGesture));
  }
}
