

User wants the PWA icon (used when "Add to Home Screen" / install) to be the Evolve Foundation logo instead of the current placeholder `pwa-192x192.png` / `pwa-512x512.png`.

Currently `vite.config.ts` references `/pwa-192x192.png` and `/pwa-512x512.png`, and `index.html` references `/pwa-192x192.png` for the apple-touch-icon. The Evolve logo is hosted at `https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp`.

Browsers/PWA installers require the manifest icons to be same-origin PNG files at the declared sizes. I need to generate proper square PNG files from the logo and place them in `public/`.

## Plan: Use Evolve logo as PWA icon

### Steps
1. **Download** the Evolve logo from `https://www.evolvefoundation.us/lovable-uploads/evolve-logo.webp`.
2. **Generate PNGs** at the required sizes using ImageMagick:
   - `public/pwa-192x192.png` (192×192)
   - `public/pwa-512x512.png` (512×512)
   - `public/apple-touch-icon.png` (180×180, optional polish)
   The logo will be centered on a white background (matches the manifest's `background_color: "#FFFFFF"`) and padded so it reads well as a maskable icon.
3. **Verify** the generated images by inspecting dimensions and a quick visual check.
4. **No code changes needed** in `vite.config.ts` — the existing manifest already points at `/pwa-192x192.png` and `/pwa-512x512.png`. The new files will simply replace the placeholders.
5. **Optionally** update `index.html`'s `apple-touch-icon` to point at the new 180×180 file for a sharper iOS home-screen icon.

### Files
| File | Change |
|---|---|
| `public/pwa-192x192.png` | Replace with Evolve logo (192×192, white bg) |
| `public/pwa-512x512.png` | Replace with Evolve logo (512×512, white bg) |
| `public/apple-touch-icon.png` | New 180×180 icon |
| `index.html` | Update `apple-touch-icon` href (1-line tweak) |

### Notes
- PWA install icon only updates after republishing — Lovable preview iframe disables the service worker, so the user will need to publish to see the new icon on installed devices.
- Existing favicon (small browser tab icon) already uses the live `evolve-logo.webp` URL and is unchanged.
- No backend, manifest, or dependency changes.

