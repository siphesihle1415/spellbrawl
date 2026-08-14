import { useEffect, useRef, useState } from "react";
import type { Gesture } from "../game/types";
import type { Landmark, PoseResult } from "./gestureClassifier";
import { MediaPipeGestureSource } from "./MediaPipeGestureSource";

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

export function WebcamPreview({ onGesture }: { onGesture: (gesture: Gesture, confidence: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<MediaPipeGestureSource | null>(null);
  const runIdRef = useRef(0);
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [pose, setPose] = useState<PoseResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      sourceRef.current?.stop();
      sourceRef.current = null;
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const enableCamera = async () => {
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
    <section className="rounded-[15px] border border-[#2e2440] bg-[#100c19cc] p-[11px] min-[561px]:col-span-2 min-[901px]:col-auto">
      <div className="relative aspect-video overflow-hidden rounded-[10px] bg-linear-to-br from-[#181225] to-[#0b0910]">
        <video ref={videoRef} muted playsInline aria-hidden="true" className="absolute inset-0 size-full object-cover opacity-0" />
        <canvas ref={canvasRef} width={640} height={480} className="pointer-events-none absolute inset-0 size-full" />
        {status !== "tracking" && (
          <button
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-lg border border-[#57466f] bg-[#171020] px-[11px] py-2 whitespace-nowrap text-[#e7ddf7]"
            type="button"
            onClick={enableCamera}
            disabled={status === "starting"}
          >
            {status === "idle" ? "Grant camera access" : status === "starting" ? "Starting…" : "Retry hand tracking"}
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-display text-xs">
          <i className={`mr-[7px] inline-block size-[7px] rounded-full ${
            status === "tracking"
              ? "bg-[#60e9a2] shadow-[0_0_8px_#60e9a2]"
              : status === "blocked" || status === "error"
                ? "bg-[#ff645c]"
                : status === "starting"
                  ? "bg-[#f7b955] shadow-[0_0_8px_#f7b955]"
                  : "bg-[#695f77]"
          }`} /> Hand tracking
        </span>
        <small className="text-[0.62rem] text-[#81738f]">{status === "tracking" ? "Active" : "Local input"}</small>
      </div>
      <p className="mx-0.5 mt-1 mb-px text-[0.68rem] text-[#9387a5]">
        {errorMessage || statusText}
      </p>
    </section>
  );
}
