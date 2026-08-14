import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import type { Gesture } from "../game/types";
import { TemporalGestureRecognizer, type GestureObservation } from "./gestureRecognition";

type TrackingStatus = "idle" | "starting" | "loading" | "tracking" | "blocked" | "error";

const WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_PATH = "/models/hand_landmarker.task";
const CAMERA_REQUEST_TIMEOUT_MS = 8_000;

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
  const landmarkerRef = useRef<HandLandmarker | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const lastInferenceRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const runIdRef = useRef(0);
  const callbackRef = useRef(onGesture);
  const recognizerRef = useRef(new TemporalGestureRecognizer());
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [observation, setObservation] = useState<GestureObservation>({ confidence: 0, stability: 0, handCount: 0 });
  const [errorMessage, setErrorMessage] = useState("");

  callbackRef.current = onGesture;

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      landmarkerRef.current?.close();
      landmarkerRef.current = undefined;
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const track = () => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;

    const at = performance.now();
    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.currentTime !== lastVideoTimeRef.current &&
      at - lastInferenceRef.current >= 50
    ) {
      lastInferenceRef.current = at;
      lastVideoTimeRef.current = video.currentTime;
      const result = landmarker.detectForVideo(video, at);
      const next = recognizerRef.current.update(result.landmarks, at);
      setObservation(next);
      if (next.confirmed) callbackRef.current(next.confirmed, next.confidence);
    }
    frameRef.current = requestAnimationFrame(track);
  };

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
      setStatus("loading");
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
      if (runId !== runIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.55,
        minHandPresenceConfidence: 0.55,
        minTrackingConfidence: 0.55,
      });
      if (runId !== runIdRef.current) {
        landmarker.close();
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      landmarkerRef.current?.close();
      landmarkerRef.current = landmarker;
      recognizerRef.current.reset();
      lastInferenceRef.current = 0;
      lastVideoTimeRef.current = -1;
      setStatus("tracking");
      frameRef.current = requestAnimationFrame(track);
    } catch (error) {
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
    ? observation.gesture
      ? `${observation.gesture.replaceAll("_", " ")} · ${Math.round(observation.confidence * 100)}% confidence`
      : observation.handCount > 0 ? "Hand found · hold a gesture steady" : "Show your hand to cast"
    : status === "loading" ? "Loading the hand landmark model…" : "Keyboard gestures are active.";

  return (
    <section className="rounded-[15px] border border-[#2e2440] bg-[#100c19cc] p-[11px] min-[561px]:col-span-2 min-[901px]:col-auto">
      <video ref={videoRef} className="pointer-events-none fixed size-px opacity-0" muted playsInline aria-hidden="true" />
      <div className="grid min-h-[72px] gap-2.5 rounded-[10px] bg-linear-to-br from-[#181225] to-[#0b0910] p-2.5">
        <div className="flex items-center justify-between">
          <span className="font-display text-xs">
            <i className={`mr-[7px] inline-block size-[7px] rounded-full ${
              status === "tracking"
                ? "bg-[#60e9a2] shadow-[0_0_8px_#60e9a2]"
                : status === "blocked" || status === "error"
                  ? "bg-[#ff645c]"
                  : status === "loading" || status === "starting"
                    ? "bg-[#f7b955] shadow-[0_0_8px_#f7b955]"
                    : "bg-[#695f77]"
            }`} /> Hand tracking
          </span>
          <small className="text-[0.62rem] text-[#81738f]">{status === "tracking" ? "Active" : "Local input"}</small>
        </div>
        {(status === "idle" || status === "blocked" || status === "error") && (
          <button className="cursor-pointer justify-self-start rounded-lg border border-[#57466f] bg-[#171020] px-[11px] py-2 text-[#e7ddf7]" type="button" onClick={enableCamera}>
            {status === "idle" ? "Grant camera access" : "Retry hand tracking"}
          </button>
        )}
        {status === "starting" && <div className="text-[0.68rem] tracking-[0.08em] text-[#c5b5dd] uppercase">Requesting camera access…</div>}
        {status === "loading" && <div className="text-[0.68rem] tracking-[0.08em] text-[#c5b5dd] uppercase">Loading hand model…</div>}
        {status === "tracking" && observation.gesture && (
          <div className="flex items-center gap-[9px] rounded-lg border border-[#604a7b] bg-[#0c0816d9] px-[9px] py-[7px]">
            <strong className="shrink-0 text-[0.61rem] tracking-[0.09em]">{observation.gesture.replaceAll("_", " ")}</strong>
            <span className="h-[3px] flex-1 overflow-hidden rounded-[5px] bg-[#332743]">
              <i className="block h-full bg-linear-to-r from-[#8d69ff] to-[#ff9a66] transition-[width] duration-75" style={{ width: `${observation.stability * 100}%` }} />
            </span>
          </div>
        )}
      </div>
      <p className="mx-0.5 mt-2 mb-px text-[0.68rem] text-[#9387a5]">
        {errorMessage || statusText}
      </p>
    </section>
  );
}
