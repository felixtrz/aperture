#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

const baseURL =
  process.env.APERTURE_RENDER_CONTROL_BASE_URL ?? "http://127.0.0.1:4173";
const artifactDir =
  process.env.APERTURE_RENDER_CONTROL_ARTIFACT_DIR ??
  path.join("test-results", "render-control-cli");
// Default browser flags mirror playwright.ci.config.ts (and the generated
// playwright.local.config.ts): WebGPU on SwiftShader Vulkan. On GPU-less
// machines Chromium otherwise reports a usable adapter but has no
// SharedImageBackingFactory for the WebGPU canvas swap chain, so the first
// rendered frame destroys the device and every pending WebGPU operation
// rejects with "A valid external Instance reference no longer exists.".
// Override with APERTURE_RENDER_CONTROL_BROWSER_ARGS (space-separated) to
// probe a real GPU, e.g. APERTURE_RENDER_CONTROL_BROWSER_ARGS="--enable-unsafe-webgpu".
const defaultBrowserArgs = [
  "--enable-unsafe-webgpu",
  "--use-vulkan=swiftshader",
  "--enable-features=Vulkan",
  "--enable-unsafe-swiftshader",
];
const launchOptions = {
  channel: process.env.APERTURE_RENDER_CONTROL_CHANNEL ?? "chrome",
  headless: process.env.APERTURE_RENDER_CONTROL_HEADLESS === "1",
  args: parseBrowserArgs(process.env.APERTURE_RENDER_CONTROL_BROWSER_ARGS),
};
const defaultVolatilePathPatterns = [
  /^capturedAt$/u,
  /(^|\.)elapsedMs$/u,
  /(^|\.)frame$/u,
  /(^|\.)frameCount$/u,
  /(^|\.)frames$/u,
  /(^|\.)lastFrame$/u,
  /(^|\.)runId$/u,
  /(^|\.)runIndex$/u,
  /(^|\.)startedAt$/u,
  /(^|\.)timestamp$/u,
  /(^|\.)timing/u,
  /(^|\.)gpuTimingSamples$/u,
  /(^|\.)gpuTimeMs$/u,
  /(^|\.)gpuTimestamp$/u,
  /(^|\.)profilerHistory$/u,
  /(^|\.)profileSamples$/u,
  /(^|\.)url$/u,
  /(^|\.)warnings\.\d+\.capturedAt$/u,
];

const commands = process.argv.slice(2);

if (
  commands.length === 0 ||
  commands[0] === "help" ||
  commands[0] === "--help"
) {
  printHelp();
  process.exit(0);
}

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({
  baseURL,
  viewport: { width: 960, height: 640 },
});
const statusSnapshots = new Map();
const screenshots = new Map();
const pixelSnapshots = new Map();
const webGpuValidationMessages = [];
let currentScopeWarningOffset = 0;

page.on("console", (message) => {
  const text = message.text();

  if (isWebGpuValidationWarning(text)) {
    webGpuValidationMessages.push({
      type: message.type(),
      text,
      capturedAt: new Date().toISOString(),
    });
  }
});

try {
  if (commands[0] === "start") {
    await runInteractiveSession();
  } else {
    const result = await runCommand(commands);

    if (result !== undefined) {
      printJson(result);
    }
  }
} catch (error) {
  output.write(`${messageFromError(error)}\n`);
  process.exitCode = 1;
} finally {
  await closeBrowser();
}

await new Promise((resolve) => output.write("", resolve));
process.exit(process.exitCode ?? 0);

async function runInteractiveSession() {
  const rl = createInterface({ input, output });

  output.write("render-control ready. Type 'help' or 'stop'.\n");

  for (;;) {
    const line = await rl.question("render-control> ");
    const args = line.trim().split(/\s+/u).filter(Boolean);

    if (args.length === 0) {
      continue;
    }

    if (args[0] === "stop" || args[0] === "exit" || args[0] === "quit") {
      break;
    }

    try {
      const result = await runCommand(args);

      if (result !== undefined) {
        printJson(result);
      }
    } catch (error) {
      output.write(`${messageFromError(error)}\n`);
    }
  }

  rl.close();
}

