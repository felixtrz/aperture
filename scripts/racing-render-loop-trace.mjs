#!/usr/bin/env node
/* global KeyboardEvent, document, location */
import { createServer } from "node:http";
import { readFile, stat, mkdir, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_DIR = path.join(ROOT, "tmp", "racing-render-loop-traces");
const DEFAULT_APERTURE_DIST = path.join(ROOT, "racing", "dist");
const DEFAULT_THREE_ROOT = path.join(ROOT, "references", "Starter-Kit-Racing");

const args = parseArgs(process.argv.slice(2));
const durationMs = numberArg(args.duration, 8000);
const warmupMs = numberArg(args.warmup, 2000);
const driveSettleMs = numberArg(args["drive-settle"], 1000);
const outDir = path.resolve(String(args.out ?? DEFAULT_OUT_DIR));
const captureTrace = args.trace !== false;
const captureCpuProfile = args["cpu-profile"] !== false;
const scenarios = String(args.scenario ?? "idle,drive")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const browserArgs = [
  "--enable-unsafe-webgpu",
  "--ignore-gpu-blocklist",
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

  const browser = await chromium.launch({
    headless: args.headed === true ? false : true,
    args: browserArgs,
  });
  const summary = {
    createdAt: new Date().toISOString(),
    durationMs,
    warmupMs,
    driveSettleMs,
    captureTrace,
    captureCpuProfile,
    headless: args.headed === true ? false : true,
    browserArgs,
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

      for (const target of targets) {
        const run = await runScenario(browser, target, scenario);
        summary.runs.push(run.summary);
        await writeFile(
          path.join(outDir, `${target.id}-${scenario}-snapshot.json`),
          JSON.stringify(run.snapshot, null, 2),
        );
      }
    }
  } finally {
    await browser.close();
    await Promise.all(servers.map((server) => server.close()));
  }

  const summaryPath = path.join(outDir, "summary.json");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));
  printSummary(summary, summaryPath);
}

