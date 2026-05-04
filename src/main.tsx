import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service worker cleanup: this app no longer ships a PWA service worker.
// On every load, unregister any leftover SW and clear all caches so old
// installs (from previous PWA builds) pick up the latest published version.
(async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
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
    // best-effort
  }
})();

createRoot(document.getElementById("root")!).render(<App />);