async function runCommand(args) {
  const [command, ...rest] = args;

  switch (command) {
    case "open":
    case "navigate":
      return navigate(rest[0] ?? "/examples/triangle.html");
    case "refresh":
      currentScopeWarningOffset = webGpuValidationMessages.length;
      await page.reload({ waitUntil: "domcontentloaded" });
      return waitForStatus("refresh");
    case "reset":
    case "blank":
      await page.goto("about:blank");
      currentScopeWarningOffset = webGpuValidationMessages.length;
      return { ok: true, finalUrl: page.url() };
    case "status":
      return getStatus();
    case "capabilities":
      return getCapabilities();
    case "warnings":
      return getWarnings();
    case "assert-warnings":
    case "assert-no-warnings":
      return assertNoWebGpuValidationWarnings();
    case "snapshot":
      return captureSnapshot(rest[0] ?? "snapshot");
    case "screenshot":
      return captureScreenshot(rest[0] ?? "screenshot");
    case "pixels":
      return capturePixels(rest[0] ?? "pixels", rest.slice(1));
    case "diff":
      return diffLabels(rest[0], rest[1], {
        includeVolatile:
          rest.includes("--include-volatile") || rest.includes("--volatile"),
      });
    case "pause":
      return evaluateControl("pause", [], "pause");
    case "resume":
      return evaluateControl("resume", [], "resume");
    case "step":
      return evaluateControl("step", [parseFrameCount(rest[0])], "step");
    case "scenario":
      return runScenario(rest);
    case "frame":
      return evaluateControl("getFrameState", [], undefined);
    case "proofs":
      return runProofs();
    case "pilot":
      return runPilotRoutes();
    case "smoke-all":
      return smokeAllExamples();
    case "help":
      printHelp();
      return undefined;
    default:
      throw new Error(`Unknown render-control command '${command}'.`);
  }
}

async function navigate(url) {
  currentScopeWarningOffset = webGpuValidationMessages.length;
  await page.goto(normalizeRoute(url), { waitUntil: "domcontentloaded" });

  return waitForStatus("navigate");
}

async function waitForStatus(phase) {
  try {
    await page.waitForFunction(
      () => {
        const status = globalThis.__APERTURE_EXAMPLE_STATUS__;
        const ok =
          typeof status === "object" && status !== null && status.ok === true;
        const statusPhase =
          typeof status === "object" && status !== null
            ? status.phase
            : undefined;

        return status !== undefined && (ok || statusPhase !== "loading");
      },
      undefined,
      { timeout: 30000 },
    );
  } catch (error) {
    throw await createRenderControlError(
      phase,
      `Timed out waiting for example status/control readiness: ${messageFromError(
        error,
      )}`,
      "wait-ready-timeout",
    );
  }

  return getStatus();
}

async function getCapabilities() {
  const capabilities = await page.evaluate(
    () => globalThis.__APERTURE_EXAMPLE_CONTROL__?.capabilities ?? null,
  );

  if (capabilities === null) {
    throw await createRenderControlError(
      "capabilities",
      "Example did not expose __APERTURE_EXAMPLE_CONTROL__.",
      "missing-example-control",
    );
  }

  return capabilities;
}

async function getStatus() {
  return page.evaluate(async () => {
    const control = globalThis.__APERTURE_EXAMPLE_CONTROL__;

    if (control !== undefined) {
      return control.getStatus();
    }

    return globalThis.__APERTURE_EXAMPLE_STATUS__ ?? null;
  });
}

async function getWarnings() {
  const controlWarnings = await evaluateControl("getWarnings", [], "warnings");

  return {
    browserConsole: webGpuValidationMessages.slice(currentScopeWarningOffset),
    exampleControl: Array.isArray(controlWarnings) ? controlWarnings : [],
  };
}

async function assertNoWebGpuValidationWarnings() {
  const warnings = await getWarnings();
  const allWarnings = [
    ...warnings.browserConsole.map((warning) => warning.text),
    ...warnings.exampleControl.map((warning) => warning.text),
  ].filter(Boolean);

  if (allWarnings.length > 0) {
    throw await createRenderControlError(
      "assert-warnings",
      `WebGPU validation warnings were emitted:\n${allWarnings.join("\n\n")}`,
      "webgpu-validation-warning",
    );
  }

  return { ok: true, warnings };
}

async function captureSnapshot(label) {
  const snapshot = await evaluateControl("snapshot", [label], "snapshot");
  const artifactPath = await saveArtifact("snapshot", label, snapshot);

  statusSnapshots.set(label, snapshot);

  return {
    label,
    artifactPath,
    snapshot,
  };
}

async function captureScreenshot(label) {
  const png = await screenshotCanvas();
  const artifactPath = await saveArtifact("screenshot", label, png);

  screenshots.set(label, png);

  return {
    label,
    artifactPath,
    bytes: png.length,
  };
}

