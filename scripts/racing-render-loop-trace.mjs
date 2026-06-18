#!/usr/bin/env node
/* global KeyboardEvent, document, location */
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_DIR = path.join(ROOT, "tmp", "racing-render-loop-traces");
const DEFAULT_APERTURE_DIST = path.join(ROOT, "racing", "dist");
const DEFAULT_THREE_ROOT = path.join(ROOT, "references", "Starter-Kit-Racing");

const args = parseArgs(process.argv.slice(2));
const durationMs = numberArg(args.duration, 8000);
const warmupMs = numberArg(args.warmup, 2000);
const driveSettleMs = numberArg(args["drive-settle"], 1000);
const repeatCount = Math.max(1, Math.floor(numberArg(args.repeat, 1)));
const outDir = path.resolve(String(args.out ?? DEFAULT_OUT_DIR));
const captureTrace = args.trace !== false;
const captureCpuProfile = args["cpu-profile"] !== false;
const apertureGpuTimings = args["aperture-gpu-timings"] === true;
const threeGlDiagnostics = args["three-gl-diagnostics"] === true;
const apertureStartOptionQueryParams =
  collectApertureStartOptionQueryParams(args);
const visualDiagnostics =
  args["visual-diagnostics"] !== false &&
  args["no-visual-diagnostics"] !== true;
const requestedBrowserChannel = normalizeBrowserChannel(
  args["browser-channel"],
);
const scenarios = String(args.scenario ?? "idle,drive")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const commonBrowserArgs = [
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-ipc-flooding-protection",
  "--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling",
  "--enable-webgl-developer-extensions",
  "--enable-webgl-draft-extensions",
  "--enable-precise-memory-info",
  "--js-flags=--expose-gc",
];

const bundledChromiumGpuArgs = [
  "--enable-unsafe-webgpu",
  "--ignore-gpu-blocklist",
  "--use-angle=metal",
];

const traceCategories = [
  "blink.user_timing",
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "disabled-by-default-devtools.timeline.frame",
  "disabled-by-default-v8.cpu_profiler",
  "gpu",
  "v8",
].join(",");

await main();

async function main() {
  await mkdir(outDir, { recursive: true });

  const servers = [];
  let apertureUrl = stringArg(args["aperture-url"]);
  if (apertureUrl === null) {
    const server = await serveStatic({
      root: DEFAULT_APERTURE_DIST,
      preferredPort: numberArg(args["aperture-port"], 5193),
      headers: crossOriginIsolationHeaders(),
    });
    servers.push(server);
    apertureUrl = server.url;
  }

  let threeUrl = stringArg(args["three-url"]);
  if (threeUrl === null) {
    const server = await serveStatic({
      root: DEFAULT_THREE_ROOT,
      preferredPort: numberArg(args["three-port"], 5204),
      transforms: {
        "/index.html": transformThreeIndex,
        "/js/main.js": instrumentThreeMain,
        "/js/Particles.js": instrumentThreeParticles,
      },
      extraRoots: {
        "/__three__/": path.join(ROOT, "references", "three.js"),
      },
    });
    servers.push(server);
    threeUrl = server.url;
  }

  const targetFilter = new Set(
    String(args.target ?? "aperture,three")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const targets = [
    { id: "aperture", label: "Aperture", url: apertureUrl, kind: "aperture" },
    { id: "three", label: "three.js", url: threeUrl, kind: "three" },
  ].filter((target) => targetFilter.has(target.id) || targetFilter.has("both"));

  if (targets.length === 0) {
    throw new Error(
      "No targets selected. Use --target=aperture, --target=three, or --target=aperture,three.",
    );
  }

  const browserLaunch = await launchTraceBrowser();
  const browser = browserLaunch.browser;
  const summary = {
    createdAt: new Date().toISOString(),
    durationMs,
    warmupMs,
    driveSettleMs,
    repeatCount,
    captureTrace,
    captureCpuProfile,
    apertureGpuTimings,
    threeGlDiagnostics,
    apertureStartOptions: apertureStartOptionQueryParams,
    visualDiagnostics,
    headless: args.headed === true ? false : true,
    browser: browserLaunch.summary,
    browserArgs: browserLaunch.summary.args,
    targets: targets.map((target) => ({
      id: target.id,
      label: target.label,
      url: target.url,
    })),
    runs: [],
  };

  try {
    for (const scenario of scenarios) {
      if (scenario !== "idle" && scenario !== "drive") {
        throw new Error(
          `Unsupported scenario "${scenario}". Use idle, drive, or idle,drive.`,
        );
      }

      for (let trialIndex = 0; trialIndex < repeatCount; trialIndex += 1) {
        for (const target of targets) {
          const run = await runScenario(browser, target, scenario, trialIndex);
          summary.runs.push(run.summary);
          await writeFile(
            path.join(
              outDir,
              `${runFileBase(target.id, scenario, trialIndex)}-snapshot.json`,
            ),
            JSON.stringify(run.snapshot, null, 2),
          );
        }
      }
    }
  } finally {
    await browser.close();
    await Promise.all(servers.map((server) => server.close()));
  }

  const summaryPath = path.join(outDir, "summary.json");
  summary.framePacingComparisons = compareFramePacing(summary.runs);
  summary.framePacingAggregateComparisons = aggregateFramePacingComparisons(
    summary.framePacingComparisons,
  );
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  printSummary(summary, summaryPath);
}

async function runScenario(browser, target, scenario, trialIndex) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await page.bringToFront();
  page.setDefaultTimeout(30000);
  await page.addInitScript(createFrameSamplerInitScript());

  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (consoleMessages.length < 50) {
      consoleMessages.push({
        type: message.type(),
        text: message.text(),
      });
    }
  });
  page.on("pageerror", (error) => {
    if (pageErrors.length < 20) {
      pageErrors.push(String(error?.stack ?? error));
    }
  });
  page.on("requestfailed", (request) => {
    if (failedRequests.length < 30) {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText ?? "unknown",
      });
    }
  });

  let url = addQueryFlag(
    target.url,
    target.kind === "three" ? "perf=1" : "trace=1",
  );
  if (target.kind === "aperture" && apertureGpuTimings) {
    url = addQueryFlag(url, "gpuTimings=1");
  }
  if (target.kind === "aperture") {
    for (const [key, value] of Object.entries(apertureStartOptionQueryParams)) {
      url = addQueryFlag(url, `${key}=${encodeURIComponent(value)}`);
    }
  }
  if (target.kind === "three" && threeGlDiagnostics) {
    url = addQueryFlag(url, "glDiagnostics=1");
  }
  await page.goto(url, { waitUntil: "domcontentloaded" });
  try {
    await waitForTargetReady(page, target.kind);
  } catch (error) {
    const readiness = await collectReadinessSnapshot(page).catch(
      (snapshotError) => ({
        snapshotError: String(snapshotError?.stack ?? snapshotError),
      }),
    );
    const message = [
      `Timed out waiting for ${target.label} readiness at ${url}.`,
      `Original error: ${String(error?.message ?? error)}`,
      JSON.stringify(
        { readiness, consoleMessages, pageErrors, failedRequests },
        null,
        2,
      ),
    ].join("\n");
    throw new Error(message, { cause: error });
  }
  await page.waitForTimeout(warmupMs);

  if (scenario === "drive") {
    await setDriving(page, target.kind, true);
    await page.waitForTimeout(driveSettleMs);
  } else {
    await setDriving(page, target.kind, false);
  }

  await clearSamplers(page);
  const profiler = await startProfiling(
    page,
    runFileBase(target.id, scenario, trialIndex),
  );
  await page.waitForTimeout(durationMs);
  const profileFiles = await profiler.stop();
  const snapshot = await collectSnapshot(page);

  await setDriving(page, target.kind, false);
  await context.close();

  snapshot.consoleMessages = consoleMessages;
  snapshot.pageErrors = pageErrors;
  snapshot.failedRequests = failedRequests;
  snapshot.profileFiles = profileFiles;

  return {
    snapshot,
    summary: summarizeRun(target, scenario, trialIndex, snapshot, profileFiles),
  };
}

async function startProfiling(page, fileBase) {
  const client = await page.context().newCDPSession(page);
  if (captureCpuProfile) {
    await client.send("Profiler.enable");
    await client.send("Profiler.start");
  }

  const traceEvents = [];
  let traceCompleteResolve;
  const traceComplete = new Promise((resolve) => {
    traceCompleteResolve = resolve;
  });

  if (captureTrace) {
    client.on("Tracing.dataCollected", (event) => {
      if (Array.isArray(event.value)) {
        traceEvents.push(...event.value);
      }
    });
    client.on("Tracing.tracingComplete", () => traceCompleteResolve());
    await client.send("Tracing.start", {
      categories: traceCategories,
      options: "sampling-frequency=10000",
      transferMode: "ReportEvents",
    });
  }

  return {
    async stop() {
      if (captureTrace) {
        await client.send("Tracing.end");
        await traceComplete;
      }

      const files = {};
      if (captureCpuProfile) {
        const { profile } = await client.send("Profiler.stop");
        const profilePath = path.join(outDir, `${fileBase}.cpuprofile`);
        await writeFile(profilePath, JSON.stringify(profile));
        files.cpuProfile = profilePath;
        files.cpuProfileSummary = analyzeCpuProfile(profile);
      }

      if (captureTrace) {
        const tracePath = path.join(outDir, `${fileBase}.trace.json`);
        await writeFile(tracePath, JSON.stringify({ traceEvents }));
        files.trace = tracePath;
      }

      await client.detach();
      return files;
    },
  };
}

async function waitForTargetReady(page, kind) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const ready = await page.evaluate((pageKind) => {
      if (pageKind === "three") {
        return globalThis.__THREE_RACING_STATUS__?.ready === true;
      }

      const status =
        globalThis.__APERTURE_EXAMPLE_STATUS__ ??
        globalThis.__APERTURE_GENERATED_APP__;
      const frame = status?.frame ?? status?.lastFrame ?? 0;
      const hasFrameDiagnostics =
        status?.diagnostics?.lastFrame !== undefined ||
        status?.render?.lastFrame !== undefined ||
        status?.performance?.latest !== undefined;
      return (
        status !== undefined &&
        status !== null &&
        status.status !== "failed" &&
        status.lastFailure == null &&
        (frame >= 2 || hasFrameDiagnostics || status.webgpuOk === true)
      );
    }, kind);

    if (ready) return;
    await page.waitForTimeout(100);
  }

  throw new Error(`Timed out waiting for ${kind} readiness.`);
}

async function collectReadinessSnapshot(page) {
  return await page.evaluate(() => ({
    href: location.href,
    title: document.title,
    bodyText: document.body?.innerText?.slice(0, 1000) ?? "",
    canvasCount: document.querySelectorAll("canvas").length,
    apertureKeys: Object.keys(globalThis)
      .filter((key) => key.startsWith("__APERTURE"))
      .sort(),
    apertureStatus:
      globalThis.__APERTURE_EXAMPLE_STATUS__ ??
      globalThis.__APERTURE_GENERATED_APP__ ??
      null,
    threeStatus: globalThis.__THREE_RACING_STATUS__ ?? null,
  }));
}

async function setDriving(page, kind, enabled) {
  await page.evaluate(
    ({ kind: pageKind, enabled: isEnabled }) => {
      const keys = [
        { code: "KeyW", key: "w" },
        { code: "KeyD", key: "d" },
      ];

      if (pageKind === "three" && globalThis.__THREE_RACING_CONTROL__) {
        if (isEnabled) {
          globalThis.__THREE_RACING_CONTROL__.setDrive({ x: 0.65, z: 1 });
        } else {
          globalThis.__THREE_RACING_CONTROL__.clearInput();
        }
      }

      for (const key of keys) {
        globalThis.dispatchEvent(
          new KeyboardEvent(isEnabled ? "keydown" : "keyup", {
            key: key.key,
            code: key.code,
            bubbles: true,
            cancelable: true,
          }),
        );
      }

      if (!isEnabled && globalThis.__THREE_RACING_CONTROL__) {
        globalThis.__THREE_RACING_CONTROL__.clearInput();
      }
    },
    { kind, enabled },
  );
}

async function clearSamplers(page) {
  await page.evaluate(() => {
    globalThis.gc?.();
    globalThis.__THREE_RACING_CONTROL__?.clearPerfSamples?.();
    globalThis.__RACING_TRACE_RAF__?.clear?.();
  });
}

