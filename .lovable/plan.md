# Live site not updating after publish

## Diagnosis

The published app registers a full PWA service worker (`vite-plugin-pwa` with `registerType: "autoUpdate"`, `skipWaiting`, `clientsClaim`, plus runtime caching for HTML, fonts, etc.). For returning visitors:

1. The browser has an old service worker installed from a previous publish.
2. That SW serves the cached HTML/JS shell on the next visit. `autoUpdate` only kicks in *after* the page has loaded with the old assets, then triggers a background SW update — the user still sees the old build until they reload again (often a second visit later).
3. There's also a path collision risk: this project ships `public/sw.js` (the kill-switch we added for the editor preview) **and** `vite-plugin-pwa` generates its own `sw.js`. In production builds the plugin's generated worker wins, so the kill-switch never reaches end users.
4. Lovable's hosting proxy already serves `index.html` with `no-cache` — but a service worker installed in the browser short-circuits the network entirely, so that header doesn't help.

Net effect: **publishing a new version doesn't reach already-installed users until they refresh twice (or wait long enough for the SW skip-waiting cycle to land).**

## Fix (frontend only — no backend, no DB, no business-logic edits)

### A. Remove the runtime-caching PWA from the published site
In `vite.config.ts`, drop the `VitePWA(...)` plugin call entirely. The published app then has **no service worker registered for new visitors**, which means every page load fetches fresh `index.html` from Lovable's hosting (which already sends `no-cache`), and Vite's hashed asset filenames handle JS/CSS cache-busting automatically.

Trade-off: the app is no longer installable as a PWA / no offline shell. Per project memory `[PWA Offline Support]`, PWA is currently disabled in the editor preview anyway, and the offline-draft feature uses IndexedDB — it does not depend on a SW.

### B. Keep `public/sw.js` as a permanent kill-switch
This file already self-destructs (skipWaiting → claim → delete all caches → unregister). With VitePWA removed, our `sw.js` is the only worker shipped, so any browser that previously installed the old VitePWA worker will pick up our kill-switch the next time the browser checks for an update at `/sw.js`, wipe its caches, and reload once — getting the latest published version.

### C. Update `src/main.tsx`
Currently it only unregisters when on a Lovable preview/iframe host. After this change we want to also unregister on the **published** domain so old PWA installs are cleaned up on the very first visit after deploy.
- Run the unregister + cache-wipe + one-time reload code on **all** hosts, not just preview. Already idempotent via the `__sw_cleaned` sessionStorage flag.

### D. Manifest tag in `index.html`
If `index.html` references `manifest.webmanifest` (auto-injected by VitePWA), remove that link tag too so we don't 404. Verify and clean up.

## What we are NOT changing
- No DB / RLS / edge functions.
- No realtime/query code (already shipped this session).
- No app routing, auth, or feature code.
- The offline-draft feature continues to work (it uses IndexedDB, not the SW).

## Verification
1. Publish, then open the live site in a browser that already had the old PWA installed:
   - DevTools → Application → Service Workers: the old SW is replaced by `sw.js` (kill-switch), runs once, then unregisters.
   - One automatic reload happens (guarded so it doesn't loop).
   - Page now shows the freshly published build.
2. Publish a *second* update. Visit again: no SW is registered, the new HTML is fetched directly, new build appears immediately.
3. Confirm `Application → Cache Storage` is empty after the cleanup.

## Out of scope (ask before doing)
- Re-introducing PWA installability with a manifest-only setup (no SW). Tell me if you want this — it's a small follow-up.