async function capturePixels(label, pointArgs) {
  const points =
    pointArgs.length > 0 ? pointArgs.map(parsePoint) : defaultPoints();
  const png = await screenshotCanvas();
  const samples = points.map((point) => ({
    ...point,
    pixel: readPngPixel(png, point.x, point.y),
  }));
  const snapshot = {
    label,
    capturedAt: new Date().toISOString(),
    url: page.url(),
    samples,
  };
  const artifactPath = await saveArtifact("pixels", label, snapshot);

  pixelSnapshots.set(label, snapshot);

  return {
    ...snapshot,
    artifactPath,
  };
}

async function diffLabels(beforeLabel, afterLabel, options) {
  if (beforeLabel === undefined || afterLabel === undefined) {
    throw new Error("Usage: diff <before-label> <after-label> [--volatile]");
  }

  const report = {
    before: beforeLabel,
    after: afterLabel,
    capturedAt: new Date().toISOString(),
  };

  if (statusSnapshots.has(beforeLabel) && statusSnapshots.has(afterLabel)) {
    report.status = diffStatusSnapshots(
      statusSnapshots.get(beforeLabel),
      statusSnapshots.get(afterLabel),
      { includeVolatile: options.includeVolatile },
    );
  }

  if (screenshots.has(beforeLabel) && screenshots.has(afterLabel)) {
    report.screenshot = diffPngSamples(
      screenshots.get(beforeLabel),
      screenshots.get(afterLabel),
      defaultPoints(),
    );
  }

  if (pixelSnapshots.has(beforeLabel) && pixelSnapshots.has(afterLabel)) {
    report.pixels = diffPixelSnapshots(
      pixelSnapshots.get(beforeLabel),
      pixelSnapshots.get(afterLabel),
    );
  }

  if (
    report.status === undefined &&
    report.screenshot === undefined &&
    report.pixels === undefined
  ) {
    throw new Error(
      `No matching snapshots named '${beforeLabel}' and '${afterLabel}' are available in this session.`,
    );
  }

  const artifactPath = await saveArtifact(
    "diff",
    `${beforeLabel}-to-${afterLabel}`,
    report,
  );

  return {
    ...report,
    artifactPath,
  };
}

async function runScenario(args) {
  const [id, ...optionArgs] = args;

  if (id === undefined) {
    throw new Error("Usage: scenario <id> [json-options]");
  }

  currentScopeWarningOffset = webGpuValidationMessages.length;

  return evaluateControl(
    "setScenario",
    [id, parseScenarioOptions(optionArgs)],
    "scenario",
  );
}

async function runProofs() {
  const routeRefresh = summarizeProofReport(await runRouteRefreshProof());
  await resetKnownExamples();
  const pauseStep = summarizeProofReport(await runPauseStepProof());
  await resetKnownExamples();
  const scenarioSwap = summarizeProofReport(await runScenarioSwapProof());
  await resetKnownExamples();

  return {
    ok: true,
    artifactDir,
    routeRefresh,
    pauseStep,
    scenarioSwap,
  };
}

async function runPilotRoutes() {
  const routes = [];

  routes.push(await runPersistentShellPilot());
  await resetKnownExamples();
  routes.push(await runTrianglePilot());
  await resetKnownExamples();
  routes.push(await runSpinningCubePilot());
  await resetKnownExamples();
  routes.push(await runPostEffectsPilot());
  await resetKnownExamples();
  routes.push(await runGlbViewerPilot());
  await resetKnownExamples();

  return {
    ok: routes.every((route) => route.ok),
    artifactDir,
    routes,
  };
}

async function runPersistentShellPilot() {
  const status = await navigate("/examples/persistent-render-shell.html");

  ensureOkStatus("persistent shell pilot", status);

  const transparent = await evaluateControl(
    "setScenario",
    [
      "transparent-pressure",
      {
        maxFrames: 80,
        requireReadback: false,
      },
    ],
    "scenario",
  );
  const transparentSnapshot = await captureSnapshot(
    "pilot-shell-transparent-pressure",
  );
  const clustered = await evaluateControl(
    "setScenario",
    [
      "clustered-pressure-history",
      {
        maxFrames: 80,
        requireReadback: false,
      },
    ],
    "scenario",
  );
  const clusteredSnapshot = await captureSnapshot(
    "pilot-shell-clustered-pressure-history",
  );
  const diff = await diffLabels(
    "pilot-shell-transparent-pressure",
    "pilot-shell-clustered-pressure-history",
    { includeVolatile: false },
  );

  ensureScenarioComplete("transparent-pressure", transparent);
  ensureScenarioComplete("clustered-pressure-history", clustered);

  return {
    route: "/examples/persistent-render-shell.html",
    ok: true,
    statusPhase: isRecord(status) ? status.phase : null,
    transparentPhase: isRecord(transparent) ? transparent.phase : null,
    clusteredPhase: isRecord(clustered) ? clustered.phase : null,
    snapshotArtifacts: [
      transparentSnapshot.artifactPath,
      clusteredSnapshot.artifactPath,
    ],
    diffArtifact: diff.artifactPath,
  };
}

