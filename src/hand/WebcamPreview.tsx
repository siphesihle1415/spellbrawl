import { useEffect, useRef, useState } from "react";

export function WebcamPreview() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "blocked">("idle");

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject;
      if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
      setStatus("ready");
    } catch {
      setStatus("blocked");
    }
  };

  return (
    <section className="camera-card">
      <div className="camera-frame">
        <video ref={videoRef} muted playsInline aria-label="Local webcam preview" />
        {status !== "ready" && (
          <button type="button" onClick={enableCamera} disabled={status === "starting"}>
            {status === "starting" ? "Starting camera…" : status === "blocked" ? "Camera blocked — retry" : "Enable webcam"}
          </button>
        )}
      </div>
      <div>
        <span className={`status-dot ${status}`} />
        {status === "ready" ? "Camera ready; MediaPipe adapter is next." : "Keyboard gestures are active."}
      </div>
    </section>
  );
}
