// The Aperture vite plugin auto-boots the app from aperture.config.ts; this
// entry just exists so Vite has a module to load. Surface app status to the DOM
// so the harness can confirm the renderer came up, and install the persistent
// debug panel (live transform scrubbing, playback, render readout).
import { readGeneratedBrowserAppStatus } from "@aperture-engine/app/browser";
import { installThreeCompare } from "./compare/three-compare.js";
import { installDebugPanel } from "./debug-panel.js";

const params = new URLSearchParams(window.location.search);
const compareMode = params.get("compare") !== "0";
const debugMode = params.get("debug") === "1" || params.has("debug");

function tick(): void {
  const status = readGeneratedBrowserAppStatus();
  document.body.dataset.apertureStatus = status?.status ?? "starting";
  document.body.dataset.webgpuOk = String(status?.webgpuOk ?? false);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

if (debugMode) {
  void installDebugPanel();
}

if (compareMode) {
  document.body.classList.add("shadow-lab-compare");
  void installThreeCompare();
}