async function runTrianglePilot() {
  const status = await navigate("/examples/triangle.html");

  ensureOkStatus("triangle pilot", status);

  const capabilities = await getCapabilities();
  const snapshot = await captureSnapshot("pilot-triangle");
  const screenshot = await captureScreenshot("pilot-triangle");
  await page.reload({ waitUntil: "domcontentloaded" });
  const refreshed = await waitForSmokeOkStatus();

  ensureOkStatus("triangle refresh pilot", refreshed);

  return {
    route: "/examples/triangle.html",
    ok: true,
    statusPhase: isRecord(status) ? status.phase : null,
    capabilities,
    snapshotArtifact: snapshot.artifactPath,
    screenshotArtifact: screenshot.artifactPath,
  };
}

async function runSpinningCubePilot() {
  const status = await navigate("/examples/spinning-cube.html");

  ensureOkStatus("spinning-cube pilot", status);

  const paused = await evaluateControl("pause", [], "pause");
  const before = await captureSnapshot("pilot-spinning-cube-paused");
  const stepped = await evaluateControl("step", [3], "step");
  const after = await captureSnapshot("pilot-spinning-cube-stepped");
  const resumed = await evaluateControl("resume", [], "resume");
  const diff = await diffLabels(
    "pilot-spinning-cube-paused",
    "pilot-spinning-cube-stepped",
    { includeVolatile: false },
  );

  if (
    frameFromSnapshot(after.snapshot) <
    frameFromSnapshot(before.snapshot) + 3
  ) {
    throw new Error(
      "spinning-cube pilot did not advance at least three frames.",
    );
  }

  return {
    route: "/examples/spinning-cube.html",
    ok: true,
    paused,
    stepped,
    resumed,
    beforeFrame: frameFromSnapshot(before.snapshot),
    afterFrame: frameFromSnapshot(after.snapshot),
    diffArtifact: diff.artifactPath,
  };
}

async function runPostEffectsPilot() {
  const status = await navigate("/examples/post-effects.html");

  ensureOkStatus("post-effects pilot", status);

  const raw = await evaluateControl("setScenario", ["raw", {}], "scenario");
  const rawSnapshot = await captureSnapshot("pilot-post-effects-raw");
  const rawScreenshot = await captureScreenshot("pilot-post-effects-raw");
  const effected = await evaluateControl(
    "setScenario",
    ["fxaa-bloom", {}],
    "scenario",
  );
  const effectedSnapshot = await captureSnapshot(
    "pilot-post-effects-fxaa-bloom",
  );
  const effectedScreenshot = await captureScreenshot(
    "pilot-post-effects-fxaa-bloom",
  );
  const diff = await diffLabels(
    "pilot-post-effects-raw",
    "pilot-post-effects-fxaa-bloom",
    { includeVolatile: false },
  );

  return {
    route: "/examples/post-effects.html",
    ok: true,
    raw,
    effected,
    snapshotArtifacts: [
      rawSnapshot.artifactPath,
      effectedSnapshot.artifactPath,
    ],
    screenshotArtifacts: [
      rawScreenshot.artifactPath,
      effectedScreenshot.artifactPath,
    ],
    diffArtifact: diff.artifactPath,
  };
}

async function runGlbViewerPilot() {
  const status = await navigate("/examples/glb-viewer.html?asset=slab");

  ensureOkStatus("glb-viewer pilot", status);

  const snapshot = await captureSnapshot("pilot-glb-viewer-frame-state");
  const selectedAsset = isRecord(status) ? status.selectedAsset : null;

  if (!isRecord(selectedAsset) || selectedAsset.id !== "slab") {
    throw new Error(
      `glb-viewer pilot expected selected asset 'slab', got ${summarizeValue(
        selectedAsset,
      )}.`,
    );
  }

  return {
    route: "/examples/glb-viewer.html?asset=slab",
    ok: true,
    selectedAsset,
    snapshotArtifact: snapshot.artifactPath,
  };
}