async function collectSnapshot(page) {
  const snapshot = await page.evaluate(() => {
    globalThis.gc?.();
    return {
      href: location.href,
      userAgent: navigator.userAgent,
      crossOriginIsolated: globalThis.crossOriginIsolated === true,
      memory: globalThis.performance?.memory
        ? {
            usedJSHeapSize: globalThis.performance.memory.usedJSHeapSize,
            totalJSHeapSize: globalThis.performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: globalThis.performance.memory.jsHeapSizeLimit,
          }
        : null,
      resources: Array.from(
        globalThis.performance?.getEntriesByType?.("resource") ?? [],
      )
        .map((entry) => entry.name)
        .filter(
          (name) =>
            name.includes("__three__") ||
            name.includes("cdn.jsdelivr.net") ||
            name.includes("esm.sh") ||
            name.endsWith(".glb") ||
            name.endsWith(".png") ||
            name.endsWith(".ogg"),
        )
        .slice(0, 200),
      raf: globalThis.__RACING_TRACE_RAF__?.snapshot?.() ?? null,
      aperture: compactApertureStatus(
        globalThis.__APERTURE_EXAMPLE_STATUS__ ??
          globalThis.__APERTURE_GENERATED_APP__,
      ),
      three: globalThis.__THREE_RACING_STATUS__ ?? null,
    };

    function compactApertureStatus(status) {
      if (status === undefined || status === null) return null;
      const fullDiagnostics =
        status.__apertureRenderDiagnostics?.getDiagnostics?.({
          detail: "full",
        }) ?? null;
      const diagnostics = status.diagnostics ?? null;
      const lastFrame =
        diagnostics?.lastFrame ??
        diagnostics?.frame ??
        status.render?.lastFrame ??
        null;
      const fullLastFrame = fullDiagnostics?.lastFrame ?? null;
      const counts = lastFrame?.counts ?? diagnostics?.counts ?? null;
      return {
        frame: status.frame ?? status.lastFrame ?? null,
        status: status.status ?? null,
        webgpuOk: status.webgpuOk ?? null,
        performance: status.performance ?? null,
        render: status.render ?? null,
        workerMessages: status.workerMessages ?? null,
        diagnostics: {
          counts,
          cadence: diagnostics?.cadence ?? fullDiagnostics?.cadence ?? null,
          changeSet:
            lastFrame?.changeSet ??
            lastFrame?.renderChangeSet ??
            diagnostics?.changeSet ??
            null,
          phaseTimings:
            lastFrame?.phaseTimings ?? diagnostics?.phaseTimings ?? null,
          gpuTimings: lastFrame?.gpuTimings ?? diagnostics?.gpuTimings ?? null,
          shadow: lastFrame?.shadow ?? diagnostics?.shadow ?? null,
          particles: lastFrame?.particles ?? diagnostics?.particles ?? null,
          resourceReuse:
            lastFrame?.resourceReuse ??
            fullLastFrame?.resourceReuse ??
            diagnostics?.resourceReuse ??
            null,
        },
        lastWorkerSummary: status.lastWorkerSummary
          ? {
              frame: status.lastWorkerSummary.frame ?? null,
              previousPublishTiming:
                status.lastWorkerSummary.previousPublishTiming ?? null,
              publishTiming: status.lastWorkerSummary.publishTiming ?? null,
            }
          : null,
      };
    }
  });
  snapshot.visual = await collectVisualDiagnostics(page);
  return snapshot;
}

async function collectVisualDiagnostics(page) {
  if (visualDiagnostics !== true) {
    return null;
  }

  const canvasInfo = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return {
        ok: false,
        reason: "canvas-missing",
        message: "No canvas element was found for visual diagnostics.",
      };
    }

    const rect = canvas.getBoundingClientRect();

    return {
      ok: true,
      visibilityState: document.visibilityState,
      width: canvas.width,
      height: canvas.height,
      clientWidth: rect.width,
      clientHeight: rect.height,
    };
  });

  if (canvasInfo.ok !== true) {
    return canvasInfo;
  }

  const requested = [
    { id: "upper-left", x: 0.2, y: 0.25 },
    { id: "upper-center", x: 0.5, y: 0.25 },
    { id: "upper-right", x: 0.8, y: 0.25 },
    { id: "center-left", x: 0.2, y: 0.5 },
    { id: "center", x: 0.5, y: 0.5 },
    { id: "center-right", x: 0.8, y: 0.5 },
    { id: "lower-left", x: 0.2, y: 0.75 },
    { id: "lower-center", x: 0.5, y: 0.75 },
    { id: "lower-right", x: 0.8, y: 0.75 },
  ];

  try {
    const png = await page.locator("canvas").first().screenshot({
      type: "png",
    });
    const image = readPngImage(png);
    const samples = requested.map((sample) => {
      const x = clampIndex(Math.floor(sample.x * image.width), image.width);
      const y = clampIndex(Math.floor(sample.y * image.height), image.height);
      const pixel = readImagePixel(image, x, y);

      return {
        id: sample.id,
        x,
        y,
        pixel,
        luminance: pixelLuminance(pixel),
      };
    });
    const nonTransparentSamples = samples.filter(
      (sample) => sample.pixel.a > 8,
    ).length;
    const nonBlackSamples = samples.filter(
      (sample) =>
        sample.pixel.r > 8 || sample.pixel.g > 8 || sample.pixel.b > 8,
    ).length;

    return {
      ok: true,
      source: "screenshot",
      visibilityState: canvasInfo.visibilityState,
      width: canvasInfo.width,
      height: canvasInfo.height,
      screenshotWidth: image.width,
      screenshotHeight: image.height,
      clientWidth: canvasInfo.clientWidth,
      clientHeight: canvasInfo.clientHeight,
      sampleCount: samples.length,
      nonTransparentSamples,
      nonBlackSamples,
      likelyBlank: nonTransparentSamples === 0 || nonBlackSamples === 0,
      samples,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "screenshot-readback-failed",
      width: canvasInfo.width,
      height: canvasInfo.height,
      clientWidth: canvasInfo.clientWidth,
      clientHeight: canvasInfo.clientHeight,
      message: String(error?.message ?? error),
    };
  }
}

function readPngImage(png) {
  if (!isPng(png)) {
    throw new Error("Screenshot is not a PNG.");
  }

  const idatChunks = [];
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;

  while (offset < png.length) {
    const chunkLength = png.readUInt32BE(offset);
    offset += 4;

    const chunkType = png.subarray(offset, offset + 4).toString("ascii");
    offset += 4;

    const chunkData = png.subarray(offset, offset + chunkLength);
    offset += chunkLength + 4;

    if (chunkType === "IHDR") {
      width = chunkData.readUInt32BE(0);
      height = chunkData.readUInt32BE(4);
      bitDepth = chunkData[8] ?? 0;
      colorType = chunkData[9] ?? 0;
    } else if (chunkType === "IDAT") {
      idatChunks.push(chunkData);
    } else if (chunkType === "IEND") {
      break;
    }
  }

  if (width <= 0 || height <= 0 || idatChunks.length === 0) {
    throw new Error("PNG screenshot is missing image data.");
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(
      `Unsupported PNG screenshot format: bitDepth=${bitDepth}, colorType=${colorType}.`,
    );
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const pixels = unfilterPngScanlines(
    inflateSync(Buffer.concat(idatChunks)),
    width,
    height,
    bytesPerPixel,
  );

  return {
    width,
    height,
    bytesPerPixel,
    pixels,
  };
}

function readImagePixel(image, x, y) {
  const pixelOffset = (y * image.width + x) * image.bytesPerPixel;

  return {
    r: image.pixels[pixelOffset] ?? 0,
    g: image.pixels[pixelOffset + 1] ?? 0,
    b: image.pixels[pixelOffset + 2] ?? 0,
    a: image.bytesPerPixel === 4 ? (image.pixels[pixelOffset + 3] ?? 0) : 255,
  };
}

function unfilterPngScanlines(data, width, height, bytesPerPixel) {
  const rowBytes = width * bytesPerPixel;
  const pixels = new Uint8Array(rowBytes * height);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = data[sourceOffset] ?? -1;
    sourceOffset += 1;
    const rowOffset = y * rowBytes;

    for (let x = 0; x < rowBytes; x += 1) {
      const raw = data[sourceOffset] ?? 0;
      sourceOffset += 1;
      const left =
        x >= bytesPerPixel ? (pixels[rowOffset + x - bytesPerPixel] ?? 0) : 0;
      const up = y > 0 ? (pixels[rowOffset - rowBytes + x] ?? 0) : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel
          ? (pixels[rowOffset - rowBytes + x - bytesPerPixel] ?? 0)
          : 0;

      pixels[rowOffset + x] =
        (raw + reconstructedPngByte(filter, left, up, upLeft)) & 0xff;
    }
  }

  return pixels;
}

function reconstructedPngByte(filter, left, up, upLeft) {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return left;
    case 2:
      return up;
    case 3:
      return Math.floor((left + up) / 2);
    case 4:
      return paethPredictor(left, up, upLeft);
    default:
      throw new Error(`Unsupported PNG filter: ${filter}.`);
  }
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  return upDistance <= upLeftDistance ? up : upLeft;
}

