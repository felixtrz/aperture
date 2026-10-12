import {
  PREVIEW_GEOMETRY_V3,
  inspectPreviewGeometryV3,
  previewGeometryErrorV3,
} from "./preview-geometry-v3.mjs";
import { CONTRACT, READY_GLOBAL, requireValue } from "./contract.mjs";

export const PREVIEW_SCHEMA = "aperture.agent-house-diagnostic-preview.v3";
export const PREVIEW_LIMITS = Object.freeze({
  warmupFrames: 3,
  diagnosticFrames: 3,
  operationMs: 30000,
  totalMs: 240000,
});

export async function withDeadline(
  operation,
  milliseconds,
  phase,
  timers = globalThis,
) {
  requireValue(
    Number.isFinite(milliseconds) && milliseconds > 0,
    "Positive diagnostic operation deadline required",
  );
  let timer;
  const expired = new Promise((_, reject) => {
    timer = timers.setTimeout(
      () =>
        reject(
          new Error(
            `Diagnostic preview deadline exceeded during ${phase} (${milliseconds}ms)`,
          ),
        ),
      milliseconds,
    );
  });
  try {
    return await Promise.race([Promise.resolve().then(operation), expired]);
  } finally {
    timers.clearTimeout(timer);
  }
}

async function postArtifact(name, body, type = "application/json") {
  const bytes =
    body instanceof Blob
      ? new Uint8Array(await body.arrayBuffer())
      : new TextEncoder().encode(body);
  const hash = Array.from(
    new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");
  const response = await globalThis.fetch(`/__benchmark/record/${name}`, {
    method: "POST",
    headers: { "Content-Type": type },
    body: bytes,
  });
  const receipt = await response.json();
  requireValue(
    response.ok &&
      receipt.ok &&
      receipt.path === name &&
      receipt.bytes === bytes.length &&
      receipt.sha256 === hash,
    `Diagnostic artifact not acknowledged: ${name}`,
  );
  return receipt;
}

export async function runDiagnosticPreview() {
  const start = globalThis.performance.now(),
    receipts = [],
    frames = [],
    views = [];
  let geometryPreflight;
  const observer = globalThis.__AGENT_NATIVE_OBSERVER__;
  let phase = "initialization",
    app,
    config;
  const progress = (name, detail = {}) => {
    phase = name;
    globalThis.__AGENT_BENCHMARK_PROGRESS__ = {
      schema: PREVIEW_SCHEMA,
      phase,
      elapsedMs: globalThis.performance.now() - start,
      ...detail,
    };
  };
  const bounded = (name, operation) => {
    progress(name);
    const remaining =
      PREVIEW_LIMITS.totalMs - (globalThis.performance.now() - start);
    requireValue(
      remaining > 0,
      `Diagnostic preview total budget exceeded during ${name}`,
    );
    return withDeadline(
      operation,
      Math.min(PREVIEW_LIMITS.operationMs, remaining),
      name,
    );
  };
  async function frame(number) {
    await bounded(`frame-${number}-prior-fence`, () => observer.fence());
    const before = observer.snapshot();
    const startedAt = globalThis.performance.now();
    await bounded(`frame-${number}-render`, () =>
      app.renderFrame({
        frame: number,
        deltaSeconds: CONTRACT.deltaSeconds,
        timeSeconds: number * CONTRACT.deltaSeconds,
      }),
    );
    const submitted = observer.snapshot();
    const renderPromiseFinishedAt = globalThis.performance.now();
    const completedAt = await bounded(`frame-${number}-native-fence`, () =>
      observer.fence(),
    );
    const after = observer.snapshot();
    requireValue(
      submitted.submissions > before.submissions &&
        submitted.drawCalls > before.drawCalls &&
        after.submissions === submitted.submissions,
      "Diagnostic frame has no controlled native submitted draws",
    );
    frames.push({
      frame: number,
      nativeSubmissions: after.submissions - before.submissions,
      nativeDrawCalls: after.drawCalls - before.drawCalls,
      cpuSubmissionMs: submitted.lastSubmitAt - startedAt,
      renderPromiseMs: renderPromiseFinishedAt - startedAt,
      queueCompletionLatencyMs: completedAt - submitted.lastSubmitAt,
      endToEndMs: completedAt - startedAt,
      timingScope:
        "diagnostic elapsed browser/native queue timings; no benchmark score",
    });
  }
  try {
    requireValue(
      observer &&
        globalThis.__APERTURE_VERIFIED_GPU__ &&
        globalThis.__APERTURE_WAIT_GPU__,
      "Approved verified route and pre-boot observation required",
    );
    config = await bounded("configuration", async () =>
      (await globalThis.fetch("/__benchmark/config.json")).json(),
    );
    requireValue(
      config.schema === PREVIEW_SCHEMA &&
        JSON.stringify(config.contract) === JSON.stringify(CONTRACT) &&
        JSON.stringify(config.limits) === JSON.stringify(PREVIEW_LIMITS) &&
        JSON.stringify(config.geometryPreflight) ===
          JSON.stringify(PREVIEW_GEOMETRY_V3),
      "Diagnostic preview configuration differs",
    );
    app = await bounded("adapter-registration", async () => {
      while (!globalThis.__AGENT_BENCHMARK__)
        await new Promise((resolve) =>
          globalThis.requestAnimationFrame(resolve),
        );
      return globalThis.__AGENT_BENCHMARK__;
    });
    requireValue(
      app.engine === config.engine &&
        ["three", "aperture"].includes(app.engine),
      "Diagnostic app engine differs",
    );
    for (const name of ["setCamera", "renderFrame"])
      requireValue(
        typeof app[name] === "function",
        `Diagnostic adapter method missing: ${name}`,
      );
    await bounded("application-ready", () => app.ready);
    requireValue(
      app.canvas instanceof globalThis.HTMLCanvasElement &&
        globalThis.document.querySelectorAll("canvas").length === 1 &&
        app.canvas.width === CONTRACT.viewport.width &&
        app.canvas.height === CONTRACT.viewport.height &&
        globalThis.devicePixelRatio === 1,
      "Diagnostic canvas/viewport differs",
    );
    observer.sealGeometryCapture(); // Diagnostic preview never uploads/scorers full geometry.
    await bounded("canonical-camera", () => app.setCamera(CONTRACT.views[0]));
    for (
      let number = 0;
      number < PREVIEW_LIMITS.warmupFrames + PREVIEW_LIMITS.diagnosticFrames;
      number++
    )
      await frame(number);
    // Same canonical camera and six short frames as v2; no extra rendering/fence.
    try {
      geometryPreflight = await bounded("geometry-preflight", () =>
        inspectPreviewGeometryV3(app, observer),
      );
      geometryPreflight.capturedAfterFrame =
        PREVIEW_LIMITS.warmupFrames + PREVIEW_LIMITS.diagnosticFrames - 1;
    } catch (error) {
      const errorReceipt = await bounded(
        "geometry-preflight-error-recording",
        () =>
          postArtifact(
            "geometry-preflight-error.json",
            JSON.stringify(previewGeometryErrorV3(error)) + "\n",
          ),
      );
      receipts.push(errorReceipt);
      geometryPreflight = {
        schema: PREVIEW_GEOMETRY_V3.schema,
        scope: PREVIEW_GEOMETRY_V3.scope,
        status: "failed",
        phase: PREVIEW_GEOMETRY_V3.phase,
        error: errorReceipt,
      };
      receipts.push(
        await bounded("geometry-preflight-failure-recording", () =>
          postArtifact(
            "geometry-preflight.json",
            JSON.stringify(geometryPreflight) + "\n",
          ),
        ),
      );
      progress("geometry-preflight");
      throw error;
    }
    receipts.push(
      await bounded("geometry-preflight-recording", () =>
        postArtifact(
          "geometry-preflight.json",
          JSON.stringify(geometryPreflight) + "\n",
        ),
      ),
    );
    for (let index = 0; index < CONTRACT.views.length; index++) {
      const camera = CONTRACT.views[index];
      await bounded(`${camera.id}-camera`, () => app.setCamera(camera));
      await frame(
        PREVIEW_LIMITS.warmupFrames + PREVIEW_LIMITS.diagnosticFrames + index,
      );
      const proof = await bounded(`${camera.id}-presentation-proof`, () =>
        globalThis.__APERTURE_WAIT_GPU__(),
      );
      const blob = await bounded(
        `${camera.id}-canvas-png`,
        () =>
          new Promise((resolve, reject) =>
            app.canvas.toBlob(
              (value) =>
                value?.type === "image/png"
                  ? resolve(value)
                  : reject(
                      new Error("Diagnostic canvas PNG extraction failed"),
                    ),
              "image/png",
            ),
          ),
      );
      const receipt = await bounded(`${camera.id}-recording`, () =>
        postArtifact(`${camera.id}.png`, blob, "image/png"),
      );
      receipts.push(receipt);
      views.push({
        camera,
        screenshot: receipt,
        proof: JSON.parse(JSON.stringify(proof)),
      });
    }
    const result = {
      schema: PREVIEW_SCHEMA,
      scope: "diagnostic-only-not-a-performance-or-quality-score",
      engine: app.engine,
      preview: config.preview,
      limits: PREVIEW_LIMITS,
      contract: CONTRACT,
      elapsedMs: globalThis.performance.now() - start,
      frames,
      views,
      geometryPreflight,
      observations: observer.snapshot(),
      artifacts: receipts,
    };
    receipts.push(
      await bounded("completion-recording", () =>
        postArtifact("preview.json", JSON.stringify(result) + "\n"),
      ),
    );
    globalThis[READY_GLOBAL] = {
      ok: true,
      schema: PREVIEW_SCHEMA,
      scope: result.scope,
      engine: app.engine,
      artifacts: receipts,
    };
    progress("complete");
  } catch (error) {
    const failure = {
      schema: PREVIEW_SCHEMA,
      scope: "diagnostic-only-no-score",
      phase,
      engine: app?.engine ?? config?.engine ?? null,
      elapsedMs: globalThis.performance.now() - start,
      frames,
      views,
      artifacts: receipts,
      geometryPreflight,
      observations: observer?.snapshot(),
      nativeProof: globalThis.__APERTURE_VERIFIED_GPU__
        ? JSON.parse(JSON.stringify(globalThis.__APERTURE_VERIFIED_GPU__))
        : null,
      error: { message: error.message, stack: error.stack },
    };
    try {
      await withDeadline(
        () => postArtifact("failure.json", JSON.stringify(failure) + "\n"),
        10000,
        "failure-evidence",
      );
    } catch {
      /* Runner retains its own failed proof, phase and receipts independently. */
    }
    globalThis[READY_GLOBAL] = {
      ok: false,
      schema: PREVIEW_SCHEMA,
      phase,
      error: error.message,
    };
    progress("failed", { error: error.message });
  }
}

if (typeof globalThis.window !== "undefined") void runDiagnosticPreview();
