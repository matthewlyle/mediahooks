import { useEffect, useRef } from "react";

const MIN_GAP_MS = 2000;

export function useRefetchOnReturn(refetch: () => unknown): void {
  const latest = useRef(refetch);
  latest.current = refetch;
  useEffect(() => {
    // Coming back to a tab fires both visibilitychange and focus; one refetch is enough.
    let last = Date.now();
    const onReturn = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < MIN_GAP_MS) return;
      last = Date.now();
      void latest.current();
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, []);
}