function isPng(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length > 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

function clampIndex(index, size) {
  if (size <= 0) return 0;

  return Math.min(size - 1, Math.max(0, index));
}

function pixelLuminance(pixel) {
  return 0.2126 * pixel.r + 0.7152 * pixel.g + 0.0722 * pixel.b;
}

function summarizeRun(target, scenario, trialIndex, snapshot, profileFiles) {
  const rafSamples = snapshot.raf?.samples ?? [];
  const statusSamples = snapshot.raf?.statusSamples ?? [];
  const intervals = rafSamples
    .map((sample) => sample.intervalMs)
    .filter(isFiniteNumber);
  const callbacks = rafSamples
    .map((sample) => sample.callbackMs)
    .filter(isFiniteNumber);
  const apertureSamples = statusSamples
    .map((sample) => sample.aperture)
    .filter((sample) => sample !== null);
  const threeSamples = statusSamples
    .map((sample) => sample.three)
    .filter((sample) => sample !== null);

  return {
    target: target.id,
    label: target.label,
    scenario,
    trial: trialIndex + 1,
    url: snapshot.href,
    crossOriginIsolated: snapshot.crossOriginIsolated,
    memory: snapshot.memory,
    raf: {
      sampleCount: rafSamples.length,
      intervalSampleCount: intervals.length,
      callbackSampleCount: callbacks.length,
      intervalMs: quantiles(intervals),
      callbackMs: quantiles(callbacks),
      pacing: summarizeFramePacing(intervals),
    },
    aperture: summarizeApertureSamples(apertureSamples, snapshot.aperture),
    three: summarizeThreeSamples(threeSamples, snapshot.three),
    visual: summarizeVisualDiagnostics(snapshot.visual),
    profileFiles,
  };
}

function runFileBase(targetId, scenario, trialIndex) {
  const base = `${targetId}-${scenario}`;
  return repeatCount === 1 ? base : `${base}-trial${trialIndex + 1}`;
}

function summarizeVisualDiagnostics(visual) {
  if (visual === null || visual === undefined) return null;
  if (visual.ok !== true) {
    return {
      ok: false,
      reason: visual.reason ?? "unknown",
      message: visual.message ?? null,
    };
  }

  return {
    ok: true,
    source: visual.source ?? null,
    visibilityState: visual.visibilityState ?? null,
    width: visual.width,
    height: visual.height,
    screenshotWidth: visual.screenshotWidth ?? null,
    screenshotHeight: visual.screenshotHeight ?? null,
    sampleCount: visual.sampleCount,
    nonTransparentSamples: visual.nonTransparentSamples,
    nonBlackSamples: visual.nonBlackSamples,
    likelyBlank: visual.likelyBlank === true,
    samples: visual.samples,
  };
}

function summarizeApertureSamples(samples, latest) {
  if (latest === null && samples.length === 0) return null;
  const drawCounts = samples
    .map((sample) => sample?.counts?.draw ?? sample?.counts?.drawCalls)
    .filter(isFiniteNumber);
  return {
    latest,
    drawCalls: quantiles(drawCounts),
    phaseTimings: summarizeAperturePhaseTimings(samples, latest),
    cadence: summarizeApertureCadence(samples, latest),
    gpuTimings: summarizeApertureGpuTimings(samples, latest),
    workerMessages: summarizeApertureWorkerMessages(samples, latest),
    performanceTransport:
      latest?.performance?.latest?.transport ??
      latest?.performance?.transport ??
      null,
  };
}

function summarizeApertureCadence(samples, latest) {
  const queueAgeMs = [];
  const pendingAgeMs = [];
  const frameGaps = [];
  const skippedFrames = [];

  for (const source of [
    ...samples.map((sample) => sample?.cadence),
    latest?.diagnostics?.cadence,
  ]) {
    if (source === undefined || source === null) continue;
    const pacing = source.pacing ?? null;
    const queueAge = pacing?.snapshotQueueAgeMilliseconds;
    const frameGap = pacing?.renderedFrameGap;

    if (isFiniteNumber(queueAge?.latest)) {
      queueAgeMs.push(queueAge.latest);
    }
    if (isFiniteNumber(pacing?.pendingSnapshotAgeMilliseconds)) {
      pendingAgeMs.push(pacing.pendingSnapshotAgeMilliseconds);
    }
    if (isFiniteNumber(frameGap?.latest)) {
      frameGaps.push(frameGap.latest);
    }
    if (isFiniteNumber(pacing?.skippedSnapshotFrames)) {
      skippedFrames.push(pacing.skippedSnapshotFrames);
    }
  }

  return {
    latest: latest?.diagnostics?.cadence ?? null,
    snapshotQueueAgeMs: quantiles(queueAgeMs),
    pendingSnapshotAgeMs: quantiles(pendingAgeMs),
    renderedFrameGap: quantiles(frameGaps),
    skippedSnapshotFrames: quantiles(skippedFrames),
  };
}

function summarizeAperturePhaseTimings(samples, latest) {
  const totalMs = [];
  const phaseMsByName = new Map();

  for (const source of [
    ...samples.map((sample) => sample?.phaseTimings),
    latest?.diagnostics?.phaseTimings,
  ]) {
    if (source === undefined || source === null) continue;
    if (isFiniteNumber(source.totalMilliseconds)) {
      totalMs.push(source.totalMilliseconds);
    }
    const phases = Array.isArray(source.phases) ? source.phases : [];
    for (const phase of phases) {
      const name = String(phase?.phase ?? "unknown");
      const milliseconds = phase?.latestMilliseconds;
      if (!isFiniteNumber(milliseconds)) continue;
      let values = phaseMsByName.get(name);
      if (values === undefined) {
        values = [];
        phaseMsByName.set(name, values);
      }
      values.push(milliseconds);
    }
    const details = Array.isArray(source.details) ? source.details : [];
    for (const detail of details) {
      const name = String(detail?.detail ?? "unknown");
      const milliseconds = detail?.latestMilliseconds;
      if (!isFiniteNumber(milliseconds)) continue;
      let values = phaseMsByName.get(name);
      if (values === undefined) {
        values = [];
        phaseMsByName.set(name, values);
      }
      values.push(milliseconds);
    }
  }

  const phases = {};
  for (const [name, values] of phaseMsByName) {
    phases[name] = quantiles(values);
  }

  return {
    totalMs: quantiles(totalMs),
    phases,
  };
}

function summarizeApertureGpuTimings(samples, latest) {
  const frameMs = [];
  const passMsByName = new Map();

  for (const sample of samples) {
    const passes = sample?.gpuTimings?.passes ?? [];
    if (!Array.isArray(passes) || passes.length === 0) continue;

    let totalMicroseconds = 0;
    for (const pass of passes) {
      if (!isFiniteNumber(pass?.microseconds)) continue;
      totalMicroseconds += pass.microseconds;
      const name = String(pass.pass ?? "unknown");
      let values = passMsByName.get(name);
      if (values === undefined) {
        values = [];
        passMsByName.set(name, values);
      }
      values.push(pass.microseconds / 1000);
    }

    if (totalMicroseconds > 0) {
      frameMs.push(totalMicroseconds / 1000);
    }
  }

  const passes = {};
  for (const [name, values] of passMsByName) {
    passes[name] = quantiles(values);
  }

  return {
    frameMs: quantiles(frameMs),
    passes,
    latest: latest?.diagnostics?.gpuTimings ?? null,
  };
}

function summarizeApertureWorkerMessages(samples, latest) {
  const snapshotDecisions = latest?.workerMessages?.snapshotDecisions;
  if (snapshotDecisions !== undefined && snapshotDecisions !== null) {
    const sidebandDecisions = latest?.workerMessages?.sidebandDecisions;
    return {
      sampleCount: snapshotDecisions.total ?? 0,
      postedMessages: snapshotDecisions.postedMessages ?? {},
      postMessageReasons: snapshotDecisions.postMessageReasons ?? {},
      latest: snapshotDecisions.latest ?? null,
      sideband:
        sidebandDecisions === undefined || sidebandDecisions === null
          ? null
          : {
              sampleCount: sidebandDecisions.total ?? 0,
              postedMessages: sidebandDecisions.postedMessages ?? {},
              postMessageReasons: sidebandDecisions.postMessageReasons ?? {},
              latest: sidebandDecisions.latest ?? null,
            },
      source: "browser-status-counter",
    };
  }

  const timings = [
    ...samples.map(
      (sample) => sample?.workerMessages?.snapshotDecisions?.latest,
    ),
    ...samples.map((sample) => sample?.workerPublish),
    latest?.lastWorkerSummary?.postMessageDecision,
    latest?.lastWorkerSummary?.previousPublishTiming,
    latest?.lastWorkerSummary?.publishTiming,
  ].filter((timing) => timing !== undefined && timing !== null);
  const postedMessages = {};
  const postMessageReasons = {};

  for (const timing of timings) {
    const postedMessage = String(timing?.postedMessage ?? "unknown");
    postedMessages[postedMessage] = (postedMessages[postedMessage] ?? 0) + 1;

    const reasons = Array.isArray(timing?.postMessageReasons)
      ? timing.postMessageReasons
      : [];
    if (reasons.length === 0) {
      postMessageReasons.none = (postMessageReasons.none ?? 0) + 1;
      continue;
    }

    for (const reason of reasons) {
      const key = String(reason);
      postMessageReasons[key] = (postMessageReasons[key] ?? 0) + 1;
    }
  }

  return {
    sampleCount: timings.length,
    postedMessages,
    postMessageReasons,
    latest: timings.at(-1) ?? null,
    source: "sampled-status",
  };
}

function summarizeThreeSamples(samples, latest) {
  if (latest === null && samples.length === 0) return null;
  const renderCalls = samples
    .map(
      (sample) =>
        sample?.renderer?.glDrawCalls?.calls ?? sample?.renderer?.render?.calls,
    )
    .filter(isFiniteNumber);
  const timings = {};
  for (const sample of samples) {
    const sampleTimings = sample?.latest?.timings ?? {};
    for (const [name, value] of Object.entries(sampleTimings)) {
      if (!isFiniteNumber(value)) continue;
      (timings[name] ??= []).push(value);
    }
  }
  const timingSummary = {};
  for (const [name, values] of Object.entries(timings)) {
    timingSummary[name] = quantiles(values);
  }

  const gpuTimerResults = [];
  for (const frame of latest?.samples ?? []) {
    for (const result of frame?.gpuTimer?.resolved ?? []) {
      if (isFiniteNumber(result?.gpuMs)) gpuTimerResults.push(result.gpuMs);
    }
  }

  return {
    latest,
    renderCalls: quantiles(renderCalls),
    timings: timingSummary,
    glCalls: summarizeThreeGlCalls(samples, latest),
    gpuTimer: {
      renderMs: quantiles(gpuTimerResults),
      latest: latest?.renderer?.gpuTimer ?? null,
    },
  };
}

function summarizeThreeGlCalls(samples, latest) {
  const glSamples = (latest?.samples ?? [])
    .map((sample) => sample?.gl)
    .filter((sample) => sample !== undefined && sample !== null);
  if (glSamples.length === 0) {
    glSamples.push(
      ...samples
        .map((sample) => sample?.renderer?.glDrawCalls)
        .filter((sample) => sample !== undefined && sample !== null),
    );
  }

  const fieldNames = [
    "calls",
    "totalCalls",
    "stateCalls",
    "drawArrays",
    "drawElements",
    "drawArraysInstanced",
    "drawElementsInstanced",
    "multiDrawArrays",
    "multiDrawElements",
  ];
  const summary = {};

  for (const field of fieldNames) {
    summary[field] = quantiles(
      glSamples.map((sample) => sample?.[field]).filter(isFiniteNumber),
    );
  }

  const methodValues = new Map();
  for (const sample of glSamples) {
    const methods = sample?.methods ?? {};
    for (const [name, value] of Object.entries(methods)) {
      if (!isFiniteNumber(value)) continue;
      let values = methodValues.get(name);
      if (values === undefined) {
        values = [];
        methodValues.set(name, values);
      }
      values.push(value);
    }
  }

  const methodSummaries = Array.from(methodValues.entries())
    .map(([name, values]) => ({ name, ...quantiles(values) }))
    .sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))
    .slice(0, 24);

  return {
    sampleCount: glSamples.length,
    diagnosticsEnabled: glSamples.some(
      (sample) => sample?.diagnosticsEnabled === true,
    ),
    ...summary,
    topMethods: methodSummaries,
  };
}

function summarizeFramePacing(intervals) {
  const cleanIntervals = intervals.filter(isFiniteNumber);
  if (cleanIntervals.length === 0) {
    return {
      expectedIntervalMs: null,
      expectedHz: null,
      absoluteDeviationMs: quantiles([]),
      adjacentDeltaMs: quantiles([]),
      standardDeviationMs: null,
      rootMeanSquareDeviationMs: null,
      withinHalfMsRatio: null,
      withinOneMsRatio: null,
      adjacentJitterOverOneMsCount: 0,
      adjacentJitterOverTwoMsCount: 0,
      longFrameCount: 0,
      longFrameRatio: null,
      veryLongFrameCount: 0,
      estimatedMissedVsyncs: 0,
    };
  }

  const intervalStats = quantiles(cleanIntervals);
  const expectedIntervalMs = intervalStats.p50;
  if (!isFiniteNumber(expectedIntervalMs) || expectedIntervalMs <= 0) {
    return {
      expectedIntervalMs: null,
      expectedHz: null,
      absoluteDeviationMs: quantiles([]),
      adjacentDeltaMs: quantiles([]),
      standardDeviationMs: null,
      rootMeanSquareDeviationMs: null,
      withinHalfMsRatio: null,
      withinOneMsRatio: null,
      adjacentJitterOverOneMsCount: 0,
      adjacentJitterOverTwoMsCount: 0,
      longFrameCount: 0,
      longFrameRatio: null,
      veryLongFrameCount: 0,
      estimatedMissedVsyncs: 0,
    };
  }

  const absoluteDeviations = cleanIntervals.map((interval) =>
    Math.abs(interval - expectedIntervalMs),
  );
  const adjacentDeltas = [];
  for (let index = 1; index < cleanIntervals.length; index += 1) {
    adjacentDeltas.push(
      Math.abs(cleanIntervals[index] - cleanIntervals[index - 1]),
    );
  }

  const withinHalfMsCount = absoluteDeviations.filter(
    (deviation) => deviation <= 0.5,
  ).length;
  const withinOneMsCount = absoluteDeviations.filter(
    (deviation) => deviation <= 1,
  ).length;
  const squaredDeviationSum = absoluteDeviations.reduce(
    (total, deviation) => total + deviation * deviation,
    0,
  );
  const signedDeviationSum = cleanIntervals.reduce(
    (total, interval) => total + (interval - expectedIntervalMs) ** 2,
    0,
  );
  const adjacentJitterOverOneMsCount = adjacentDeltas.filter(
    (delta) => delta >= 1,
  ).length;
  const adjacentJitterOverTwoMsCount = adjacentDeltas.filter(
    (delta) => delta >= 2,
  ).length;
  const longFrameThreshold = expectedIntervalMs * 1.5;
  const veryLongFrameThreshold = expectedIntervalMs * 2.5;
  const longFrameCount = cleanIntervals.filter(
    (interval) => interval >= longFrameThreshold,
  ).length;
  const veryLongFrameCount = cleanIntervals.filter(
    (interval) => interval >= veryLongFrameThreshold,
  ).length;
  const estimatedMissedVsyncs = cleanIntervals.reduce((total, interval) => {
    const displayedIntervals = Math.max(
      1,
      Math.round(interval / expectedIntervalMs),
    );
    return total + displayedIntervals - 1;
  }, 0);

  return {
    expectedIntervalMs,
    expectedHz: 1000 / expectedIntervalMs,
    absoluteDeviationMs: quantiles(absoluteDeviations),
    adjacentDeltaMs: quantiles(adjacentDeltas),
    standardDeviationMs: Math.sqrt(signedDeviationSum / cleanIntervals.length),
    rootMeanSquareDeviationMs: Math.sqrt(
      squaredDeviationSum / cleanIntervals.length,
    ),
    withinHalfMsRatio: withinHalfMsCount / cleanIntervals.length,
    withinOneMsRatio: withinOneMsCount / cleanIntervals.length,
    adjacentJitterOverOneMsCount,
    adjacentJitterOverTwoMsCount,
    longFrameCount,
    longFrameRatio: longFrameCount / cleanIntervals.length,
    veryLongFrameCount,
    estimatedMissedVsyncs,
  };
}