async function smokeAllExamples() {
  const routes = await rendererExampleRoutes();
  const visited = [];

  for (const route of routes) {
    const navigation = await navigate(route);
    const status = await waitForSmokeOkStatus();
    const capabilities = await getCapabilities();
    const warnings = await getWarnings();
    const warningCount =
      warnings.browserConsole.length + warnings.exampleControl.length;

    await saveArtifact("status", route, {
      route,
      navigation,
      capabilities,
      status,
    });
    await saveArtifact("warnings", route, {
      route,
      warnings,
    });

    visited.push({
      route,
      ok: isRecord(status) ? status.ok === true : false,
      phase: isRecord(status) ? (status.phase ?? null) : null,
      warningCount,
    });
    await resetKnownExamples();
  }

  return {
    ok: true,
    artifactDir,
    visited: visited.length,
    routeStatusFailures: visited.filter((entry) => !entry.ok),
    warningRoutes: visited.filter((entry) => entry.warningCount > 0),
    routes: visited,
  };
}

async function rendererExampleRoutes() {
  const entries = await readdir(path.join(process.cwd(), "examples"));

  return entries
    .filter((entry) => entry.endsWith(".html") && entry !== "index.html")
    .sort()
    .map((entry) => `/examples/${entry}`);
}

function summarizeProofReport(report) {
  return {
    before: report.before,
    after: report.after,
    artifactPath: report.artifactPath,
    status: report.status
      ? {
          added: report.status.added.length,
          removed: report.status.removed.length,
          changed: report.status.changed.length,
          ignored: report.status.ignoredPaths.length,
        }
      : null,
    screenshot: report.screenshot
      ? {
          changedPixels: report.screenshot.image.changedPixels,
          maxDistance: report.screenshot.maxDistance,
        }
      : null,
    pixels: report.pixels
      ? {
          added: report.pixels.added.length,
          removed: report.pixels.removed.length,
          changed: report.pixels.changed.length,
        }
      : null,
  };
}

async function runRouteRefreshProof() {
  const initialStatus = await navigate("/examples/triangle.html");

  ensureOkStatus("triangle refresh proof", initialStatus);
  await captureSnapshot("proof-triangle-before-refresh");
  await page.reload({ waitUntil: "domcontentloaded" });
  const refreshedStatus = await waitForStatus("refresh");

  ensureOkStatus("triangle refresh proof", refreshedStatus);
  await captureSnapshot("proof-triangle-after-refresh");

  return diffLabels(
    "proof-triangle-before-refresh",
    "proof-triangle-after-refresh",
    {
      includeVolatile: false,
    },
  );
}

async function runPauseStepProof() {
  const status = await navigate("/examples/spinning-cube.html");

  ensureOkStatus("spinning-cube pause/step proof", status);
  await evaluateControl("pause", [], "pause");
  await captureSnapshot("proof-spinning-cube-paused");
  await evaluateControl("step", [3], "step");
  await captureSnapshot("proof-spinning-cube-stepped");
  await evaluateControl("resume", [], "resume");

  return diffLabels(
    "proof-spinning-cube-paused",
    "proof-spinning-cube-stepped",
    {
      includeVolatile: false,
    },
  );
}

async function runScenarioSwapProof() {
  const status = await navigate("/examples/post-effects.html");

  ensureOkStatus("post-effects scenario-swap proof", status);
  await evaluateControl("setScenario", ["raw", {}], "scenario");
  await captureSnapshot("proof-post-effects-raw");
  await captureScreenshot("proof-post-effects-raw");
  await evaluateControl("setScenario", ["fxaa-bloom", {}], "scenario");
  await captureSnapshot("proof-post-effects-fxaa-bloom");
  await captureScreenshot("proof-post-effects-fxaa-bloom");

  return diffLabels("proof-post-effects-raw", "proof-post-effects-fxaa-bloom", {
    includeVolatile: false,
  });
}

async function evaluateControl(method, args, capability) {
  const result = await page.evaluate(
    async ({ method, args, capability }) => {
      const control = globalThis.__APERTURE_EXAMPLE_CONTROL__;

      if (control === undefined) {
        return {
          ok: false,
          reason: "missing-example-control",
          message: "Example did not expose __APERTURE_EXAMPLE_CONTROL__.",
        };
      }

      if (
        capability !== undefined &&
        control.capabilities?.[capability] === false
      ) {
        return {
          ok: false,
          reason: "unsupported-capability",
          message: `Example control capability '${capability}' is not supported by this route.`,
          capability,
          capabilities: control.capabilities,
        };
      }

      const candidate = control[method];

      if (typeof candidate !== "function") {
        return {
          ok: false,
          reason: "missing-example-control-method",
          message: `Example control method '${method}' is missing.`,
        };
      }

      return candidate.apply(control, args);
    },
    { method, args, capability },
  );

  if (isControlFailure(result)) {
    throw await createRenderControlError(method, result.message, result.reason);
  }

  return result;
}

