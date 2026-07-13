import { startGeneratedBrowserApp } from "@aperture-engine/app/browser";
import { defineApertureConfig } from "@aperture-engine/app/config";
import { configureApertureExampleControl } from "./example-control.js";
import {
  REGION_SIZE,
  SCOREBOARD_REGION,
  TICKER_REGION,
  TICKER_SUBRECT,
  TV_REGION,
  WALL_TEXTURE_ID,
  runtimeTextureClearColor,
  solidRgbaBytes,
  wallScreenRect,
} from "./runtime-texture-scene.js";

// D3 (three.js parity plan): the MAIN-THREAD half of the runtime-texture demo. It
// updates the worker-registered dynamic texture atlas every animation frame,
// region by region and path by path:
//   - scoreboard region : a 2D canvas -> copyExternalImageToTexture into its
//     sub-rect (AC2 import path).
//   - tv region          : an ANIMATED 2D canvas -> copyExternalImageToTexture. A
//     canvas stands in for a video source (SwiftShader/headless cannot decode
//     video; the path accepts an HTMLVideoElement identically).
//   - ticker region      : raw CPU bytes -> writeTexture, alternating a FULL-region
//     write (even frames) and a smaller SUB-RECT band (odd frames) — AC1's full +
//     partial paths. The frame report's `dynamicTextures` section carries the
//     update rate + bytes.

const stateElement = document.querySelector("#example-state");
const jsonElement = document.querySelector("#example-json");

const config = defineApertureConfig({
  mode: "browser",
  canvas: "#aperture-canvas",
  render: {
    defaultCamera: false,
    defaultLight: false,
    clearColor: runtimeTextureClearColor,
  },
});

let webgpuApp = null;
let uploadLoopStarted = false;
let uploadFrame = 0;
let lastUpload = null;

const scoreboardCanvas = createCanvas(REGION_SIZE, REGION_SIZE);
const tvCanvas = createCanvas(REGION_SIZE, REGION_SIZE);

configureApertureExampleControl({ getStatus: () => runtimeTextureStatus() });
requestAnimationFrame(function publish() {
  runtimeTextureStatus();
  requestAnimationFrame(publish);
});

try {
  const app = await startGeneratedBrowserApp({
    config,
    workerEntry: "/worker-modules/examples/runtime-texture.worker.js",
    systemManifest: [
      {
        moduleUrl: "/examples/runtime-texture.worker.js",
        hasDefaultExport: true,
        schedule: { priority: 0 },
      },
    ],
  });

  if (app.webgpu.ok) {
    webgpuApp = app.webgpu.app;
    startUploadLoop(webgpuApp);
  }
} catch (error) {
  publishStatus({
    example: "runtime-texture",
    ok: false,
    state: "failed",
    reason: "runtime-texture-start-failed",
    message:
      error instanceof Error
        ? error.message
        : "Runtime texture example failed to start.",
  });
}

