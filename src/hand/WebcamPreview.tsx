import { useEffect, useRef, useState } from "react";
import type { Gesture } from "../game/types";
import type { Landmark, PoseResult } from "./gestureClassifier";
import { MediaPipeGestureSource } from "./MediaPipeGestureSource";
import { GestureGlyph, gestureLabel } from "../ui/GestureGlyph";

type TrackingStatus = "idle" | "starting" | "tracking" | "blocked" | "error";

const CAMERA_REQUEST_TIMEOUT_MS = 8_000;

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
    ctx.strokeStyle = "#8d69ff";
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
      ctx.fillStyle = "#ff9a66";
      ctx.beginPath();
      ctx.arc(mirroredX(point.x), point.y * canvas.height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (label) {
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    const x = canvas.width / 2;
    const y = canvas.height - 16;
    ctx.strokeStyle = "#000000a0";
    ctx.lineWidth = 4;
    ctx.strokeText(label, x, y);
    ctx.fillStyle = "#f6e05e";
    ctx.fillText(label, x, y);
    ctx.textAlign = "left";
  }
}

const requestCamera = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException("Camera access is unavailable in this browser.", "NotSupportedError");
  }

  const request = navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
    audio: false,
  });
  let timedOut = false;
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      reject(new DOMException("Camera permission request timed out.", "TimeoutError"));
    }, CAMERA_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (timedOut) {
      void request.then((lateStream) => {
        lateStream.getTracks().forEach((track) => track.stop());
      }, () => undefined);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export function WebcamPreview({ onGesture, onGestureEnd, active, playerLabel }: { onGesture: (gesture: Gesture, confidence: number) => void; onGestureEnd: () => void; active: boolean; playerLabel: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<MediaPipeGestureSource | null>(null);
  const runIdRef = useRef(0);
  const poseWasPresentRef = useRef(false);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [pose, setPose] = useState<PoseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const stopTracking = () => {
    runIdRef.current += 1;
    sourceRef.current?.stop();
    sourceRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setPose(null);
    poseWasPresentRef.current = false;
    onGestureEnd();
  };

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      sourceRef.current?.stop();
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (!active && status !== "idle") stopTracking();
  }, [active]);

  const enableCamera = async () => {
    if (!active) return;
    const runId = ++runIdRef.current;
    setStatus("starting");
    setErrorMessage("");
    let stream: MediaStream | undefined;
    try {
      stream = await requestCamera();
      if (runId !== runIdRef.current || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      if (runId !== runIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const canvas = canvasRef.current;
      const source = new MediaPipeGestureSource(videoRef.current, {
        onFrame: (hands, poseResult) => {
          setPose(poseResult);
          if (!poseResult && poseWasPresentRef.current) onGestureEnd();
          poseWasPresentRef.current = poseResult !== null;
          if (canvas) drawHands(canvas, hands, poseResult?.gesture.replaceAll("_", " ") ?? null);
        },
      });
      sourceRef.current = source;
      await source.start((confirmed) => onGesture(confirmed.gesture, confirmed.confidence));
      if (runId !== runIdRef.current) {
        source.stop();
        return;
      }
      setStatus("tracking");
    } catch (error) {
      sourceRef.current?.stop();
      sourceRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      if (runId !== runIdRef.current) return;
      const permissionBlocked = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
      const requestTimedOut = error instanceof DOMException && error.name === "TimeoutError";
      setStatus(permissionBlocked ? "blocked" : "error");
      setErrorMessage(
        permissionBlocked
          ? "Camera permission was denied. Allow it in browser settings, then retry."
          : requestTimedOut
            ? "Camera request timed out. Allow camera access in your browser, then retry."
            : "Hand tracker failed to load. Keyboard controls still work.",
      );
    }
  };

  const statusText = status === "tracking"
    ? pose
      ? `${pose.gesture.replaceAll("_", " ")} · ${Math.round(pose.confidence * 100)}% confidence`
      : "Show your hand to cast"
    : status === "starting" ? "Starting camera and loading hand model…" : "Keyboard gestures are active.";

  return (
    <section className="hand-card" aria-label={`${playerLabel} hand tracking`}>
      <div className="hand-viewport">
        <video ref={videoRef} muted playsInline aria-hidden="true" className="absolute inset-0 size-full -scale-x-100 object-cover opacity-0" />
        <canvas ref={canvasRef} width={640} height={480} className="pointer-events-none absolute inset-0 size-full" />
        {!active ? (
          <div className="tracking-paused">
            <GestureGlyph />
            <strong>Tracking paused</strong>
            <span>Start the game to enable your camera</span>
          </div>
        ) : status !== "tracking" && (
          <button
            className="camera-button"
            type="button"
            onClick={enableCamera}
            disabled={status === "starting"}
          >
            {status === "idle" ? "Grant camera access" : status === "starting" ? "Starting…" : "Retry hand tracking"}
          </button>
        )}
        <span className="player-rune">P{playerLabel.at(-1)}</span>
      </div>
      <div className="hand-card-meta">
        <span>
          <i className={`status-dot ${
            status === "tracking"
              ? "is-live"
              : status === "blocked" || status === "error"
                ? "is-error"
                : status === "starting"
                  ? "is-starting"
                  : ""
          }`} /> {playerLabel}
        </span>
        <small>{active ? status === "tracking" ? "Active" : "Local" : "Paused"}</small>
      </div>
      <p>
        {!active ? "Hand tracking resumes when the game begins." : errorMessage || (pose ? `${gestureLabel(pose.gesture)} · ${Math.round(pose.confidence * 100)}% confidence` : statusText)}
      </p>
    </section>
  );
}
