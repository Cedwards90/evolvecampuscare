# Fix: Lovable preview not reflecting code changes

## Diagnosis

The project has `vite-plugin-pwa` enabled (`vite.config.ts`) with `registerType: "autoUpdate"`. `src/main.tsx` already calls `unregister()` for service workers on preview/iframe hosts, but two gaps remain that explain why your preview keeps showing stale code:

1. **Caches aren't cleared on unregister.** Calling `registration.unregister()` only stops future control — the existing `caches` storage (HTML, JS, CSS) stays on disk and the *current* page is still controlled by the old SW until a hard reload. So even after we unregister, the iframe keeps serving the cached shell from before the fix.
2. **No kill-switch worker.** Browsers that registered an old SW before `devOptions.enabled = false` was set keep that SW until a newer worker at the same path replaces it. There's no `public/sw.js` shipped to take over and clean up.

## Fix (frontend only, no backend changes)

### A. `src/main.tsx` — clear caches and force one reload after unregister
When in preview/iframe:
- `await` all `registration.unregister()` calls.
- Then `await Promise.all(caches.keys().map(caches.delete))`.
- If at least one SW was actually unregistered, do a single `location.reload()` guarded by a `sessionStorage` flag (`__sw_cleaned`) so we never loop.

### B. Ship a kill-switch worker at `public/sw.js`
A tiny static file that:
- `skipWaiting` + `clients.claim` immediately
- Deletes every cache it finds
- Calls `self.registration.unregister()` so it removes itself

Any browser that still has an old PWA worker registered will pick this up on next visit, wipe its caches, and self-destruct.

### C. Add a build-time cache-bust signal
Inject Vite's `import.meta.env.VITE_BUILD_ID` (timestamp) into a `<meta name="build-id">` so we can detect when a different build than the cached one is running, and trigger reload + cache wipe in the preview iframe.

## Out of scope
- Removing `vite-plugin-pwa` entirely. We're keeping it for the published app (it's already configured to skip preview), just neutering its leftover effects.
- Any backend, RLS, or schema changes.
- Real-time data syncing — that was already shipped in the previous turn.

## Verification
1. Open the preview, then `chrome://inspect → Application → Service Workers`: confirm none are registered after page load.
2. `Application → Cache Storage`: confirm empty after the cleanup reload.
3. Make a trivial code edit (e.g., change a header label). The preview should reflect it on the next HMR push without a manual refresh, and a hard refresh always shows fresh code.