function compareFramePacing(runs) {
  const comparisons = [];
  const runsByTrial = new Map();

  for (const run of runs) {
    const trial = isFiniteNumber(run.trial) ? run.trial : 1;
    const key = `${run.scenario}:${trial}`;
    let trialRuns = runsByTrial.get(key);
    if (trialRuns === undefined) {
      trialRuns = {
        scenario: run.scenario,
        trial,
        targets: new Map(),
      };
      runsByTrial.set(key, trialRuns);
    }
    trialRuns.targets.set(run.target, run);
  }

  for (const trialRuns of runsByTrial.values()) {
    const aperture = trialRuns.targets.get("aperture");
    const three = trialRuns.targets.get("three");
    if (aperture === undefined || three === undefined) continue;

    comparisons.push({
      scenario: trialRuns.scenario,
      trial: trialRuns.trial,
      metrics: {
        intervalP95Ms: compareLowerIsBetter(
          aperture.raf?.intervalMs?.p95,
          three.raf?.intervalMs?.p95,
        ),
        intervalP99Ms: compareLowerIsBetter(
          aperture.raf?.intervalMs?.p99,
          three.raf?.intervalMs?.p99,
        ),
        intervalMaxMs: compareLowerIsBetter(
          aperture.raf?.intervalMs?.max,
          three.raf?.intervalMs?.max,
        ),
        absoluteDeviationP95Ms: compareLowerIsBetter(
          aperture.raf?.pacing?.absoluteDeviationMs?.p95,
          three.raf?.pacing?.absoluteDeviationMs?.p95,
        ),
        adjacentDeltaP95Ms: compareLowerIsBetter(
          aperture.raf?.pacing?.adjacentDeltaMs?.p95,
          three.raf?.pacing?.adjacentDeltaMs?.p95,
        ),
        rootMeanSquareDeviationMs: compareLowerIsBetter(
          aperture.raf?.pacing?.rootMeanSquareDeviationMs,
          three.raf?.pacing?.rootMeanSquareDeviationMs,
        ),
        withinOneMsRatio: compareHigherIsBetter(
          aperture.raf?.pacing?.withinOneMsRatio,
          three.raf?.pacing?.withinOneMsRatio,
        ),
        adjacentJitterOverTwoMsCount: compareLowerIsBetter(
          aperture.raf?.pacing?.adjacentJitterOverTwoMsCount,
          three.raf?.pacing?.adjacentJitterOverTwoMsCount,
        ),
        longFrameCount: compareLowerIsBetter(
          aperture.raf?.pacing?.longFrameCount,
          three.raf?.pacing?.longFrameCount,
        ),
        callbackP95Ms: compareLowerIsBetter(
          aperture.raf?.callbackMs?.p95,
          three.raf?.callbackMs?.p95,
        ),
      },
    });
  }

  return comparisons;
}

function aggregateFramePacingComparisons(comparisons) {
  const aggregatesByScenario = new Map();

  for (const comparison of comparisons) {
    let aggregate = aggregatesByScenario.get(comparison.scenario);
    if (aggregate === undefined) {
      aggregate = {
        scenario: comparison.scenario,
        trialCount: 0,
        metrics: new Map(),
      };
      aggregatesByScenario.set(comparison.scenario, aggregate);
    }
    aggregate.trialCount += 1;

    for (const [name, metric] of Object.entries(comparison.metrics ?? {})) {
      let metricAggregate = aggregate.metrics.get(name);
      if (metricAggregate === undefined) {
        metricAggregate = {
          deltas: [],
          apertureWins: 0,
          threeWins: 0,
          ties: 0,
        };
        aggregate.metrics.set(name, metricAggregate);
      }
      if (isFiniteNumber(metric?.delta)) {
        metricAggregate.deltas.push(metric.delta);
      }
      if (metric?.winner === "aperture") {
        metricAggregate.apertureWins += 1;
      } else if (metric?.winner === "three") {
        metricAggregate.threeWins += 1;
      } else if (metric?.winner === "tie") {
        metricAggregate.ties += 1;
      }
    }
  }

  return Array.from(aggregatesByScenario.values()).map((aggregate) => {
    const metrics = {};
    for (const [name, metric] of aggregate.metrics.entries()) {
      metrics[name] = {
        delta: quantiles(metric.deltas),
        apertureWins: metric.apertureWins,
        threeWins: metric.threeWins,
        ties: metric.ties,
        winner:
          metric.apertureWins === metric.threeWins
            ? "tie"
            : metric.apertureWins > metric.threeWins
              ? "aperture"
              : "three",
      };
    }
    return {
      scenario: aggregate.scenario,
      trialCount: aggregate.trialCount,
      metrics,
    };
  });
}

function compareLowerIsBetter(apertureValue, threeValue) {
  return compareMetric(apertureValue, threeValue, "lower");
}

function compareHigherIsBetter(apertureValue, threeValue) {
  return compareMetric(apertureValue, threeValue, "higher");
}

function compareMetric(apertureValue, threeValue, betterDirection) {
  const apertureNumber = isFiniteNumber(apertureValue) ? apertureValue : null;
  const threeNumber = isFiniteNumber(threeValue) ? threeValue : null;
  const delta =
    apertureNumber === null || threeNumber === null
      ? null
      : apertureNumber - threeNumber;
  let winner = null;
  if (delta !== null) {
    if (delta === 0) {
      winner = "tie";
    } else if (betterDirection === "lower") {
      winner = delta < 0 ? "aperture" : "three";
    } else {
      winner = delta > 0 ? "aperture" : "three";
    }
  }

  return {
    aperture: apertureNumber,
    three: threeNumber,
    delta,
    winner,
  };
}

