import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { ConfirmedGesture, GestureSource } from "./GestureSource";
import { classifyPose, type Landmark, type PoseResult } from "./gestureClassifier";
import { GestureStabilizer } from "./gestureStability";

const WASM_BASE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL = "/models/hand_landmarker.task";

type Options = {
  onFrame?: (hands: Landmark[][], pose: PoseResult | null) => void;
};

export class MediaPipeGestureSource implements GestureSource {
  private landmarker: HandLandmarker | null = null;
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
  }

  private tick(onGesture: (gesture: ConfirmedGesture) => void): void {
    if (!this.running || !this.landmarker) return;

    const at = Math.round(performance.now());
    const result = this.landmarker.detectForVideo(this.video, at);
    const hands = result.landmarks as Landmark[][];

    const pose = classifyPose(hands);
    this.options.onFrame?.(hands, pose);

    const confirmed = this.stabilizer.observe(pose, at);
    if (confirmed) {
      onGesture({ playerId: "PLAYER_A", gesture: confirmed.gesture, confidence: confirmed.confidence, at: confirmed.at });
    }

    this.video.requestVideoFrameCallback(() => this.tick(onGesture));
  }
}
