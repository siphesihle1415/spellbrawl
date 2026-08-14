import { useEffect, useRef, useState } from "react";
import type { Gesture } from "../game/types";
import type { Landmark } from "./gestureClassifier";
import { MediaPipeGestureSource } from "./MediaPipeGestureSource";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

function drawHands(canvas: HTMLCanvasElement, hands: Landmark[][], label: string | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Mirror landmark x-coordinates here (rather than CSS-transforming the whole canvas)
  // so the skeleton matches the selfie-view video without also flipping the label text.
  const mirroredX = (x: number) => canvas.width - x * canvas.width;

  for (const hand of hands) {
    ctx.strokeStyle = "#4fd1c5";
    ctx.lineWidth = 2;
    for (const [start, end] of HAND_CONNECTIONS) {
      const a = hand[start];
      const b = hand[end];
      ctx.beginPath();
      ctx.moveTo(mirroredX(a.x), a.y * canvas.height);
      ctx.lineTo(mirroredX(b.x), b.y * canvas.height);
      ctx.stroke();
    }
    for (const point of hand) {
      ctx.fillStyle = "#f6e05e";
      ctx.beginPath();
      ctx.arc(mirroredX(point.x), point.y * canvas.height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (label) {
    ctx.font = "bold 28px sans-serif";
    ctx.textAlign = "center";
    const x = canvas.width / 2;
    const y = canvas.height - 24;
    ctx.strokeStyle = "#000000a0";
    ctx.lineWidth = 4;
    ctx.strokeText(label, x, y);
    ctx.fillStyle = "#f6e05e";
    ctx.fillText(label, x, y);
    ctx.textAlign = "left";
  }
}

type Status = "idle" | "starting" | "blocked" | "tracking" | "tracking-failed";

export function WebcamPreview({
  onGesture,
}: {
  onGesture: (gesture: Gesture, confidence: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<MediaPipeGestureSource | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    return () => {
      sourceRef.current?.stop();
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startTracking = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    try {
      const source = new MediaPipeGestureSource(video, {
        onFrame: (hands, pose) => drawHands(canvas, hands, pose?.gesture ?? null),
      });
      sourceRef.current = source;
      await source.start((confirmed) => onGesture(confirmed.gesture, confirmed.confidence));
      setStatus("tracking");
    } catch {
      setStatus("tracking-failed");
    }
  };

  const enableCamera = async () => {
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      await startTracking();
    } catch {
      setStatus("blocked");
    }
  };

  const statusLabel: Record<Status, string> = {
    idle: "Keyboard gestures are active.",
    starting: "Starting camera…",
    tracking: "Hand tracking active.",
    blocked: "Camera blocked — retry.",
    "tracking-failed": "Hand tracking unavailable — using keyboard gestures.",
  };

  return (
    <section className="camera-card">
      <div className="camera-frame">
        <video ref={videoRef} muted playsInline aria-label="Local webcam feed (hidden)" className="camera-feed-hidden" />
        <canvas ref={canvasRef} width={640} height={480} className="hand-overlay" />
        {status !== "tracking" && (
          <button type="button" onClick={enableCamera} disabled={status === "starting"}>
            {status === "starting" ? "Starting camera…" : status === "blocked" ? "Camera blocked — retry" : "Enable webcam"}
          </button>
        )}
      </div>
      <div>
        <span className={`status-dot ${status}`} />
        {statusLabel[status]}
      </div>
    </section>
  );
}
