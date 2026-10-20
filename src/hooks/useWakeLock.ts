import { useEffect, useRef } from "react";

export function useWakeLock(enabled: boolean) {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function request() {
      if (!enabled || !("wakeLock" in navigator)) return;
      try {
        sentinel.current = await navigator.wakeLock.request("screen");
      } catch {
        // unsupported / denied — ignore
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible" && enabled) void request();
    }

    if (enabled) {
      void request();
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel.current?.release();
      sentinel.current = null;
      void cancelled;
    };
  }, [enabled]);
}