function analyzeCpuProfile(profile) {
  const nodes = Array.isArray(profile?.nodes) ? profile.nodes : [];
  const samples = Array.isArray(profile?.samples) ? profile.samples : [];
  const timeDeltas = Array.isArray(profile?.timeDeltas)
    ? profile.timeDeltas
    : [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const selfMsById = new Map();
  const fallbackDeltaMs =
    samples.length > 0 &&
    isFiniteNumber(profile?.startTime) &&
    isFiniteNumber(profile?.endTime)
      ? Math.max(0, profile.endTime - profile.startTime) / samples.length / 1000
      : 0;

  for (let index = 0; index < samples.length; index += 1) {
    const nodeId = samples[index];
    const node = nodesById.get(nodeId);
    if (node === undefined) continue;
    const deltaMs = isFiniteNumber(timeDeltas[index])
      ? timeDeltas[index] / 1000
      : fallbackDeltaMs;
    selfMsById.set(nodeId, (selfMsById.get(nodeId) ?? 0) + deltaMs);
  }

  const entries = Array.from(selfMsById.entries())
    .map(([nodeId, selfMs]) => {
      const node = nodesById.get(nodeId);
      const callFrame = node?.callFrame ?? {};
      const url = String(callFrame.url ?? "");
      return {
        functionName: normalizeProfileFunctionName(callFrame.functionName),
        url,
        urlBucket: bucketProfileUrl(url),
        lineNumber: isFiniteNumber(callFrame.lineNumber)
          ? callFrame.lineNumber + 1
          : null,
        columnNumber: isFiniteNumber(callFrame.columnNumber)
          ? callFrame.columnNumber + 1
          : null,
        selfMs,
      };
    })
    .sort((a, b) => b.selfMs - a.selfMs);

  const bucketMs = {};
  for (const entry of entries) {
    bucketMs[entry.urlBucket] = (bucketMs[entry.urlBucket] ?? 0) + entry.selfMs;
  }

  return {
    sampleCount: samples.length,
    totalSelfMs: entries.reduce((total, entry) => total + entry.selfMs, 0),
    topSelfTime: entries.slice(0, 30),
    topAppSelfTime: entries
      .filter((entry) => entry.urlBucket !== "browser/internal")
      .slice(0, 30),
    bucketMs,
  };
}

function normalizeProfileFunctionName(value) {
  const text = String(value ?? "");
  return text.length === 0 ? "(anonymous)" : text;
}

function bucketProfileUrl(url) {
  if (url.length === 0) return "browser/internal";
  if (url.includes("/__three__/")) return "three.js";
  if (url.includes("Starter-Kit-Racing") || /\/js\/[^/?#]+\.js/.test(url)) {
    return "three-app";
  }
  if (url.includes("/assets/") || url.includes("/src/")) return "aperture-app";
  if (url.includes("localhost") || url.includes("127.0.0.1")) {
    return "local-app";
  }
  if (url.includes("extensions::") || url.includes("chrome://")) {
    return "browser/internal";
  }
  return "other";
}

async function launchTraceBrowser() {
  const preferred = createBrowserLaunchOptions(requestedBrowserChannel);
  try {
    return {
      browser: await chromium.launch(preferred.options),
      summary: {
        requestedChannel: requestedBrowserChannel,
        actualChannel: preferred.channel,
        fallback: false,
        headless: preferred.options.headless,
        args: preferred.options.args,
      },
    };
  } catch (error) {
    if (requestedBrowserChannel === "bundled") {
      throw error;
    }

    const fallback = createBrowserLaunchOptions("bundled");
    return {
      browser: await chromium.launch(fallback.options),
      summary: {
        requestedChannel: requestedBrowserChannel,
        actualChannel: fallback.channel,
        fallback: true,
        fallbackReason: String(error?.message ?? error),
        headless: fallback.options.headless,
        args: fallback.options.args,
      },
    };
  }
}

function createBrowserLaunchOptions(channel) {
  const headless = args.headed === true ? false : true;
  if (channel === "bundled") {
    return {
      channel,
      options: {
        headless,
        args: [...bundledChromiumGpuArgs, ...commonBrowserArgs],
      },
    };
  }

  return {
    channel,
    options: {
      headless,
      channel,
      args: [...commonBrowserArgs],
    },
  };
}

function printSummary(summary, summaryPath) {
  console.log(`racing render-loop trace summary: ${summaryPath}`);
  if (summary.browser?.fallback === true) {
    console.log(
      `note: requested browser channel '${summary.browser.requestedChannel}' failed; fell back to '${summary.browser.actualChannel}'.`,
    );
  }
  if (summary.apertureGpuTimings === true) {
    console.log(
      "note: --aperture-gpu-timings enables WebGPU timestamp readbacks and can distort Aperture CPU phase/cadence measurements; use a separate run without it for fair frame-time comparison.",
    );
  }
  for (const run of summary.runs) {
    const interval = run.raf.intervalMs;
    const callback = run.raf.callbackMs;
    const pacing = run.raf.pacing;
    const drawCalls =
      run.target === "three" ? run.three?.renderCalls : run.aperture?.drawCalls;
    const apertureRenderTotal = run.aperture?.phaseTimings?.totalMs;
    const gpuTimer =
      run.target === "three"
        ? run.three?.gpuTimer?.renderMs
        : run.aperture?.gpuTimings?.frameMs;
    const heapMb = run.memory
      ? (run.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)
      : "n/a";
    const parts = [
      `${run.label} ${run.scenario} trial=${run.trial ?? 1}`,
      `raf p50=${formatMs(interval.p50)} p95=${formatMs(interval.p95)} p99=${formatMs(interval.p99)} max=${formatMs(interval.max)}`,
      `pacing dev95=${formatMs(pacing?.absoluteDeviationMs?.p95)} adj95=${formatMs(pacing?.adjacentDeltaMs?.p95)} rms=${formatMs(pacing?.rootMeanSquareDeviationMs)} within1=${formatRatio(pacing?.withinOneMsRatio)} jitter2=${formatNumber(pacing?.adjacentJitterOverTwoMsCount)} missed=${formatNumber(pacing?.estimatedMissedVsyncs)}`,
      `callback p95=${formatMs(callback.p95)} max=${formatMs(callback.max)}`,
      `draw/calls p50=${formatNumber(drawCalls?.p50)} max=${formatNumber(drawCalls?.max)}`,
    ];
    if (run.target === "aperture") {
      parts.push(
        `render p50=${formatMs(apertureRenderTotal?.p50)} p95=${formatMs(apertureRenderTotal?.p95)} max=${formatMs(apertureRenderTotal?.max)}`,
      );
      const topReason = topCountKey(
        run.aperture?.workerMessages?.postMessageReasons,
      );
      if (topReason !== null) {
        parts.push(`msg top=${topReason.key}:${topReason.count}`);
      }
      const topSidebandReason = topCountKey(
        run.aperture?.workerMessages?.sideband?.postMessageReasons,
      );
      if (topSidebandReason !== null) {
        parts.push(
          `sideband top=${topSidebandReason.key}:${topSidebandReason.count}`,
        );
      }
    }
    if (run.target === "three" || (gpuTimer?.count ?? 0) > 0) {
      parts.push(
        `gpu p50=${formatMs(gpuTimer?.p50)} p95=${formatMs(gpuTimer?.p95)} max=${formatMs(gpuTimer?.max)}`,
      );
    }
    if (
      run.target === "three" &&
      (run.three?.glCalls?.stateCalls?.max ?? 0) > 0
    ) {
      parts.push(
        `gl total p50=${formatNumber(run.three.glCalls.totalCalls?.p50)} state p50=${formatNumber(run.three.glCalls.stateCalls?.p50)}`,
      );
    }
    if (run.visual?.likelyBlank === true) {
      parts.push("visual=blank-canvas");
    } else if (run.visual?.ok === false) {
      parts.push(`visual=${run.visual.reason ?? "unavailable"}`);
    }
    parts.push(`heap=${heapMb}MB`);
    console.log(parts.join(" | "));
  }
  for (const comparison of summary.framePacingComparisons ?? []) {
    const metrics = comparison.metrics ?? {};
    console.log(
      [
        `pacing comparison ${comparison.scenario} trial=${comparison.trial ?? 1}`,
        `interval95 ${formatComparison(metrics.intervalP95Ms)}`,
        `interval99 ${formatComparison(metrics.intervalP99Ms)}`,
        `dev95 ${formatComparison(metrics.absoluteDeviationP95Ms)}`,
        `adj95 ${formatComparison(metrics.adjacentDeltaP95Ms)}`,
        `rms ${formatComparison(metrics.rootMeanSquareDeviationMs)}`,
        `within1 ${formatComparison(metrics.withinOneMsRatio, { ratio: true })}`,
        `callback95 ${formatComparison(metrics.callbackP95Ms)}`,
      ].join(" | "),
    );
  }
  for (const aggregate of summary.framePacingAggregateComparisons ?? []) {
    const metrics = aggregate.metrics ?? {};
    console.log(
      [
        `pacing aggregate ${aggregate.scenario} trials=${aggregate.trialCount}`,
        `interval95 ${formatAggregateComparison(metrics.intervalP95Ms)}`,
        `dev95 ${formatAggregateComparison(metrics.absoluteDeviationP95Ms)}`,
        `adj95 ${formatAggregateComparison(metrics.adjacentDeltaP95Ms)}`,
        `rms ${formatAggregateComparison(metrics.rootMeanSquareDeviationMs)}`,
        `within1 ${formatAggregateComparison(metrics.withinOneMsRatio, { ratio: true })}`,
        `callback95 ${formatAggregateComparison(metrics.callbackP95Ms)}`,
      ].join(" | "),
    );
  }
}

function quantiles(values) {
  if (values.length === 0) {
    return {
      count: 0,
      min: null,
      p50: null,
      p95: null,
      p99: null,
      max: null,
      avg: null,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
  };
}

function percentile(sorted, p) {
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function formatMs(value) {
  return value === null || value === undefined
    ? "n/a"
    : `${value.toFixed(2)}ms`;
}

function formatNumber(value) {
  return value === null || value === undefined ? "n/a" : `${value.toFixed(1)}`;
}

function formatRatio(value) {
  return value === null || value === undefined
    ? "n/a"
    : `${(value * 100).toFixed(1)}%`;
}

function formatComparison(comparison, options = {}) {
  if (comparison === undefined || comparison === null) return "n/a";
  const formatValue = options.ratio === true ? formatRatio : formatMs;
  const aperture = formatValue(comparison.aperture);
  const three = formatValue(comparison.three);
  const delta =
    comparison.delta === null || comparison.delta === undefined
      ? "n/a"
      : options.ratio === true
        ? `${(comparison.delta * 100).toFixed(1)}pp`
        : formatSignedMs(comparison.delta);
  return `A=${aperture} T=${three} d=${delta} win=${comparison.winner ?? "n/a"}`;
}

function formatAggregateComparison(comparison, options = {}) {
  if (comparison === undefined || comparison === null) return "n/a";
  const delta = comparison.delta ?? {};
  const deltaText =
    options.ratio === true
      ? formatSignedPercentagePoint(delta.p50)
      : formatSignedMs(delta.p50);
  return `d50=${deltaText} wins A/T/tie=${comparison.apertureWins ?? 0}/${comparison.threeWins ?? 0}/${comparison.ties ?? 0} win=${comparison.winner ?? "n/a"}`;
}

function formatSignedPercentagePoint(value) {
  if (value === null || value === undefined) return "n/a";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${(value * 100).toFixed(1)}pp`;
}

function formatSignedMs(value) {
  if (value === null || value === undefined) return "n/a";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}ms`;
}

function topCountKey(counts) {
  if (counts === undefined || counts === null) return null;
  let best = null;
  for (const [key, count] of Object.entries(counts)) {
    if (!isFiniteNumber(count)) continue;
    if (best === null || count > best.count) {
      best = { key, count };
    }
  }
  return best;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function createFrameSamplerInitScript() {
  return `
(() => {
  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const samples = [];
  const statusSamples = [];
  const maxSamples = 2400;
  let lastTimestamp = null;
  let probeGeneration = 0;

  function compactApertureStatus(status) {
    if (status === undefined || status === null) return null;
    const diagnostics = status.diagnostics ?? null;
    const lastFrame =
      diagnostics?.lastFrame ??
      diagnostics?.frame ??
      status.render?.lastFrame ??
      null;
    return {
      frame: status.frame ?? status.lastFrame ?? null,
      status: status.status ?? null,
      webgpuOk: status.webgpuOk ?? null,
      performance: status.performance?.latest ?? status.performance ?? null,
      cadence: diagnostics?.cadence ?? null,
      workerMessages: status.workerMessages ?? null,
      counts: lastFrame?.counts ?? diagnostics?.counts ?? null,
      changeSet:
        lastFrame?.changeSet ??
        lastFrame?.renderChangeSet ??
        diagnostics?.changeSet ??
        null,
      phaseTimings: lastFrame?.phaseTimings ?? diagnostics?.phaseTimings ?? null,
      gpuTimings: lastFrame?.gpuTimings ?? diagnostics?.gpuTimings ?? null,
      workerPublish:
        status.lastWorkerSummary?.previousPublishTiming ??
        status.lastWorkerSummary?.publishTiming ??
        null
    };
  }

  function compactThreeStatus(status) {
    if (status === undefined || status === null) return null;
    return {
      frame: status.frame ?? null,
      latest: status.latest ?? null,
      renderer: status.renderer ?? null,
      scene: status.scene ?? null
    };
  }

  function pushBounded(list, value) {
    list.push(value);
    if (list.length > maxSamples) list.shift();
  }

  function scheduleFrameProbe() {
    const generation = probeGeneration;
    originalRequestAnimationFrame((timestamp) => sampleFrame(timestamp, generation));
  }

  function sampleFrame(timestamp, generation) {
    if (generation !== probeGeneration) return;
    const intervalMs = lastTimestamp === null ? null : timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    pushBounded(samples, {
      kind: "probe",
      timestamp,
      intervalMs,
      callbackMs: null,
      endedAt: performance.now()
    });
    scheduleFrameProbe();
  }

  window.requestAnimationFrame = function requestAnimationFrameWithTrace(callback) {
    return originalRequestAnimationFrame((timestamp) => {
      const startedAt = performance.now();
      try {
        return callback(timestamp);
      } finally {
        const endedAt = performance.now();
        pushBounded(samples, {
          kind: "callback",
          timestamp,
          intervalMs: null,
          callbackMs: endedAt - startedAt,
          endedAt
        });
      }
    });
  };

  function sampleStatus() {
    pushBounded(statusSamples, {
      timestamp: performance.now(),
      aperture: compactApertureStatus(
        window.__APERTURE_EXAMPLE_STATUS__ ??
          window.__APERTURE_GENERATED_APP__
      ),
      three: compactThreeStatus(window.__THREE_RACING_STATUS__)
    });
  }

  scheduleFrameProbe();
  setInterval(sampleStatus, 250);
  sampleStatus();

  window.__RACING_TRACE_RAF__ = {
    clear() {
      samples.length = 0;
      statusSamples.length = 0;
      lastTimestamp = null;
      probeGeneration ++;
      scheduleFrameProbe();
      sampleStatus();
    },
    snapshot() {
      return {
        samples: samples.slice(),
        statusSamples: statusSamples.slice()
      };
    }
  };
})();
`;
}

function transformThreeIndex(source) {
  return source
    .replace(
      '"three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js"',
      '"three": "/__three__/build/three.module.js"',
    )
    .replace(
      '"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/"',
      '"three/addons/": "/__three__/examples/jsm/"',
    );
}

function instrumentThreeMain(source) {
  let output = source;
  const rendererNeedle = "const renderer = new THREE.WebGLRenderer";
  if (!output.includes("__THREE_RACING_STATUS__")) {
    output = output.replace(
      rendererNeedle,
      `${threePerfPrelude()}\n${rendererNeedle}`,
    );
  }

  const timerNeedle = "\tconst timer = new THREE.Timer();\n";
  if (!output.includes("installThreeRacingPerfControl")) {
    throw new Error(
      "three.js main instrumentation prelude did not install correctly.",
    );
  }
  output = output.replace(
    "const renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );\n",
    "const renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );\ninstallThreeRacingGlDrawCounter( renderer, new URLSearchParams( location.search ).has( 'glDiagnostics' ) );\ninstallThreeRacingGpuTimer( renderer );\n",
  );
  if (!output.includes("installThreeRacingGlDrawCounter( renderer")) {
    throw new Error("Could not install three.js WebGL draw-call counter.");
  }
  if (!output.includes("installThreeRacingGpuTimer( renderer );")) {
    throw new Error("Could not install three.js WebGL GPU timer.");
  }
  output = output.replace(
    timerNeedle,
    `${timerNeedle}\n\tinstallThreeRacingPerfControl( controls, vehicle );\n\tconst threeRacingSceneStats = collectThreeRacingSceneStats( scene );\n\twriteThreeRacingPerfStatus( null, renderer, threeRacingSceneStats );\n`,
  );

  const originalAnimate = `\tfunction animate() {

\t\trequestAnimationFrame( animate );

\t\ttimer.update();
\t\tconst dt = Math.min( timer.getDelta(), 1 / 30 );

\t\tconst input = controls.update();

\t\tupdateWorld( world, contactListener, dt );

\t\tvehicle.update( dt, input );

\t\tdirLight.position.set(
\t\t\tvehicle.spherePos.x + 11.4,
\t\t\t15,
\t\t\tvehicle.spherePos.z - 5.3
\t\t);

\t\tconst mv = vehicle.modelVelocity;
\t\t_camLead.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion ).multiplyScalar( Math.sqrt( mv.x * mv.x + mv.z * mv.z ) );
\t\tcam.update( dt, vehicle.spherePos, _camLead );
\t\tparticles.update( dt, vehicle );
\t\tdriftMarks.update( dt, vehicle );
\t\taudio.update( dt, vehicle.linearSpeed / MAX_SPEED, input.z, vehicle.driftIntensity );

\t\tconst hasInput = input.touchActive || Math.abs( input.x ) > 0.05 || Math.abs( input.z ) > 0.05;
\t\tlapTimer.update( dt, vehicle.spherePos, hasInput );

\t\trenderer.render( scene, cam.camera );

\t}
`;

  const instrumentedAnimate = `\tfunction animate() {

\t\trequestAnimationFrame( animate );

\t\tconst frameStart = beginThreeRacingPerfSection( 'frame' );
\t\tconst timings = {};

\t\tlet sectionStart = beginThreeRacingPerfSection( 'timer' );
\t\ttimer.update();
\t\tconst dt = Math.min( timer.getDelta(), 1 / 30 );
\t\ttimings.timer = endThreeRacingPerfSection( 'timer', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'controls' );
\t\tconst input = controls.update();
\t\ttimings.controls = endThreeRacingPerfSection( 'controls', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'physics' );
\t\tupdateWorld( world, contactListener, dt );
\t\ttimings.physics = endThreeRacingPerfSection( 'physics', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'vehicle' );
\t\tvehicle.update( dt, input );
\t\ttimings.vehicle = endThreeRacingPerfSection( 'vehicle', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'lighting' );
\t\tdirLight.position.set(
\t\t\tvehicle.spherePos.x + 11.4,
\t\t\t15,
\t\t\tvehicle.spherePos.z - 5.3
\t\t);
\t\ttimings.lighting = endThreeRacingPerfSection( 'lighting', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'camera' );
\t\tconst mv = vehicle.modelVelocity;
\t\t_camLead.set( 0, 0, 1 ).applyQuaternion( vehicle.container.quaternion ).multiplyScalar( Math.sqrt( mv.x * mv.x + mv.z * mv.z ) );
\t\tcam.update( dt, vehicle.spherePos, _camLead );
\t\ttimings.camera = endThreeRacingPerfSection( 'camera', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'particles' );
\t\tparticles.update( dt, vehicle );
\t\ttimings.particles = endThreeRacingPerfSection( 'particles', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'driftMarks' );
\t\tdriftMarks.update( dt, vehicle );
\t\ttimings.driftMarks = endThreeRacingPerfSection( 'driftMarks', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'audio' );
\t\taudio.update( dt, vehicle.linearSpeed / MAX_SPEED, input.z, vehicle.driftIntensity );
\t\ttimings.audio = endThreeRacingPerfSection( 'audio', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'lapTimer' );
\t\tconst hasInput = input.touchActive || Math.abs( input.x ) > 0.05 || Math.abs( input.z ) > 0.05;
\t\tlapTimer.update( dt, vehicle.spherePos, hasInput );
\t\ttimings.lapTimer = endThreeRacingPerfSection( 'lapTimer', sectionStart );

\t\tsectionStart = beginThreeRacingPerfSection( 'render' );
\t\tresetThreeRacingGlDrawCounter();
\t\tconst gpuTimerQuery = beginThreeRacingGpuTimer( threeRacingPerfState.frame + 1 );
\t\trenderer.render( scene, cam.camera );
\t\tconst gpuTimer = endThreeRacingGpuTimer( gpuTimerQuery, threeRacingPerfState.frame + 1 );
\t\ttimings.render = endThreeRacingPerfSection( 'render', sectionStart );

\t\tconst frameMs = endThreeRacingPerfSection( 'frame', frameStart );
\t\tpushThreeRacingPerfFrame( {
\t\t\tdt,
\t\t\tframeMs,
\t\t\ttimings,
\t\t\tinput: { x: input.x, z: input.z, touchActive: input.touchActive === true },
\t\t\tspeed: vehicle.linearSpeed,
\t\t\tdriftIntensity: vehicle.driftIntensity,
\t\t\tgpuTimer,
\t\t\tgl: snapshotThreeRacingGlCounter(),
\t\t\tparticles: particles.lastStats ?? null,
\t\t\tvehiclePosition: {
\t\t\t\tx: vehicle.spherePos.x,
\t\t\t\ty: vehicle.spherePos.y,
\t\t\t\tz: vehicle.spherePos.z
\t\t\t}
\t\t}, renderer, threeRacingSceneStats );

\t}
`;

  if (!output.includes(originalAnimate)) {
    throw new Error(
      "Could not find Starter-Kit-Racing animate loop for instrumentation.",
    );
  }

  return output.replace(originalAnimate, instrumentedAnimate);
}

function threePerfPrelude() {
  return `const THREE_RACING_PERF_SAMPLE_LIMIT = 1800;
const threeRacingPerfState = {
\tready: false,
\tframe: 0,
\tstartedAt: performance.now(),
\tsamples: [],
\tlatest: null,
\trenderer: null,
\tscene: null,
};

function beginThreeRacingPerfSection( name ) {

\tconst markName = \`three.racing.\${ name }.start\`;
\tperformance.mark( markName );
\treturn performance.now();

}

function endThreeRacingPerfSection( name, start ) {

\tconst duration = performance.now() - start;
\tconst endMarkName = \`three.racing.\${ name }.end\`;
\tperformance.mark( endMarkName );
\tperformance.measure( \`three.racing.\${ name }\`, \`three.racing.\${ name }.start\`, endMarkName );
\treturn duration;

}

function cloneThreeRacingRendererInfo( renderer ) {

\tconst info = renderer.info;
\tconst size = new THREE.Vector2();
\trenderer.getSize( size );
\treturn {
\t\tglDrawCalls: globalThis.__THREE_RACING_GL_DRAW_COUNTER__?.snapshot?.() ?? null,
\t\tgpuTimer: globalThis.__THREE_RACING_GPU_TIMER__?.snapshot?.() ?? null,
\t\trender: {
\t\t\tcalls: info.render.calls,
\t\t\ttriangles: info.render.triangles,
\t\t\tpoints: info.render.points,
\t\t\tlines: info.render.lines,
\t\t\tframe: info.render.frame,
\t\t},
\t\tmemory: {
\t\t\tgeometries: info.memory.geometries,
\t\t\ttextures: info.memory.textures,
\t\t},
\t\tprograms: Array.isArray( info.programs ) ? info.programs.length : null,
\t\tpixelRatio: renderer.getPixelRatio(),
\t\tsize: { width: size.x, height: size.y },
\t\tshadowMap: {
\t\t\tenabled: renderer.shadowMap.enabled,
\t\t\ttype: renderer.shadowMap.type,
\t\t},
\t};

}

function collectThreeRacingSceneStats( scene ) {

\tconst materials = new Set();
\tconst geometries = new Set();
\tconst stats = {
\t\tobjects: 0,
\t\tmeshes: 0,
\t\tinstancedMeshes: 0,
\t\tinstancedMeshInstances: 0,
\t\tpointsObjects: 0,
\t\tlights: 0,
\t\tcameras: 0,
\t\tshadowCasters: 0,
\t\tshadowReceivers: 0,
\t\tmaterials: 0,
\t\tgeometries: 0,
\t};

\tscene.traverse( ( object ) => {

\t\tstats.objects ++;
\t\tif ( object.isMesh ) stats.meshes ++;
\t\tif ( object.isInstancedMesh ) {
\t\t\tstats.instancedMeshes ++;
\t\t\tstats.instancedMeshInstances += object.count ?? 0;
\t\t}
\t\tif ( object.isPoints ) stats.pointsObjects ++;
\t\tif ( object.isLight ) stats.lights ++;
\t\tif ( object.isCamera ) stats.cameras ++;
\t\tif ( object.castShadow ) stats.shadowCasters ++;
\t\tif ( object.receiveShadow ) stats.shadowReceivers ++;
\t\tif ( object.geometry?.id !== undefined ) geometries.add( object.geometry.id );

\t\tconst material = object.material;
\t\tif ( Array.isArray( material ) ) {
\t\t\tfor ( const item of material ) {
\t\t\t\tif ( item?.id !== undefined ) materials.add( item.id );
\t\t\t}
\t\t} else if ( material?.id !== undefined ) {
\t\t\tmaterials.add( material.id );
\t\t}

\t} );

\tstats.materials = materials.size;
\tstats.geometries = geometries.size;
\treturn stats;

}

function writeThreeRacingPerfStatus( latest, renderer, sceneStats ) {

\tthreeRacingPerfState.ready = true;
\tthreeRacingPerfState.latest = latest;
\tthreeRacingPerfState.renderer = cloneThreeRacingRendererInfo( renderer );
\tthreeRacingPerfState.scene = sceneStats;
\tglobalThis.__THREE_RACING_STATUS__ = {
\t\tready: true,
\t\tframe: threeRacingPerfState.frame,
\t\tstartedAt: threeRacingPerfState.startedAt,
\t\telapsedMs: performance.now() - threeRacingPerfState.startedAt,
\t\tlatest: threeRacingPerfState.latest,
\t\trenderer: threeRacingPerfState.renderer,
\t\tscene: threeRacingPerfState.scene,
\t\tsamples: threeRacingPerfState.samples,
\t};

}

function pushThreeRacingPerfFrame( latest, renderer, sceneStats ) {

\tthreeRacingPerfState.frame ++;
\tthreeRacingPerfState.samples.push( {
\t\tframe: threeRacingPerfState.frame,
\t\tat: performance.now(),
\t\t...latest,
\t} );
\tif ( threeRacingPerfState.samples.length > THREE_RACING_PERF_SAMPLE_LIMIT ) {
\t\tthreeRacingPerfState.samples.shift();
\t}

\tif ( threeRacingPerfState.frame % 240 === 0 ) {
\t\tperformance.clearMarks();
\t\tperformance.clearMeasures();
\t}

\twriteThreeRacingPerfStatus( latest, renderer, sceneStats );

}

function resetThreeRacingPerfSamples() {

\tthreeRacingPerfState.frame = 0;
\tthreeRacingPerfState.startedAt = performance.now();
\tthreeRacingPerfState.samples.length = 0;
\tthreeRacingPerfState.latest = null;
\tglobalThis.__THREE_RACING_GL_DRAW_COUNTER__?.reset?.();
\tglobalThis.__THREE_RACING_GPU_TIMER__?.reset?.();

}

function installThreeRacingGlDrawCounter( renderer, deepDiagnostics = false ) {

\tconst gl = renderer.getContext?.();
\tconst counter = {
\t\tdiagnosticsEnabled: deepDiagnostics === true,
\t\ttotalCalls: 0,
\t\tcalls: 0,
\t\tdrawArrays: 0,
\t\tdrawElements: 0,
\t\tdrawArraysInstanced: 0,
\t\tdrawElementsInstanced: 0,
\t\tmultiDrawArrays: 0,
\t\tmultiDrawElements: 0,
\t\tmethods: Object.create( null ),
\t\treset() {
\t\t\tthis.totalCalls = 0;
\t\t\tthis.calls = 0;
\t\t\tthis.drawArrays = 0;
\t\t\tthis.drawElements = 0;
\t\t\tthis.drawArraysInstanced = 0;
\t\t\tthis.drawElementsInstanced = 0;
\t\t\tthis.multiDrawArrays = 0;
\t\t\tthis.multiDrawElements = 0;
\t\t\tthis.methods = Object.create( null );
\t\t},
\t\tsnapshot() {
\t\t\treturn {
\t\t\t\tdiagnosticsEnabled: this.diagnosticsEnabled,
\t\t\t\ttotalCalls: this.totalCalls,
\t\t\t\tcalls: this.calls,
\t\t\t\tstateCalls: Math.max( 0, this.totalCalls - this.calls ),
\t\t\t\tdrawArrays: this.drawArrays,
\t\t\t\tdrawElements: this.drawElements,
\t\t\t\tdrawArraysInstanced: this.drawArraysInstanced,
\t\t\t\tdrawElementsInstanced: this.drawElementsInstanced,
\t\t\t\tmultiDrawArrays: this.multiDrawArrays,
\t\t\t\tmultiDrawElements: this.multiDrawElements,
\t\t\t\tmethods: { ...this.methods },
\t\t\t};
\t\t},
\t};

\tfunction increment( method, field ) {

\t\tcounter.totalCalls ++;
\t\tcounter.methods[ method ] = ( counter.methods[ method ] ?? 0 ) + 1;
\t\tif ( field !== null && field !== undefined ) {
\t\t\tcounter.calls ++;
\t\t\tcounter[ field ] ++;
\t\t}

\t}

\tfunction wrap( target, method, field ) {

\t\tif ( target === null || target === undefined || typeof target[ method ] !== 'function' ) return;
\t\tconst original = target[ method ].bind( target );
\t\ttarget[ method ] = ( ...args ) => {

\t\t\tincrement( method, field );
\t\t\treturn original( ...args );

\t\t};

\t}

\twrap( gl, 'drawArrays', 'drawArrays' );
\twrap( gl, 'drawElements', 'drawElements' );
\twrap( gl, 'drawArraysInstanced', 'drawArraysInstanced' );
\twrap( gl, 'drawElementsInstanced', 'drawElementsInstanced' );

\tconst angleInstanced = gl?.getExtension?.( 'ANGLE_instanced_arrays' );
\twrap( angleInstanced, 'drawArraysInstancedANGLE', 'drawArraysInstanced' );
\twrap( angleInstanced, 'drawElementsInstancedANGLE', 'drawElementsInstanced' );

\tconst multiDraw = gl?.getExtension?.( 'WEBGL_multi_draw' );
\twrap( multiDraw, 'multiDrawArraysWEBGL', 'multiDrawArrays' );
\twrap( multiDraw, 'multiDrawElementsWEBGL', 'multiDrawElements' );
\twrap( multiDraw, 'multiDrawArraysInstancedWEBGL', 'multiDrawArrays' );
\twrap( multiDraw, 'multiDrawElementsInstancedWEBGL', 'multiDrawElements' );

\tif ( deepDiagnostics === true ) {
\t\tfor ( const method of [
\t\t\t'activeTexture',
\t\t\t'attachShader',
\t\t\t'bindAttribLocation',
\t\t\t'bindBuffer',
\t\t\t'bindBufferBase',
\t\t\t'bindBufferRange',
\t\t\t'bindFramebuffer',
\t\t\t'bindRenderbuffer',
\t\t\t'bindSampler',
\t\t\t'bindTexture',
\t\t\t'bindVertexArray',
\t\t\t'blendColor',
\t\t\t'blendEquation',
\t\t\t'blendEquationSeparate',
\t\t\t'blendFunc',
\t\t\t'blendFuncSeparate',
\t\t\t'bufferData',
\t\t\t'bufferSubData',
\t\t\t'clear',
\t\t\t'clearColor',
\t\t\t'clearDepth',
\t\t\t'clearStencil',
\t\t\t'colorMask',
\t\t\t'compileShader',
\t\t\t'compressedTexImage2D',
\t\t\t'compressedTexSubImage2D',
\t\t\t'copyTexImage2D',
\t\t\t'copyTexSubImage2D',
\t\t\t'cullFace',
\t\t\t'depthFunc',
\t\t\t'depthMask',
\t\t\t'depthRange',
\t\t\t'disable',
\t\t\t'disableVertexAttribArray',
\t\t\t'enable',
\t\t\t'enableVertexAttribArray',
\t\t\t'framebufferRenderbuffer',
\t\t\t'framebufferTexture2D',
\t\t\t'frontFace',
\t\t\t'generateMipmap',
\t\t\t'linkProgram',
\t\t\t'pixelStorei',
\t\t\t'polygonOffset',
\t\t\t'renderbufferStorage',
\t\t\t'samplerParameteri',
\t\t\t'scissor',
\t\t\t'stencilFunc',
\t\t\t'stencilFuncSeparate',
\t\t\t'stencilMask',
\t\t\t'stencilMaskSeparate',
\t\t\t'stencilOp',
\t\t\t'stencilOpSeparate',
\t\t\t'texImage2D',
\t\t\t'texImage3D',
\t\t\t'texParameteri',
\t\t\t'texParameterf',
\t\t\t'texStorage2D',
\t\t\t'texStorage3D',
\t\t\t'texSubImage2D',
\t\t\t'texSubImage3D',
\t\t\t'uniform1f',
\t\t\t'uniform1fv',
\t\t\t'uniform1i',
\t\t\t'uniform1iv',
\t\t\t'uniform1ui',
\t\t\t'uniform1uiv',
\t\t\t'uniform2f',
\t\t\t'uniform2fv',
\t\t\t'uniform2i',
\t\t\t'uniform2iv',
\t\t\t'uniform2ui',
\t\t\t'uniform2uiv',
\t\t\t'uniform3f',
\t\t\t'uniform3fv',
\t\t\t'uniform3i',
\t\t\t'uniform3iv',
\t\t\t'uniform3ui',
\t\t\t'uniform3uiv',
\t\t\t'uniform4f',
\t\t\t'uniform4fv',
\t\t\t'uniform4i',
\t\t\t'uniform4iv',
\t\t\t'uniform4ui',
\t\t\t'uniform4uiv',
\t\t\t'uniformMatrix2fv',
\t\t\t'uniformMatrix2x3fv',
\t\t\t'uniformMatrix2x4fv',
\t\t\t'uniformMatrix3fv',
\t\t\t'uniformMatrix3x2fv',
\t\t\t'uniformMatrix3x4fv',
\t\t\t'uniformMatrix4fv',
\t\t\t'uniformMatrix4x2fv',
\t\t\t'uniformMatrix4x3fv',
\t\t\t'useProgram',
\t\t\t'vertexAttrib1f',
\t\t\t'vertexAttrib2f',
\t\t\t'vertexAttrib3f',
\t\t\t'vertexAttrib4f',
\t\t\t'vertexAttribDivisor',
\t\t\t'vertexAttribPointer',
\t\t\t'viewport',
\t\t] ) {
\t\t\twrap( gl, method, null );
\t\t}
\t}

\tglobalThis.__THREE_RACING_GL_DRAW_COUNTER__ = counter;
\treturn counter;

}

function snapshotThreeRacingGlCounter() {

\treturn globalThis.__THREE_RACING_GL_DRAW_COUNTER__?.snapshot?.() ?? null;

}

function resetThreeRacingGlDrawCounter() {

\tglobalThis.__THREE_RACING_GL_DRAW_COUNTER__?.reset?.();

}

function installThreeRacingGpuTimer( renderer ) {

\tconst gl = renderer.getContext?.();
\tconst ext = gl?.getExtension?.( 'EXT_disjoint_timer_query_webgl2' ) ?? gl?.getExtension?.( 'EXT_disjoint_timer_query' );
\tconst usesCoreQuery = typeof gl?.createQuery === 'function' && typeof gl?.beginQuery === 'function';
\tconst canMeasure = gl !== undefined && ext !== null && ext !== undefined;
\tconst state = {
\t\tavailable: canMeasure,
\t\textension: canMeasure ? ( usesCoreQuery ? 'EXT_disjoint_timer_query_webgl2' : 'EXT_disjoint_timer_query' ) : null,
\t\tsubmitted: 0,
\t\tresolved: 0,
\t\tdisjoint: 0,
\t\tdropped: 0,
\t\tpending: [],
\t\tlatest: null,
\t\terrors: [],
\t\tmaxPending: 24,
\t};

\tfunction pushError( error ) {

\t\tif ( state.errors.length < 8 ) {
\t\t\tstate.errors.push( String( error?.message ?? error ) );
\t\t}

\t}

\tfunction deleteQuery( query ) {

\t\ttry {
\t\t\tif ( usesCoreQuery ) {
\t\t\t\tgl.deleteQuery( query );
\t\t\t} else {
\t\t\t\text.deleteQueryEXT( query );
\t\t\t}
\t\t} catch ( error ) {
\t\t\tpushError( error );
\t\t}

\t}

\tfunction createQuery() {

\t\treturn usesCoreQuery ? gl.createQuery() : ext.createQueryEXT();

\t}

\tfunction beginQuery( query ) {

\t\tif ( usesCoreQuery ) {
\t\t\tgl.beginQuery( ext.TIME_ELAPSED_EXT, query );
\t\t} else {
\t\t\text.beginQueryEXT( ext.TIME_ELAPSED_EXT, query );
\t\t}

\t}

\tfunction endQuery() {

\t\tif ( usesCoreQuery ) {
\t\t\tgl.endQuery( ext.TIME_ELAPSED_EXT );
\t\t} else {
\t\t\text.endQueryEXT( ext.TIME_ELAPSED_EXT );
\t\t}

\t}

\tfunction isQueryAvailable( query ) {

\t\treturn usesCoreQuery
\t\t\t? gl.getQueryParameter( query, gl.QUERY_RESULT_AVAILABLE )
\t\t\t: ext.getQueryObjectEXT( query, ext.QUERY_RESULT_AVAILABLE_EXT );

\t}

\tfunction readQueryNanoseconds( query ) {

\t\treturn usesCoreQuery
\t\t\t? gl.getQueryParameter( query, gl.QUERY_RESULT )
\t\t\t: ext.getQueryObjectEXT( query, ext.QUERY_RESULT_EXT );

\t}

\tfunction poll( currentFrame ) {

\t\tif ( ! state.available ) return [];
\t\tconst resolved = [];
\t\tconst gpuDisjoint = gl.getParameter( ext.GPU_DISJOINT_EXT ) === true;
\t\tif ( gpuDisjoint ) {
\t\t\tfor ( const pending of state.pending ) {
\t\t\t\tdeleteQuery( pending.query );
\t\t\t}
\t\t\tstate.disjoint += state.pending.length;
\t\t\tstate.pending.length = 0;
\t\t\treturn resolved;
\t\t}

\t\tlet writeIndex = 0;
\t\tfor ( const pending of state.pending ) {
\t\t\tlet available = false;
\t\t\ttry {
\t\t\t\tavailable = isQueryAvailable( pending.query ) === true;
\t\t\t} catch ( error ) {
\t\t\t\tpushError( error );
\t\t\t\tstate.dropped ++;
\t\t\t\tdeleteQuery( pending.query );
\t\t\t\tcontinue;
\t\t\t}

\t\t\tif ( ! available ) {
\t\t\t\tstate.pending[ writeIndex ++ ] = pending;
\t\t\t\tcontinue;
\t\t\t}

\t\t\ttry {
\t\t\t\tconst gpuMs = Number( readQueryNanoseconds( pending.query ) ) / 1000000;
\t\t\t\tconst result = {
\t\t\t\t\tframe: pending.frame,
\t\t\t\t\tresolvedAtFrame: currentFrame,
\t\t\t\t\tlatencyFrames: Number.isFinite( currentFrame ) ? currentFrame - pending.frame : null,
\t\t\t\t\tresolveDelayMs: performance.now() - pending.submittedAt,
\t\t\t\t\tgpuMs,
\t\t\t\t};
\t\t\t\tstate.latest = result;
\t\t\t\tstate.resolved ++;
\t\t\t\tresolved.push( result );
\t\t\t} catch ( error ) {
\t\t\t\tpushError( error );
\t\t\t\tstate.dropped ++;
\t\t\t} finally {
\t\t\t\tdeleteQuery( pending.query );
\t\t\t}
\t\t}
\t\tstate.pending.length = writeIndex;
\t\treturn resolved;

\t}

\tconst timer = {
\t\tbegin( frame ) {
\t\t\tconst resolved = poll( frame );
\t\t\tif ( ! state.available ) return { query: null, started: false, resolved };
\t\t\twhile ( state.pending.length >= state.maxPending ) {
\t\t\t\tconst stale = state.pending.shift();
\t\t\t\tif ( stale !== undefined ) {
\t\t\t\t\tdeleteQuery( stale.query );
\t\t\t\t\tstate.dropped ++;
\t\t\t\t}
\t\t\t}
\t\t\ttry {
\t\t\t\tconst query = createQuery();
\t\t\t\tbeginQuery( query );
\t\t\t\treturn { query, started: true, resolved };
\t\t\t} catch ( error ) {
\t\t\t\tpushError( error );
\t\t\t\treturn { query: null, started: false, resolved };
\t\t\t}
\t\t},
\t\tend( handle, frame ) {
\t\t\tconst resolved = [ ...( handle?.resolved ?? [] ) ];
\t\t\tlet submitted = false;
\t\t\tif ( handle?.query !== null && handle?.query !== undefined ) {
\t\t\t\ttry {
\t\t\t\t\tendQuery();
\t\t\t\t\tstate.submitted ++;
\t\t\t\t\tsubmitted = true;
\t\t\t\t\tstate.pending.push( {
\t\t\t\t\t\tquery: handle.query,
\t\t\t\t\t\tframe,
\t\t\t\t\t\tsubmittedAt: performance.now(),
\t\t\t\t\t} );
\t\t\t\t} catch ( error ) {
\t\t\t\t\tpushError( error );
\t\t\t\t\tdeleteQuery( handle.query );
\t\t\t\t}
\t\t\t}
\t\t\tresolved.push( ...poll( frame ) );
\t\t\treturn {
\t\t\t\tavailable: state.available,
\t\t\t\textension: state.extension,
\t\t\t\tsubmitted,
\t\t\t\tpending: state.pending.length,
\t\t\t\tresolved,
\t\t\t\tlatest: state.latest,
\t\t\t\tdisjoint: state.disjoint,
\t\t\t\tdropped: state.dropped,
\t\t\t\terrors: state.errors.slice(),
\t\t\t};
\t\t},
\t\tsnapshot() {
\t\t\treturn {
\t\t\t\tavailable: state.available,
\t\t\t\textension: state.extension,
\t\t\t\tsubmitted: state.submitted,
\t\t\t\tresolved: state.resolved,
\t\t\t\tpending: state.pending.length,
\t\t\t\tdisjoint: state.disjoint,
\t\t\t\tdropped: state.dropped,
\t\t\t\tlatest: state.latest,
\t\t\t\terrors: state.errors.slice(),
\t\t\t};
\t\t},
\t\treset() {
\t\t\tfor ( const pending of state.pending ) {
\t\t\t\tdeleteQuery( pending.query );
\t\t\t}
\t\t\tstate.submitted = 0;
\t\t\tstate.resolved = 0;
\t\t\tstate.disjoint = 0;
\t\t\tstate.dropped = 0;
\t\t\tstate.pending.length = 0;
\t\t\tstate.latest = null;
\t\t\tstate.errors.length = 0;
\t\t},
\t};

\tglobalThis.__THREE_RACING_GPU_TIMER__ = timer;
\treturn timer;

}

function beginThreeRacingGpuTimer( frame ) {

\treturn globalThis.__THREE_RACING_GPU_TIMER__?.begin?.( frame ) ?? { query: null, started: false, resolved: [] };

}

function endThreeRacingGpuTimer( handle, frame ) {

\treturn globalThis.__THREE_RACING_GPU_TIMER__?.end?.( handle, frame ) ?? {
\t\tavailable: false,
\t\textension: null,
\t\tsubmitted: false,
\t\tpending: 0,
\t\tresolved: [],
\t\tlatest: null,
\t\tdisjoint: 0,
\t\tdropped: 0,
\t\terrors: [],
\t};

}

function installThreeRacingPerfControl( controls, vehicle ) {

\tglobalThis.__THREE_RACING_CONTROL__ = {
\t\tsetDrive( input = {} ) {
\t\t\tconst x = Number.isFinite( input.x ) ? input.x : 0;
\t\t\tconst z = Number.isFinite( input.z ) ? input.z : 0;
\t\t\tcontrols.keys.KeyA = x < - 0.05;
\t\t\tcontrols.keys.KeyD = x > 0.05;
\t\t\tcontrols.keys.ArrowLeft = controls.keys.KeyA;
\t\t\tcontrols.keys.ArrowRight = controls.keys.KeyD;
\t\t\tcontrols.keys.KeyW = z > 0.05;
\t\t\tcontrols.keys.KeyS = z < - 0.05;
\t\t\tcontrols.keys.ArrowUp = controls.keys.KeyW;
\t\t\tcontrols.keys.ArrowDown = controls.keys.KeyS;
\t\t},
\t\tclearInput() {
\t\t\tfor ( const code of [ 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ] ) {
\t\t\t\tcontrols.keys[ code ] = false;
\t\t\t}
\t\t},
\t\tgetStatus() {
\t\t\treturn globalThis.__THREE_RACING_STATUS__ ?? null;
\t\t},
\t\tclearPerfSamples() {
\t\t\tresetThreeRacingPerfSamples();
\t\t},
\t\tgetVehicle() {
\t\t\treturn {
\t\t\t\tspeed: vehicle.linearSpeed,
\t\t\t\tdriftIntensity: vehicle.driftIntensity,
\t\t\t\tposition: {
\t\t\t\t\tx: vehicle.spherePos.x,
\t\t\t\t\ty: vehicle.spherePos.y,
\t\t\t\t\tz: vehicle.spherePos.z,
\t\t\t\t},
\t\t\t};
\t\t},
\t};

}

`;
}

function instrumentThreeParticles(source) {
  let output = source;
  output = output.replace(
    "\t\tthis.emitIndex = 0;\n",
    `\t\tthis.emitIndex = 0;
\t\tthis.lastStats = {
\t\t\taliveCount: 0,
\t\t\temitCount: 0,
\t\t\tshouldEmit: false,
\t\t\tuploaded: false,
\t\t\tpoolSize: POOL_SIZE,
\t\t};
`,
  );
  output = output.replace(
    "\t\tlet aliveCount = 0;\n",
    "\t\tlet aliveCount = 0;\n\t\tlet emitCount = 0;\n",
  );
  output = output.replace(
    "\t\t\t\tif ( bl ) this.emitAt( bl.x, roadY, bl.z );\n\t\t\t\tif ( br ) this.emitAt( br.x, roadY, br.z );\n",
    `\t\t\t\tif ( bl ) {
\t\t\t\t\tthis.emitAt( bl.x, roadY, bl.z );
\t\t\t\t\temitCount ++;
\t\t\t\t}
\t\t\t\tif ( br ) {
\t\t\t\t\tthis.emitAt( br.x, roadY, br.z );
\t\t\t\t\temitCount ++;
\t\t\t\t}
`,
  );
  output = output.replace(
    "\t\tif ( shouldEmit || aliveCount > 0 ) {\n",
    `\t\tconst uploaded = shouldEmit || aliveCount > 0;
\t\tthis.lastStats = {
\t\t\taliveCount,
\t\t\temitCount,
\t\t\tshouldEmit,
\t\t\tuploaded,
\t\t\tpoolSize: POOL_SIZE,
\t\t};

\t\tif ( uploaded ) {
`,
  );

  if (!output.includes("this.lastStats")) {
    throw new Error("Could not instrument Starter-Kit-Racing particle stats.");
  }

  return output;
}

async function serveStatic({
  root,
  preferredPort,
  transforms = {},
  extraRoots = {},
  headers = {},
}) {
  const rootStat = await stat(root).catch(() => null);
  if (rootStat === null || !rootStat.isDirectory()) {
    throw new Error(`Static root does not exist: ${root}`);
  }

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(requestUrl.pathname);
      const normalized = pathname === "/" ? "/index.html" : pathname;
      const staticPath = resolveStaticPath(root, normalized, extraRoots);
      const filePath = staticPath.filePath;
      if (!isPathInside(filePath, staticPath.root)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const transform = transforms[normalized];
      for (const [name, value] of Object.entries(headers)) {
        response.setHeader(name, value);
      }
      response.setHeader("Content-Type", mimeFor(filePath));

      if (transform) {
        const source = await readFile(filePath, "utf8");
        response.writeHead(200);
        response.end(transform(source));
        return;
      }

      const fileStat = await stat(filePath).catch(() => null);
      if (fileStat === null || !fileStat.isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200);
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500);
      response.end(String(error?.stack ?? error));
    }
  });

  const port = await listenOnAvailablePort(server, preferredPort);
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function resolveStaticPath(root, normalized, extraRoots) {
  for (const [prefix, extraRoot] of Object.entries(extraRoots)) {
    if (!normalized.startsWith(prefix)) continue;
    const relativePath = normalized.slice(prefix.length);
    return {
      root: extraRoot,
      filePath: path.resolve(extraRoot, relativePath),
    };
  }

  return {
    root,
    filePath: path.resolve(root, `.${normalized}`),
  };
}

function isPathInside(filePath, root) {
  return filePath === root || filePath.startsWith(root + path.sep);
}

function listenOnAvailablePort(server, preferredPort) {
  return new Promise((resolve, reject) => {
    let port = preferredPort;

    const tryListen = () => {
      const onError = (error) => {
        server.off("listening", onListening);
        if (error.code === "EADDRINUSE") {
          port += 1;
          tryListen();
          return;
        }
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        resolve(port);
      };
      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    };

    tryListen();
  });
}

function mimeFor(filePath) {
  const ext = path.extname(filePath);
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".glb":
      return "model/gltf-binary";
    case ".ogg":
      return "audio/ogg";
    case ".wasm":
      return "application/wasm";
    default:
      return "application/octet-stream";
  }
}

function crossOriginIsolationHeaders() {
  return {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}

function addQueryFlag(rawUrl, flag) {
  const url = new URL(rawUrl);
  const [key, value] = flag.split("=");
  url.searchParams.set(key, value ?? "1");
  return url.toString();
}

function collectApertureStartOptionQueryParams(parsedArgs) {
  const options = {};
  const sharedSnapshotMessageRateHz = firstStringArg(parsedArgs, [
    "aperture-shared-message-rate",
    "aperture-shared-snapshot-message-rate",
    "sharedSnapshotMessageRateHz",
  ]);
  const audioSnapshotMessageRateHz = firstStringArg(parsedArgs, [
    "aperture-audio-message-rate",
    "aperture-audio-snapshot-message-rate",
    "audioSnapshotMessageRateHz",
  ]);
  const sourceAssetsMessageRateHz = firstStringArg(parsedArgs, [
    "aperture-source-assets-message-rate",
    "aperture-source-assets-rate",
    "sourceAssetsMessageRateHz",
  ]);
  const workerFullSummaryIntervalMilliseconds = firstStringArg(parsedArgs, [
    "aperture-full-summary-interval",
    "aperture-worker-full-summary-interval",
    "workerFullSummaryIntervalMilliseconds",
  ]);

  if (sharedSnapshotMessageRateHz !== null) {
    options.sharedSnapshotMessageRateHz = sharedSnapshotMessageRateHz;
  }
  if (audioSnapshotMessageRateHz !== null) {
    options.audioSnapshotMessageRateHz = audioSnapshotMessageRateHz;
  }
  if (sourceAssetsMessageRateHz !== null) {
    options.sourceAssetsMessageRateHz = sourceAssetsMessageRateHz;
  }
  if (workerFullSummaryIntervalMilliseconds !== null) {
    options.workerFullSummaryIntervalMilliseconds =
      workerFullSummaryIntervalMilliseconds;
  }

  return options;
}

function firstStringArg(parsedArgs, keys) {
  for (const key of keys) {
    const value = stringArg(parsedArgs[key]);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--no-trace") {
      parsed.trace = false;
      continue;
    }
    if (arg === "--no-cpu-profile") {
      parsed["cpu-profile"] = false;
      continue;
    }
    if (arg === "--no-visual-diagnostics") {
      parsed["visual-diagnostics"] = false;
      parsed["no-visual-diagnostics"] = true;
      continue;
    }
    if (arg === "--trace") {
      parsed.trace = true;
      continue;
    }
    if (arg === "--cpu-profile") {
      parsed["cpu-profile"] = true;
      continue;
    }
    if (arg === "--visual-diagnostics") {
      parsed["visual-diagnostics"] = true;
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq === -1) {
      const next = rawArgs[index + 1];
      if (next !== undefined && !next.startsWith("--")) {
        parsed[body] = next;
        index += 1;
      } else {
        parsed[body] = true;
      }
    } else {
      parsed[body.slice(0, eq)] = body.slice(eq + 1);
    }
  }
  return parsed;
}

function numberArg(value, fallback) {
  if (value === undefined || value === null || value === false) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric argument, received ${value}`);
  }
  return parsed;
}

function stringArg(value) {
  if (value === undefined || value === null || value === false) return null;
  return String(value);
}

function normalizeBrowserChannel(value) {
  const channel = stringArg(value);
  if (channel === null || channel.length === 0) {
    return args.headed === true ? "chrome" : "bundled";
  }
  if (
    channel === "bundled" ||
    channel === "chromium" ||
    channel === "playwright"
  ) {
    return "bundled";
  }
  return channel;
}
