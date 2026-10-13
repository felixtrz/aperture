import {
  CONTRACT,
  SCHEMA,
  READY_GLOBAL,
  requireValue,
  summarize,
  validateSample,
  validateWorkerEligibility,
} from "./contract.mjs";

import { ARTIFACT_PROTOCOL_V2, requireProtocolV2 } from "./protocol-v2.mjs";
import {
  TRIANGLE_ACCOUNTING_V2,
  validateTriangleAccountingV2,
} from "./triangle-accounting-v2.mjs";
import { captureGeometryV2 } from "./geometry-capture-v2.mjs";

const json = (value) => JSON.stringify(value) + "\n";
const clone = (value) => JSON.parse(JSON.stringify(value));
const digest = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (value) => value.toString(16).padStart(2, "0"),
  ).join("");

async function postArtifact(name, body, type = "application/json") {
  const bytes =
    body instanceof Blob
      ? new Uint8Array(await body.arrayBuffer())
      : body instanceof Uint8Array
        ? body
        : new TextEncoder().encode(body);
  const response = await fetch(`/__benchmark/record/${name}`, {
    method: "POST",
    headers: { "Content-Type": type },
    body: bytes,
  });
  const receipt = await response.json();
  requireValue(
    response.ok &&
      receipt.ok &&
      receipt.sha256 === (await digest(bytes)) &&
      receipt.bytes === bytes.length &&
      receipt.path === name,
    `Artifact acknowledgment failed: ${name}`,
  );
  return receipt;
}

async function waitForAdapter() {
  const deadline = performance.now() + 120000;
  while (!globalThis.__AGENT_BENCHMARK__) {
    requireValue(
      performance.now() < deadline,
      "Application did not register benchmark interface",
    );
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  const app = globalThis.__AGENT_BENCHMARK__;
  requireValue(
    ["three", "aperture"].includes(app.engine),
    "Unknown benchmark engine",
  );
  for (const key of ["setCamera", "renderFrame", "inspectGeometry", "dispose"])
    requireValue(
      typeof app[key] === "function",
      `Missing application method: ${key}`,
    );
  await app.ready;
  requireValue(
    app.canvas instanceof HTMLCanvasElement &&
      document.querySelectorAll("canvas").length === 1,
    "Exactly one actual display canvas required",
  );
  requireValue(
    app.canvas.width === CONTRACT.viewport.width &&
      app.canvas.height === CONTRACT.viewport.height &&
      devicePixelRatio === 1,
    "Canvas/viewport/DPR contract differs",
  );
  return app;
}

async function sampleFrame(app, observer, frame) {
  await observer.fence();
  observer.beginIndirectArgumentSample?.();
  const before = observer.snapshot(),
    start = performance.now();
  await app.renderFrame({
    frame,
    deltaSeconds: CONTRACT.deltaSeconds,
    timeSeconds: frame * CONTRACT.deltaSeconds,
  });
  const applicationEnd = performance.now(),
    afterSubmit = observer.snapshot();
  const completedAt = await observer.fence(),
    after = observer.snapshot();
  requireValue(
    after.submissions === afterSubmit.submissions,
    "Uncontrolled submission occurred while fencing requested frame",
  );
  requireValue(
    afterSubmit.lastSubmitAt >= start,
    "Requested frame did not submit native work",
  );
  const sample = {
    frame,
    cpuSubmissionMs: afterSubmit.lastSubmitAt - start,
    applicationPromiseMs: applicationEnd - start,
    queueCompletionLatencyMs: completedAt - afterSubmit.lastSubmitAt,
    endToEndMs: completedAt - start,
  };
  for (const key of [
    "submissions",
    "drawCalls",
    "submittedTriangles",
    "indirectDrawCalls",
    "unknownDirectTriangleDrawCalls",
    "knownIndirectDrawCalls",
    "unknownIndirectDrawCalls",
    "knownIndirectTriangles",
    "nonTriangleDrawCalls",
    "unknownTopologyDrawCalls",
    "unknownCommandBuffers",
    "renderPasses",
    "computePasses",
    "buffersCreated",
    "buffersDestroyed",
    "texturesCreated",
    "texturesDestroyed",
    "renderPipelinesCreated",
  ])
    sample[key] = after[key] - before[key];
  sample.unknownIndirectReasons = Object.fromEntries(
    Object.keys(after.unknownIndirectReasons)
      .map((reason) => [
        reason,
        (after.unknownIndirectReasons[reason] ?? 0) -
          (before.unknownIndirectReasons[reason] ?? 0),
      ])
      .filter(([, count]) => count > 0),
  );
  const argumentReferences = observer.sampleIndirectArgumentReferences();
  sample.nativeIndirectArgumentReferences = argumentReferences.references;
  sample.unretainedKnownIndirectDrawCalls =
    argumentReferences.unretainedKnownDrawCalls;
  sample.submittedTriangleAccounting = {
    schema: TRIANGLE_ACCOUNTING_V2.schema,
    confidence:
      sample.unknownDirectTriangleDrawCalls ||
      sample.unknownIndirectDrawCalls ||
      sample.unknownTopologyDrawCalls ||
      sample.unknownCommandBuffers
        ? "lower-bound"
        : "exact-supported-command-arguments",
    proofStatus: sample.unretainedKnownIndirectDrawCalls
      ? "incomplete"
      : "complete",
  };
  return validateTriangleAccountingV2(validateSample(sample));
}

function capture(canvas) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob?.type === "image/png"
          ? resolve(blob)
          : reject(new Error("Actual canvas PNG capture failed")),
      "image/png",
    ),
  );
}