async function runScenario(browser, target, scenario) {
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

  const url = addQueryFlag(
    target.url,
    target.kind === "three" ? "perf=1" : "trace=1",
  );
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
  const profiler = await startProfiling(page, `${target.id}-${scenario}`);
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
    summary: summarizeRun(target, scenario, snapshot, profileFiles),
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
  return await page.evaluate(() => {
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
      const diagnostics = status.diagnostics ?? null;
      const lastFrame =
        diagnostics?.lastFrame ??
        diagnostics?.frame ??
        status.render?.lastFrame ??
        null;
      const counts = lastFrame?.counts ?? diagnostics?.counts ?? null;
      return {
        frame: status.frame ?? status.lastFrame ?? null,
        status: status.status ?? null,
        webgpuOk: status.webgpuOk ?? null,
        performance: status.performance ?? null,
        render: status.render ?? null,
        diagnostics: {
          counts,
          changeSet:
            lastFrame?.changeSet ??
            lastFrame?.renderChangeSet ??
            diagnostics?.changeSet ??
            null,
          phaseTimings:
            lastFrame?.phaseTimings ?? diagnostics?.phaseTimings ?? null,
          shadow: lastFrame?.shadow ?? diagnostics?.shadow ?? null,
          particles: lastFrame?.particles ?? diagnostics?.particles ?? null,
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
}

function summarizeRun(target, scenario, snapshot, profileFiles) {
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
    url: snapshot.href,
    crossOriginIsolated: snapshot.crossOriginIsolated,
    memory: snapshot.memory,
    raf: {
      sampleCount: rafSamples.length,
      intervalMs: quantiles(intervals),
      callbackMs: quantiles(callbacks),
    },
    aperture: summarizeApertureSamples(apertureSamples, snapshot.aperture),
    three: summarizeThreeSamples(threeSamples, snapshot.three),
    profileFiles,
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
    performanceTransport:
      latest?.performance?.latest?.transport ??
      latest?.performance?.transport ??
      null,
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
    gpuTimer: {
      renderMs: quantiles(gpuTimerResults),
      latest: latest?.renderer?.gpuTimer ?? null,
    },
  };
}

function printSummary(summary, summaryPath) {
  console.log(`racing render-loop trace summary: ${summaryPath}`);
  for (const run of summary.runs) {
    const interval = run.raf.intervalMs;
    const callback = run.raf.callbackMs;
    const drawCalls =
      run.target === "three" ? run.three?.renderCalls : run.aperture?.drawCalls;
    const gpuTimer =
      run.target === "three" ? run.three?.gpuTimer?.renderMs : null;
    const heapMb = run.memory
      ? (run.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)
      : "n/a";
    const parts = [
      `${run.label} ${run.scenario}`,
      `raf p50=${formatMs(interval.p50)} p95=${formatMs(interval.p95)} p99=${formatMs(interval.p99)} max=${formatMs(interval.max)}`,
      `callback p95=${formatMs(callback.p95)} max=${formatMs(callback.max)}`,
      `draw/calls p50=${formatNumber(drawCalls?.p50)} max=${formatNumber(drawCalls?.max)}`,
    ];
    if (run.target === "three") {
      parts.push(
        `gpu p50=${formatMs(gpuTimer?.p50)} p95=${formatMs(gpuTimer?.p95)} max=${formatMs(gpuTimer?.max)}`,
      );
    }
    parts.push(`heap=${heapMb}MB`);
    console.log(parts.join(" | "));
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
      counts: lastFrame?.counts ?? diagnostics?.counts ?? null,
      changeSet:
        lastFrame?.changeSet ??
        lastFrame?.renderChangeSet ??
        diagnostics?.changeSet ??
        null,
      phaseTimings: lastFrame?.phaseTimings ?? diagnostics?.phaseTimings ?? null,
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
      timestamp,
      intervalMs,
      callbackMs: null,
      endedAt: performance.now()
    });
    scheduleFrameProbe();
  }

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
    "const renderer = new THREE.WebGLRenderer( { antialias: true, outputBufferType: THREE.HalfFloatType } );\ninstallThreeRacingGlDrawCounter( renderer );\ninstallThreeRacingGpuTimer( renderer );\n",
  );
  if (!output.includes("installThreeRacingGlDrawCounter( renderer );")) {
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

function installThreeRacingGlDrawCounter( renderer ) {

\tconst gl = renderer.getContext?.();
\tconst counter = {
\t\tcalls: 0,
\t\tdrawArrays: 0,
\t\tdrawElements: 0,
\t\tdrawArraysInstanced: 0,
\t\tdrawElementsInstanced: 0,
\t\tmultiDrawArrays: 0,
\t\tmultiDrawElements: 0,
\t\treset() {
\t\t\tthis.calls = 0;
\t\t\tthis.drawArrays = 0;
\t\t\tthis.drawElements = 0;
\t\t\tthis.drawArraysInstanced = 0;
\t\t\tthis.drawElementsInstanced = 0;
\t\t\tthis.multiDrawArrays = 0;
\t\t\tthis.multiDrawElements = 0;
\t\t},
\t\tsnapshot() {
\t\t\treturn {
\t\t\t\tcalls: this.calls,
\t\t\t\tdrawArrays: this.drawArrays,
\t\t\t\tdrawElements: this.drawElements,
\t\t\t\tdrawArraysInstanced: this.drawArraysInstanced,
\t\t\t\tdrawElementsInstanced: this.drawElementsInstanced,
\t\t\t\tmultiDrawArrays: this.multiDrawArrays,
\t\t\t\tmultiDrawElements: this.multiDrawElements,
\t\t\t};
\t\t},
\t};

\tfunction wrap( target, method, field ) {

\t\tif ( target === null || target === undefined || typeof target[ method ] !== 'function' ) return;
\t\tconst original = target[ method ].bind( target );
\t\ttarget[ method ] = ( ...args ) => {

\t\t\tcounter.calls ++;
\t\t\tcounter[ field ] ++;
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

\tglobalThis.__THREE_RACING_GL_DRAW_COUNTER__ = counter;
\treturn counter;

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

function parseArgs(rawArgs) {
  const parsed = {};
  for (const arg of rawArgs) {
    if (arg === "--no-trace") {
      parsed.trace = false;
      continue;
    }
    if (arg === "--no-cpu-profile") {
      parsed["cpu-profile"] = false;
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
    if (!arg.startsWith("--")) continue;
    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq === -1) {
      parsed[body] = true;
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