async function screenshotCanvas() {
  try {
    return await page.locator("#aperture-canvas").screenshot();
  } catch (error) {
    throw await createRenderControlError(
      "screenshot",
      `Failed to capture #aperture-canvas screenshot: ${messageFromError(error)}`,
      "screenshot-failed",
    );
  }
}

async function resetKnownExamples() {
  await page
    .evaluate(async () => {
      await Promise.all([
        Promise.resolve(globalThis.__APERTURE_SPINNING_CUBE_STOP__?.()),
        Promise.resolve(globalThis.__APERTURE_POST_EFFECTS_STOP__?.()),
        Promise.resolve(globalThis.__APERTURE_GLB_VIEWER_STOP__?.()),
        Promise.resolve(
          globalThis.__APERTURE_RENDER_PROOF_SHELL__?.dispose?.(),
        ),
      ]);
    })
    .catch(() => undefined);
  await page.goto("about:blank");
  currentScopeWarningOffset = webGpuValidationMessages.length;
}

async function waitForSmokeOkStatus(timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  let status = await getStatus();

  while (!isRecord(status) || status.ok !== true) {
    if (Date.now() >= deadline || isUnsupportedWebGpuStatus(status)) {
      return status;
    }

    await page.waitForTimeout(100);
    status = await getStatus();
  }

  return status;
}

async function saveArtifact(kind, label, payload) {
  await mkdir(artifactDir, { recursive: true });

  const safeKind = safeArtifactSegment(kind);
  const safeLabel = safeArtifactSegment(label);

  if (Buffer.isBuffer(payload)) {
    const extension = isPng(payload) ? "png" : "bin";
    const filePath = path.join(
      artifactDir,
      `${safeKind}-${safeLabel}.${extension}`,
    );

    await writeFile(filePath, payload);

    return filePath;
  }

  const filePath = path.join(artifactDir, `${safeKind}-${safeLabel}.json`);

  await writeFile(filePath, JSON.stringify(payload ?? null, null, 2));

  return filePath;
}

async function createRenderControlError(phase, message, reason) {
  const status = await readStatusNoThrow();
  const recentWarnings = webGpuValidationMessages.slice(-5);

  return new Error(
    [
      message,
      `url=${page.url()}`,
      `phase=${phase}`,
      `reason=${reason}`,
      `status=${summarizeValue(status)}`,
      `recentWebGpuWarnings=${summarizeValue(recentWarnings)}`,
    ].join(" "),
  );
}

async function readStatusNoThrow() {
  try {
    return await page.evaluate(
      () => globalThis.__APERTURE_EXAMPLE_STATUS__ ?? null,
    );
  } catch {
    return null;
  }
}

function diffStatusSnapshots(before, after, options = {}) {
  const added = [];
  const removed = [];
  const changed = [];
  const ignoredPaths = [];
  const ignoredPathPatterns =
    options.ignoredPathPatterns ?? defaultVolatilePathPatterns;

  walkDiff({
    before,
    after,
    path: "",
    added,
    removed,
    changed,
    ignoredPaths,
    ignoredPathPatterns,
    includeVolatile: options.includeVolatile === true,
  });

  return { added, removed, changed, ignoredPaths };
}

function diffPngSamples(before, after, samples) {
  const sampleDiffs = samples.map((sample) => {
    const beforePixel = readPngPixel(before, sample.x, sample.y);
    const afterPixel = readPngPixel(after, sample.x, sample.y);

    return {
      id: sample.id,
      before: beforePixel,
      after: afterPixel,
      distance: pixelDistance(beforePixel, afterPixel),
    };
  });
  const image = diffPngImages(before, after);
  const sampleMaxDistance = sampleDiffs.reduce(
    (max, sample) => Math.max(max, sample.distance),
    0,
  );

  return {
    samples: sampleDiffs,
    image,
    maxDistance: Math.max(sampleMaxDistance, image.maxDistance),
  };
}

