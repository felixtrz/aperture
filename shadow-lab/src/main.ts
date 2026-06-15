// The Aperture vite plugin auto-boots the app from aperture.config.ts; this
// entry just exists so Vite has a module to load. Surface app status to the DOM
// so the harness can confirm the renderer came up, and install the persistent
// debug panel (live transform scrubbing, playback, render readout).
import { readGeneratedBrowserAppStatus } from "@aperture-engine/app/browser";
import { installThreeCompare } from "./compare/three-compare.js";
import { installDebugPanel } from "./debug-panel.js";

function tick(): void {
  const status = readGeneratedBrowserAppStatus();
  document.body.dataset.apertureStatus = status?.status ?? "starting";
  document.body.dataset.webgpuOk = String(status?.webgpuOk ?? false);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

void installDebugPanel();
void installThreeCompare();
