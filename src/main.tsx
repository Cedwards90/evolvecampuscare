import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA: Unregister service workers in iframe/preview contexts to prevent stale cache
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  (async () => {
    try {
      const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
      const hadSW = regs.length > 0;
      await Promise.all(regs.map((r) => r.unregister()));
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // Force one reload after cleanup so the page stops being controlled by
      // the old SW and fetches fresh assets. Guarded to prevent loops.
      if (hadSW && !sessionStorage.getItem("__sw_cleaned")) {
        sessionStorage.setItem("__sw_cleaned", "1");
        location.reload();
      }
    } catch {
      // ignore — best-effort
    }
  })();
}

createRoot(document.getElementById("root")!).render(<App />);
