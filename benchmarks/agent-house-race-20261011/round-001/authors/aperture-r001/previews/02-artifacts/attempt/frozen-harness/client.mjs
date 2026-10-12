import {
  CONTRACT,
  SCHEMA,
  READY_GLOBAL,
  inspectMesh,
  matchPositionStream,
  requireValue,
  summarize,
  validateSample,
  validateWorkerEligibility,
} from "./contract.mjs";

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
  return validateSample(sample);
}

async function captureGeometry(app, observer, receipts) {
  const input = await app.inspectGeometry();
  requireValue(
    Array.isArray(input?.meshes) &&
      input.meshes.length > 0 &&
      input.meshes.length <= 5000,
    "Actual runtime mesh arrays missing or excessive",
  );
  const ids = new Set(),
    unique = new Map(),
    buffers = observer.sealGeometryCapture();
  const meshes = [];
  for (const mesh of input.meshes) {
    requireValue(!ids.has(mesh.id), "Duplicate runtime mesh id");
    ids.add(mesh.id);
    const inspected = inspectMesh(mesh);
    const geometryBytes = new TextEncoder().encode(
      JSON.stringify({
        positions: inspected.positions,
        indices: inspected.indices,
        normals: mesh.normals ? Array.from(mesh.normals) : null,
      }),
    );
    const geometrySha256 = await digest(geometryBytes);
    unique.set(geometrySha256, {
      vertices: inspected.vertices,
      triangles: inspected.authoredTriangles,
    });
    const nativePositionParity = matchPositionStream(
      inspected.positions,
      buffers,
    );
    meshes.push({
      ...inspected,
      normals: mesh.normals ? Array.from(mesh.normals) : undefined,
      geometrySha256,
      nativePositionParity,
    });
  }
  // Preserve successful native upload bytes independently of the author's arrays.
  const nativeUploads = [];
  for (const buffer of buffers) {
    for (let i = 0; i < buffer.segments.length; i++) {
      const segment = buffer.segments[i];
      const receipt = await postArtifact(
        `native-buffer-${String(buffer.id).padStart(5, "0")}-${String(i).padStart(3, "0")}.bin`,
        segment.bytes,
        "application/octet-stream",
      );
      receipts.push(receipt);
      nativeUploads.push({
        bufferId: buffer.id,
        label: buffer.label,
        usage: buffer.usage,
        requestedBytes: buffer.requestedBytes,
        offset: segment.offset,
        captureTruncated: buffer.captureTruncated,
        receipt,
      });
    }
  }
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const mesh of meshes)
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], mesh.bounds.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], mesh.bounds.max[axis]);
    }
  const summary = {
    meshEntries: meshes.length,
    renderInstances: meshes.reduce((sum, mesh) => sum + mesh.instances, 0),
    uniqueGeometryCount: unique.size,
    uniqueAuthoredVertices: [...unique.values()].reduce(
      (sum, item) => sum + item.vertices,
      0,
    ),
    uniqueAuthoredTriangles: [...unique.values()].reduce(
      (sum, item) => sum + item.triangles,
      0,
    ),
    instancedAuthoredTriangles: meshes.reduce(
      (sum, mesh) => sum + mesh.instancedTriangles,
      0,
    ),
    degenerateInstancedTriangles: meshes.reduce(
      (sum, mesh) => sum + mesh.degenerateTriangles,
      0,
    ),
    exactNativePositionStreamMatches: meshes.filter(
      (mesh) => mesh.nativePositionParity.matched,
    ).length,
    missingNormalMeshEntries: meshes.filter((mesh) => !mesh.normalsPresent)
      .length,
    bounds,
    confidence: meshes.every((mesh) => mesh.nativePositionParity.matched)
      ? "actual-native-submitted-vertex-upload-correlated"
      : "runtime-snapshot-with-partial-native-upload-correlation",
    limitations: [
      "Position parity proves an exact uploaded stream in a submitted vertex buffer; it does not prove index, shader-position or world-transform parity. Independent app source audit is required.",
      "Unique geometry deduplicates identical source positions, indices and normals. Submitted triangles include pass and instance multiplicity.",
    ],
  };
  receipts.push(
    await postArtifact(
      "geometry.json",
      json({
        schema: SCHEMA,
        engine: app.engine,
        summary,
        meshes,
        nativeUploads,
      }),
    ),
  );
  return summary;
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
  let app, geometry;
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
    const config = await (await fetch("/__benchmark/config.json")).json();
    requireValue(
      config.engine === app.engine &&
        JSON.stringify(config.contract) === JSON.stringify(CONTRACT),
      "Frozen engine/settings contract differs",
    );
    await app.setCamera(CONTRACT.views[0]);
    for (let frame = 0; frame < CONTRACT.warmupFrames; frame++) {
      progress("warmup", { frame });
      warmup.push(await sampleFrame(app, observer, frame));
    }
    progress("geometry");
    geometry = await captureGeometry(app, observer, receipts);
    const beforeMeasured = observer.snapshot();
    for (let index = 0; index < CONTRACT.measuredFrames; index++) {
      progress("measuring", { frame: index });
      samples.push(
        await sampleFrame(app, observer, CONTRACT.warmupFrames + index),
      );
    }
    const afterMeasured = observer.snapshot();
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
    };
    receipts.push(await postArtifact("measurement.json", json(measurement)));
    // Keep devices alive until the approved runner's final native fence/proof.
    // Browser/context shutdown owns cleanup; explicit app disposal is tested separately.
    globalThis[READY_GLOBAL] = {
      ok: true,
      schema: SCHEMA,
      engine: app.engine,
      trial: config.trial,
      measuredFrames: samples.length,
      artifacts: receipts,
    };
    progress("complete");
  } catch (error) {
    const failure = {
      schema: SCHEMA,
      engine: app?.engine ?? null,
      warmup,
      samples,
      geometry,
      views,
      artifacts: receipts,
      observations: observer?.snapshot(),
      nativeProof: clone(globalThis.__APERTURE_VERIFIED_GPU__ ?? null),
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