function startUploadLoop(app) {
  // The dynamic texture is registered by the WORKER (this.textures.register);
  // the main thread only uploads pixels into its regions each frame.
  uploadLoopStarted = true;
  const loop = () => {
    if (webgpuApp !== null) {
      applyUploads(app);
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function applyUploads(app) {
  uploadFrame += 1;
  const frame = uploadFrame;

  // scoreboard region: canvas-sourced text (AC2 / AC3 scoreboard).
  drawScoreboard(scoreboardCanvas, frame);
  const scoreboard = app.updateDynamicTextureFromExternalImage(
    WALL_TEXTURE_ID,
    {
      source: scoreboardCanvas,
      region: SCOREBOARD_REGION,
    },
  );

  // tv region: animated canvas standing in for video (AC2 / AC3 tv).
  drawTv(tvCanvas, frame);
  const tv = app.updateDynamicTextureFromExternalImage(WALL_TEXTURE_ID, {
    source: tvCanvas,
    region: TV_REGION,
  });

  // ticker region: raw CPU bytes (AC1). Even frames full-region; odd frames a
  // smaller sub-rect band (exercises origin + bytesPerRow validation).
  const ticker =
    frame % 2 === 0
      ? app.updateDynamicTexture(WALL_TEXTURE_ID, {
          region: TICKER_REGION,
          bytesPerRow: TICKER_REGION.width * 4,
          data: solidRgbaBytes(
            TICKER_REGION.width,
            TICKER_REGION.height,
            cycleColor(frame),
          ),
        })
      : app.updateDynamicTexture(WALL_TEXTURE_ID, {
          region: TICKER_SUBRECT,
          bytesPerRow: TICKER_SUBRECT.width * 4,
          data: solidRgbaBytes(
            TICKER_SUBRECT.width,
            TICKER_SUBRECT.height,
            cycleColor(frame + 5),
          ),
        });

  lastUpload = {
    frame,
    scoreboardOk: scoreboard.ok,
    tvOk: tv.ok,
    tickerOk: ticker.ok,
    tickerMode: frame % 2 === 0 ? "full-region" : "sub-rect",
    tickerBytes: ticker.bytesUploaded,
    diagnostics: [
      ...scoreboard.diagnostics,
      ...tv.diagnostics,
      ...ticker.diagnostics,
    ].map((diagnostic) => diagnostic.code),
  };
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawScoreboard(canvas, frame) {
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  ctx.fillStyle = "#0b1a30";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#7fe08a";
  ctx.font = "12px monospace";
  ctx.fillText("SCORE", 4, 16);
  ctx.fillStyle = "#ffd84d";
  ctx.font = "22px monospace";
  ctx.fillText(String(frame % 1000).padStart(3, "0"), 4, 44);
}

function drawTv(canvas, frame) {
  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    return;
  }
  // Scrolling vertical color bars: the phase shifts every frame so any fixed
  // pixel (including the center) changes color between frames.
  const bars = 6;
  const barWidth = canvas.width / bars;
  const offset = (frame * 4) % canvas.width;
  for (let bar = 0; bar < bars; bar += 1) {
    const hue = ((bar + frame) * 60) % 360;
    ctx.fillStyle = `hsl(${hue}, 85%, 55%)`;
    const x = (bar * barWidth + offset) % canvas.width;
    ctx.fillRect(x, 0, barWidth + 1, canvas.height);
    ctx.fillRect(x - canvas.width, 0, barWidth + 1, canvas.height);
  }
}

function cycleColor(frame) {
  const phase = frame % 3;
  if (phase === 0) {
    return [230, 60, 60, 255];
  }
  if (phase === 1) {
    return [60, 200, 90, 255];
  }
  return [70, 120, 240, 255];
}

function runtimeTextureStatus() {
  const generated = globalThis.__APERTURE_GENERATED_APP__ ?? null;
  const lastFrame = generated?.diagnostics?.lastFrame ?? null;
  const dynamicTextures = lastFrame?.dynamicTextures ?? null;

  const status = {
    example: "runtime-texture",
    ok:
      generated?.status === "running" &&
      generated.webgpuOk === true &&
      lastFrame?.ok === true &&
      uploadLoopStarted &&
      (dynamicTextures?.totalUpdates ?? 0) > 0,
    state: generated?.status ?? "starting",
    reason: webGpuFailureReason(generated),
    message: webGpuFailureMessage(generated),
    uploadLoopStarted,
    uploadFrame,
    wallRect: wallScreenRect(),
    dynamicTextures,
    lastUpload,
    frame: lastFrame?.frame ?? null,
    frameOk: lastFrame?.ok ?? null,
    diagnosticsCount: lastFrame?.counts?.diagnostics ?? 0,
  };

  publishStatus(status);
  return status;
}

function webGpuFailureReason(generated) {
  if (generated?.status !== "webgpu-failed") {
    return undefined;
  }
  return typeof generated.diagnostics?.reason === "string"
    ? generated.diagnostics.reason
    : "webgpu-failed";
}

function webGpuFailureMessage(generated) {
  if (generated?.status !== "webgpu-failed") {
    return undefined;
  }
  return typeof generated.diagnostics?.message === "string"
    ? generated.diagnostics.message
    : "WebGPU initialization failed.";
}

function publishStatus(status) {
  globalThis.__APERTURE_EXAMPLE_STATUS__ = status;
  window.__APERTURE_EXAMPLE_STATUS__ = status;
  if (stateElement !== null) {
    stateElement.textContent = status.ok ? "running" : status.state;
  }
  if (jsonElement !== null) {
    jsonElement.textContent = JSON.stringify(status, null, 2);
  }
}
