import { useState, useEffect, useCallback } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser may block fullscreen without a direct user gesture — silently ignore
    }
  }, []);

  return (
    <button
      onClick={toggle}
      title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      style={{
        position: "fixed",
        top: "12px",
        right: "12px",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        borderRadius: "8px",
        border: "1px solid rgba(255,255,255,0.25)",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: "#fff",
        cursor: "pointer",
        transition: "background 0.15s ease, transform 0.1s ease",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.55)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.35)")}
      onMouseDown={e => (e.currentTarget.style.transform = "scale(0.92)")}
      onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
    >
      {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
    </button>
  );
}
