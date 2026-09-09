import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Touch-capable phones/tablets need landscape; a narrow desktop window can still be used.
const portraitTouchQuery = "(orientation: portrait) and (any-pointer: coarse)";

export function RotatePrompt({ ready }: { ready: boolean }) {
  const [portraitTouch, setPortraitTouch] = useState(() => window.matchMedia(portraitTouchQuery).matches);
  const dialog = useRef<HTMLDialogElement>(null);
  const blocked = ready && portraitTouch;

  useEffect(() => {
    const media = window.matchMedia(portraitTouchQuery);
    const update = () => setPortraitTouch(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!blocked) return;
    const opener = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [blocked]);

  if (!blocked) return null;
  return createPortal(
    <dialog ref={dialog} className="rotate-prompt" aria-labelledby="rotate-title" aria-describedby="rotate-description" onCancel={(event) => event.preventDefault()}>
      <div>
        <span className="rotate-device" aria-hidden="true">↻</span>
        <h2 id="rotate-title" tabIndex={-1} autoFocus>Rotate your device to play</h2>
        <p id="rotate-description">Turn your phone or tablet sideways for the arena, spellbook and camera previews.</p>
      </div>
    </dialog>,
    document.body,
  );
}