function diffPngImages(before, after) {
  const beforeImage = readPngImage(before);
  const afterImage = readPngImage(after);
  const dimensionsMatch =
    beforeImage.width === afterImage.width &&
    beforeImage.height === afterImage.height;

  if (!dimensionsMatch) {
    return {
      dimensionsMatch,
      beforeWidth: beforeImage.width,
      beforeHeight: beforeImage.height,
      afterWidth: afterImage.width,
      afterHeight: afterImage.height,
      comparedPixels: 0,
      changedPixels: 0,
      maxDistance: null,
      meanDistance: null,
    };
  }

  let changedPixels = 0;
  let maxDistance = 0;
  let totalDistance = 0;
  const comparedPixels = beforeImage.width * beforeImage.height;

  for (let y = 0; y < beforeImage.height; y += 1) {
    for (let x = 0; x < beforeImage.width; x += 1) {
      const distance = pixelDistance(
        readImagePixel(beforeImage, x, y),
        readImagePixel(afterImage, x, y),
      );

      if (distance > 0) {
        changedPixels += 1;
      }

      maxDistance = Math.max(maxDistance, distance);
      totalDistance += distance;
    }
  }

  return {
    dimensionsMatch,
    beforeWidth: beforeImage.width,
    beforeHeight: beforeImage.height,
    afterWidth: afterImage.width,
    afterHeight: afterImage.height,
    comparedPixels,
    changedPixels,
    maxDistance,
    meanDistance: comparedPixels > 0 ? totalDistance / comparedPixels : 0,
  };
}

function diffPixelSnapshots(before, after) {
  const beforeById = new Map(
    before.samples.map((sample) => [sample.id, sample.pixel]),
  );
  const afterById = new Map(
    after.samples.map((sample) => [sample.id, sample.pixel]),
  );
  const ids = new Set([...beforeById.keys(), ...afterById.keys()]);
  const added = [];
  const removed = [];
  const changed = [];

  for (const id of [...ids].sort()) {
    const beforePixel = beforeById.get(id);
    const afterPixel = afterById.get(id);

    if (beforePixel === undefined) {
      added.push({ id, after: afterPixel });
    } else if (afterPixel === undefined) {
      removed.push({ id, before: beforePixel });
    } else {
      const distance = pixelDistance(beforePixel, afterPixel);

      if (distance > 0) {
        changed.push({
          id,
          before: beforePixel,
          after: afterPixel,
          distance,
        });
      }
    }
  }

  return { added, removed, changed };
}

function walkDiff(options) {
  const {
    before,
    after,
    path,
    added,
    removed,
    changed,
    ignoredPaths,
    ignoredPathPatterns,
    includeVolatile,
  } = options;

  if (
    !includeVolatile &&
    path.length > 0 &&
    ignoredPathPatterns.some((pattern) => pattern.test(path))
  ) {
    ignoredPaths.push(path);
    return;
  }

  if (Object.is(before, after)) {
    return;
  }

  if (before === undefined) {
    added.push({ path, before, after });
    return;
  }

  if (after === undefined) {
    removed.push({ path, before, after });
    return;
  }

  if (!isRecord(before) || !isRecord(after)) {
    changed.push({ path, before, after });
    return;
  }

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of [...keys].sort()) {
    walkDiff({
      before: before[key],
      after: after[key],
      path: path.length === 0 ? key : `${path}.${key}`,
      added,
      removed,
      changed,
      ignoredPaths,
      ignoredPathPatterns,
      includeVolatile,
    });
  }
}

function readPngPixel(png, xRatio, yRatio) {
  const image = readPngImage(png);
  const x = clampIndex(Math.floor(image.width * xRatio), image.width);
  const y = clampIndex(Math.floor(image.height * yRatio), image.height);

  return readImagePixel(image, x, y);
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

function pixelDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b, a.a - b.a);
}

function parsePoint(value) {
  const [id, xRaw, yRaw] = value.split(":");
  const x = Number.parseFloat(xRaw);
  const y = Number.parseFloat(yRaw);

  if (
    id === undefined ||
    id.length === 0 ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    throw new Error(
      `Invalid pixel point '${value}'. Use id:x:y ratios, for example center:0.5:0.5.`,
    );
  }

  return { id, x, y };
}

function parseFrameCount(value) {
  const frameCount = Number.parseInt(value ?? "1", 10);

  if (!Number.isFinite(frameCount) || frameCount <= 0) {
    throw new Error(`Frame count must be a positive integer, got '${value}'.`);
  }

  return frameCount;
}