export async function runMeasurement() {
  const observer = globalThis.__AGENT_NATIVE_OBSERVER__,
    receipts = [],
    warmup = [],
    samples = [],
    views = [];
  let app, geometry, config, beforeMeasured, afterMeasured;
  const progress = (phase, detail = {}) => {
    globalThis.__AGENT_BENCHMARK_PROGRESS__ = {
      schema: SCHEMA,
      phase,
      ...detail,
    };
  };
  try {
    requireValue(
      observer && globalThis.__APERTURE_VERIFIED_GPU__,
      "Pre-boot observation and approved verifier required",
    );
    app = await waitForAdapter();
    config = await (await fetch("/__benchmark/config.json")).json();
    requireValue(
      config.engine === app.engine &&
        JSON.stringify(config.contract) === JSON.stringify(CONTRACT),
      "Frozen engine/settings contract differs",
    );
    requireProtocolV2(config.artifactProtocol);
    await app.setCamera(CONTRACT.views[0]);
    for (let frame = 0; frame < CONTRACT.warmupFrames; frame++) {
      progress("warmup", { frame });
      warmup.push(await sampleFrame(app, observer, frame));
    }
    beforeMeasured = observer.snapshot();
    for (let index = 0; index < CONTRACT.measuredFrames; index++) {
      progress("measuring", { frame: index });
      samples.push(
        await sampleFrame(app, observer, CONTRACT.warmupFrames + index),
      );
    }
    afterMeasured = observer.snapshot();
    progress("geometry-v2");
    requireValue(
      !observer.exportIndirectArgumentProof().capacityExceeded,
      "Native indirect proof metadata capacity exceeded; measured samples retained",
    );
    geometry = await captureGeometryV2(
      app,
      observer,
      receipts,
      postArtifact,
      afterMeasured,
    );
    const workerEligibility = validateWorkerEligibility(
      app.engine,
      beforeMeasured,
      afterMeasured,
    );
    for (let index = 0; index < CONTRACT.views.length; index++) {
      const camera = CONTRACT.views[index];
      progress("view", { view: camera.id });
      await app.setCamera(camera);
      const frame = await sampleFrame(
        app,
        observer,
        CONTRACT.warmupFrames + CONTRACT.measuredFrames + index,
      );
      const proof = clone(await globalThis.__APERTURE_WAIT_GPU__());
      requireValue(
        observer.snapshot().submissions ===
          beforeMeasured.submissions +
            samples.reduce((sum, value) => sum + value.submissions, 0) +
            views.reduce((sum, value) => sum + value.frame.submissions, 0) +
            frame.submissions,
        "Unexpected background rendering between controlled frames",
      );
      const receipt = await postArtifact(
        `${camera.id}.png`,
        await capture(app.canvas),
        "image/png",
      );
      receipts.push(receipt);
      views.push({ camera, frame, proof, screenshot: receipt });
    }
    const argumentCapture = observer.snapshot().indirectArgumentCapture;
    requireValue(
      !observer.exportIndirectArgumentProof().capacityExceeded &&
        argumentCapture?.omittedBufferRecords === 0 &&
        argumentCapture?.incompleteBufferIds.length === 0 &&
        argumentCapture.skippedWrites === 0,
      "Native indirect argument capture/proof capacity exceeded; measured samples retained",
    );
    const timings = Object.fromEntries(
      [
        "cpuSubmissionMs",
        "applicationPromiseMs",
        "queueCompletionLatencyMs",
        "endToEndMs",
      ].map((key) => [key, summarize(samples.map((sample) => sample[key]))]),
    );
    const measurement = {
      schema: SCHEMA,
      artifactProtocol: ARTIFACT_PROTOCOL_V2,
      engine: app.engine,
      trial: config.trial,
      contract: CONTRACT,
      recordedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      timingDefinition:
        "Serial browser elapsed time on native CPU SwiftShader. CPU duration ends at last native queue submit; queue latency ends at all-device native onSubmittedWorkDone. No hardware GPU timestamps or resident-memory claims.",
      warmup,
      samples,
      timings,
      geometry,
      workerEligibility,
      views,
      observationsBeforeMeasured: beforeMeasured,
      observationsAfterMeasured: afterMeasured,
      observationsAfterViews: observer.snapshot(),
      nativeProof: clone(globalThis.__APERTURE_VERIFIED_GPU__),
      artifacts: receipts,
      nativeIndirectArgumentProof: observer.exportIndirectArgumentProof(),
    };
    receipts.push(await postArtifact("measurement.json", json(measurement)));
    // Keep devices alive until the approved runner's final native fence/proof.
    // Browser/context shutdown owns cleanup; explicit app disposal is tested separately.
    globalThis[READY_GLOBAL] = {
      ok: true,
      schema: SCHEMA,
      artifactProtocol: ARTIFACT_PROTOCOL_V2,
      engine: app.engine,
      trial: config.trial,
      measuredFrames: samples.length,
      artifacts: receipts,
    };
    progress("complete");
  } catch (error) {
    const failure = {
      schema: SCHEMA,
      artifactProtocol: ARTIFACT_PROTOCOL_V2,
      engine: app?.engine ?? null,
      warmup,
      samples,
      geometry,
      views,
      artifacts: receipts,
      trial: config?.trial ?? null,
      observationsBeforeMeasured: beforeMeasured,
      observationsAfterMeasured: afterMeasured,
      observations: observer?.snapshot(),
      nativeProof: clone(globalThis.__APERTURE_VERIFIED_GPU__ ?? null),
      nativeIndirectArgumentProof: observer?.exportIndirectArgumentProof?.(),
      error: { message: error.message, stack: error.stack },
    };
    try {
      await postArtifact("failure.json", json(failure));
    } catch {
      /* Runner independently retains failures and server receipts. */
    }
    globalThis[READY_GLOBAL] = { ok: false, error: error.message };
    progress("failed", { error: error.message });
  }
}

if (typeof window !== "undefined") void runMeasurement();