function parseScenarioOptions(optionArgs) {
  if (optionArgs.length === 0) {
    return {};
  }

  const text = optionArgs.join(" ");

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Scenario options must be JSON, got '${text}': ${messageFromError(error)}`,
      { cause: error },
    );
  }
}

function defaultPoints() {
  return [
    { id: "center", x: 0.5, y: 0.5 },
    { id: "upper-right", x: 0.72, y: 0.42 },
  ];
}

function ensureOkStatus(label, status) {
  if (!isRecord(status) || status.ok !== true) {
    throw new Error(
      `${label} cannot run because status is ${summarizeValue(status)}.`,
    );
  }
}

function ensureScenarioComplete(label, result) {
  if (
    !isRecord(result) ||
    result.ok !== true ||
    result.phase !== "scenario-complete"
  ) {
    throw new Error(
      `${label} scenario did not complete: ${summarizeValue(result)}.`,
    );
  }
}

function frameFromSnapshot(snapshot) {
  if (!isRecord(snapshot)) {
    return 0;
  }

  const frameState = snapshot.frameState;

  if (isRecord(frameState) && typeof frameState.frame === "number") {
    return frameState.frame;
  }

  const status = snapshot.status;

  if (
    isRecord(status) &&
    isRecord(status.animation) &&
    typeof status.animation.frames === "number"
  ) {
    return status.animation.frames;
  }

  return 0;
}

function normalizeRoute(url) {
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("about:")
  ) {
    return url;
  }

  return url.startsWith("/") ? url : `/${url}`;
}

function safeArtifactSegment(value) {
  return (
    String(value)
      .replace(/[^a-z0-9._-]+/giu, "-")
      .replace(/^-|-$/gu, "") || "artifact"
  );
}

function summarizeValue(value) {
  try {
    const json = JSON.stringify(value ?? null);

    return json.length > 500 ? `${json.slice(0, 500)}...` : json;
  } catch {
    return '"<non-json-safe>"';
  }
}

function parseBrowserArgs(raw) {
  if (typeof raw !== "string" || raw.trim() === "") {
    return [...defaultBrowserArgs];
  }

  return raw.trim().split(/\s+/u);
}

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

function isControlFailure(value) {
  return (
    isRecord(value) &&
    value.ok === false &&
    typeof value.reason === "string" &&
    (value.reason === "unsupported-capability" ||
      value.reason.startsWith("missing-example-control"))
  );
}

function isUnsupportedWebGpuStatus(value) {
  return (
    isRecord(value) &&
    value.ok === false &&
    (value.reason === "navigator-gpu-unavailable" ||
      value.reason === "adapter-unavailable" ||
      value.reason === "device-request-failed" ||
      value.reason === "context-unavailable" ||
      value.reason === "device-lost")
  );
}

function isWebGpuValidationWarning(text) {
  return (
    text.includes("Invalid CommandBuffer") ||
    text.includes("created with a default layout") ||
    text.includes("While encoding [RenderPassEncoder") ||
    text.includes("While calling [Queue].Submit") ||
    (text.includes("WebGPU") && text.includes("validation"))
  );
}

function isPng(buffer) {
  return buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function clampIndex(index, size) {
  return Math.min(size - 1, Math.max(0, index));
}

function printHelp() {
  output.write(`Usage:
  pnpm render-control start
  pnpm render-control open /examples/glb-viewer.html
  pnpm render-control status
  pnpm render-control warnings
  pnpm render-control pixels center center:0.5:0.5
  pnpm render-control snapshot baseline
  pnpm render-control screenshot baseline
  pnpm render-control pause
  pnpm render-control step 3
  pnpm render-control resume
  pnpm render-control scenario clustered-pressure-history '{"maxFrames":80}'
  pnpm render-control diff baseline after
  pnpm render-control refresh
  pnpm render-control reset
  pnpm render-control pilot
  pnpm render-control proofs
  pnpm render-control smoke-all
  pnpm render-control stop

Use 'start' for an interactive session when you need snapshots, screenshots,
diffs, refreshes, and route changes to share one browser page. Artifacts are
written under ${artifactDir}.

The examples server must be available at ${baseURL}.
Set APERTURE_RENDER_CONTROL_BASE_URL to use another server.
`);
}

function printJson(value) {
  output.write(`${JSON.stringify(value ?? null, null, 2)}\n`);
}

async function closeBrowser() {
  let timeoutId = null;

  try {
    await Promise.race([
      browser.close(),
      new Promise((resolve) => {
        timeoutId = setTimeout(resolve, 5000);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}
