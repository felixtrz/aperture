import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyLaunch, verifyProof } from "../../scripts/verified-webgpu.mjs";
import {
  CONTRACT,
  SCHEMA,
  inspectMesh,
  matchPositionStream,
  requireValue,
  summarize,
  validateSample,
  validateWorkerEligibility,
} from "./contract.mjs";
import { inspectPng, sha256, writeImmutable } from "./recorder.mjs";

import { ARTIFACT_PROTOCOL_V2, requireProtocolV2 } from "./protocol-v2.mjs";
import { checkGeometryEvidenceV2 } from "./geometry-evidence-v2.mjs";
import {
  EXECUTION_VALIDATED,
  verifyOfficialExecution,
} from "./execution-evidence.mjs";

import {
  validateTriangleAccountingV2,
  validateTriangleArgumentProofV2,
} from "./triangle-accounting-v2.mjs";

const SUMMARY_SCHEMA = "aperture.agent-house-summary.v1";
const engines = ["three", "aperture"];
const timingKeys = [
  "cpuSubmissionMs",
  "applicationPromiseMs",
  "queueCompletionLatencyMs",
  "endToEndMs",
];
const nativeKeys = [
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
];
const runtimeFormula =
  "10*(0.75*fastest median trial-median endToEnd/own median trial-median endToEnd + 0.25*fastest median trial-p95 endToEnd/own median trial-p95 endToEnd). Report all CPU submission/queue latency/endToEnd/p95/min/max and native draw/resource/triangle counts separately.";
const authorFormula =
  "10*fastest active recorded author seconds/own active recorded author seconds; disclose total wall and preview waiting separately.";
const stable = (value) =>
  JSON.stringify(value, (_, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );

export function parseSummaryOptions(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = {
        "--round": "roundRoot",
        "--output": "outputPath",
        "--official-execution": "officialExecutionPath",
        "--official-execution-sha256": "officialExecutionSha256",
      }[args[i]],
      value = args[i + 1];
    requireValue(
      key && value && !value.startsWith("--") && options[key] === undefined,
      "Unknown, missing or duplicate summary option",
    );
    requireValue(
      key === "officialExecutionSha256"
        ? /^[a-f0-9]{64}$/.test(value)
        : isAbsolute(value),
      "Summary paths must be absolute and hashes exact SHA256",
    );
    options[key] = value;
  }
  requireValue(
    options.roundRoot && options.outputPath,
    "--round and --output are required",
  );
  requireValue(
    Boolean(options.officialExecutionPath) ===
      Boolean(options.officialExecutionSha256),
    "--official-execution and --official-execution-sha256 must be paired",
  );
  return options;
}

/** Semantic multiset: full instance transforms, without volatile GPU/mesh IDs. */
export function semanticGeometryDigest(meshes) {
  const entries = meshes
    .map((mesh) => ({
      geometrySha256: mesh.geometrySha256,
      matrices: mesh.matrices
        .map((matrix) => Array.from(matrix))
        .sort((a, b) => stable(a).localeCompare(stable(b))),
    }))
    .sort((a, b) => stable(a).localeCompare(stable(b)));
  return sha256(Buffer.from(stable(entries)));
}

async function bytesAt(root, path) {
  requireValue(
    typeof path === "string" &&
      path.length > 0 &&
      !isAbsolute(path) &&
      !path.includes("\\") &&
      !path.includes("\0") &&
      !path.split("/").some((part) => !part || part === "." || part === ".."),
    "Invalid evidence path",
  );
  const absolute = resolve(root, path),
    canonical = await realpath(absolute);
  requireValue(
    canonical.startsWith((await realpath(root)) + sep),
    "Evidence path escapes retained root",
  );
  const stat = await lstat(absolute);
  requireValue(
    stat.isFile() && !stat.isSymbolicLink() && stat.size <= 128 * 1024 * 1024,
    "Evidence must be a bounded regular file",
  );
  return readFile(absolute);
}

async function jsonAt(root, path) {
  const bytes = await bytesAt(root, path);
  return {
    bytes,
    value: JSON.parse(bytes.toString("utf8")),
    sha256: sha256(bytes),
  };
}

async function verifyBytes(root, pin) {
  requireValue(
    pin &&
      Number.isInteger(pin.bytes) &&
      pin.bytes >= 0 &&
      /^[a-f0-9]{64}$/.test(pin.sha256),
    "Invalid evidence hash receipt",
  );
  const bytes = await bytesAt(root, pin.path);
  requireValue(
    bytes.length === pin.bytes && sha256(bytes) === pin.sha256,
    `Evidence hash/size mismatch: ${pin.path}`,
  );
  return bytes;
}

async function checkRetainedInputs(root, inputs, frozenHarness) {
  for (const [kind, pins, prefix] of [
    ["frozen-app", inputs.inputs, "frozen-app/"],
    ["frozen-harness", inputs.harness, "frozen-harness/"],
  ]) {
    const inventory = inputs.retainedInputs?.[kind];
    requireValue(
      inventory && stable(Object.keys(inventory)) === stable(Object.keys(pins)),
      "Retained source inventory differs",
    );
    for (const [key, pin] of Object.entries(pins)) {
      const retained = inventory[key];
      requireValue(
        retained.path === prefix + key.replace(/^\//, "") &&
          retained.bytes === pin.bytes &&
          retained.sha256 === pin.sha256,
        "Retained source provenance differs",
      );
      await verifyBytes(root, retained);
      if (kind === "frozen-harness") {
        const frozen = frozenHarness[`tools/agent-benchmark/${key}`];
        requireValue(
          frozen && frozen.sha256 === pin.sha256 && frozen.bytes === pin.bytes,
          `Trial harness differs from dispatch freeze: ${key}`,
        );
      }
    }
  }
  requireValue(
    inputs.retainedInputs.servedIndex.path === "served-index.html",
    "Served HTML copy missing",
  );
  await verifyBytes(root, inputs.retainedInputs.servedIndex);
}

async function checkGeometry(root, record, measurement) {
  requireValue(
    record.schema === SCHEMA &&
      record.engine === measurement.engine &&
      Array.isArray(record.meshes) &&
      record.meshes.length > 0,
    "Runtime geometry evidence missing",
  );
  const buffers = new Map(),
    unique = new Map(),
    meshes = [],
    ids = new Set();
  for (const upload of record.nativeUploads) {
    const bytes = new Uint8Array(await verifyBytes(root, upload.receipt));
    requireValue(
      Number.isInteger(upload.bufferId) &&
        Number.isInteger(upload.offset) &&
        upload.offset >= 0 &&
        upload.offset + bytes.length <= upload.requestedBytes,
      "Invalid native upload bounds",
    );
    let buffer = buffers.get(upload.bufferId);
    if (!buffer) {
      buffer = {
        id: upload.bufferId,
        usage: upload.usage,
        requestedBytes: upload.requestedBytes,
        segments: [],
      };
      buffers.set(upload.bufferId, buffer);
    }
    requireValue(
      buffer.usage === upload.usage &&
        buffer.requestedBytes === upload.requestedBytes &&
        measurement.observationsAfterMeasured.submittedVertexBufferIds.includes(
          upload.bufferId,
        ),
      "Native upload is not a submitted vertex buffer",
    );
    buffer.segments.push({ offset: upload.offset, bytes });
  }
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const mesh of record.meshes) {
    requireValue(!ids.has(mesh.id), "Duplicate geometry evidence id");
    ids.add(mesh.id);
    const inspected = inspectMesh({
      ...mesh,
      worldMatrix: mesh.matrices?.[0],
      instances: mesh.matrices,
    });
    for (const key of [
      "vertices",
      "authoredTriangles",
      "instances",
      "instancedTriangles",
      "degenerateTriangles",
      "normalsPresent",
      "bounds",
    ])
      requireValue(
        stable(inspected[key]) === stable(mesh[key]),
        `Authored geometry count/bounds mismatch: ${mesh.id}/${key}`,
      );
    const geometrySha256 = sha256(
      Buffer.from(
        JSON.stringify({
          positions: inspected.positions,
          indices: inspected.indices,
          normals: mesh.normals ?? null,
        }),
      ),
    );
    requireValue(
      geometrySha256 === mesh.geometrySha256,
      "Actual geometry array hash mismatch",
    );
    unique.set(geometrySha256, {
      vertices: inspected.vertices,
      triangles: inspected.authoredTriangles,
    });
    const parity = matchPositionStream(inspected.positions, [
      ...buffers.values(),
    ]);
    requireValue(
      stable(parity) === stable(mesh.nativePositionParity),
      `Native position parity mismatch: ${mesh.id}`,
    );
    meshes.push({ ...inspected, geometrySha256, nativePositionParity: parity });
    for (let axis = 0; axis < 3; axis++) {
      bounds.min[axis] = Math.min(bounds.min[axis], inspected.bounds.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], inspected.bounds.max[axis]);
    }
  }
  const result = {
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
  };
  for (const [key, value] of Object.entries(result))
    requireValue(
      stable(record.summary[key]) === stable(value) &&
        stable(measurement.geometry[key]) === stable(value),
      `Geometry summary mismatch: ${key}`,
    );
  return {
    ...result,
    uniqueGeometryHashes: [...unique.keys()].sort(),
    semanticGeometrySha256: semanticGeometryDigest(meshes),
    limitations: record.summary.limitations,
    independentlyRecomputed: true,
  };
}

async function validateTrial(root, engine, trial, method, frozenHarness) {
  const outcome = await jsonAt(root, "outcome.json"),
    inputs = await jsonAt(root, "inputs.json"),
    receipts = await jsonAt(root, "receipts.json");
  requireValue(
    outcome.value.schema === SCHEMA &&
      inputs.value.schema === SCHEMA &&
      receipts.value.schema === SCHEMA,
    "Trial schema differs",
  );
  requireValue(
    outcome.value.inputManifestSha256 === inputs.sha256 &&
      outcome.value.receiptManifestSha256 === receipts.sha256,
    "Outcome manifest hash parity failed",
  );
  requireValue(
    inputs.value.engine === engine &&
      inputs.value.trial === trial &&
      stable(inputs.value.contract) === stable(CONTRACT),
    "Trial input engine/settings differs",
  );
  const protocol = inputs.value.artifactProtocol;
  if (protocol) {
    requireProtocolV2(protocol);
    requireProtocolV2(outcome.value.artifactProtocol);
    requireProtocolV2(receipts.value.artifactProtocol);
  } else
    requireValue(
      !outcome.value.artifactProtocol && !receipts.value.artifactProtocol,
      "Mixed artifact protocol provenance",
    );
  const selectedNativeKeys = protocol
    ? [
        ...nativeKeys,
        "unknownDirectTriangleDrawCalls",
        "knownIndirectDrawCalls",
        "unknownIndirectDrawCalls",
        "knownIndirectTriangles",
      ]
    : nativeKeys;
  await checkRetainedInputs(root, inputs.value, frozenHarness);
  const acknowledged = new Map();
  for (const receipt of receipts.value.receipts) {
    requireValue(
      receipt.ok === true && !acknowledged.has(receipt.path),
      "Invalid/duplicate artifact acknowledgment",
    );
    await verifyBytes(root, receipt);
    acknowledged.set(receipt.path, receipt);
  }
  requireValue(
    outcome.value.status === "passed" &&
      outcome.value.browserStatus === "passed" &&
      receipts.value.failures.length === 0,
    "Recorded trial failed; preserved without score substitution",
  );
  const measurement = await jsonAt(root, "measurement.json"),
    renderer = await jsonAt(root, "verified-runner.json"),
    geometry = await jsonAt(
      root,
      protocol ? ARTIFACT_PROTOCOL_V2.geometryManifest : "geometry.json",
    );
  const record = measurement.value;
  if (protocol) requireProtocolV2(record.artifactProtocol);
  else
    requireValue(
      !record.artifactProtocol,
      "Mixed measurement protocol provenance",
    );
  requireValue(
    record.schema === SCHEMA &&
      record.engine === engine &&
      record.trial === trial &&
      stable(record.contract) === stable(CONTRACT),
    "Measurement engine/settings differs",
  );
  requireValue(
    record.warmup.length === CONTRACT.warmupFrames &&
      record.samples.length === CONTRACT.measuredFrames &&
      method.trialsPerEngine === 3,
    "Frozen frame/trial count differs",
  );
  for (const [index, sample] of [
    ...record.warmup,
    ...record.samples,
  ].entries()) {
    validateSample(sample);
    if (protocol) validateTriangleAccountingV2(sample);
    requireValue(
      sample.frame === index,
      "Raw samples missing, reordered or duplicated",
    );
    for (const key of selectedNativeKeys)
      requireValue(
        Number.isInteger(sample[key]) && sample[key] >= 0,
        `Invalid native sample count: ${key}`,
      );
  }
  if (protocol) validateTriangleArgumentProofV2(record);
  const stats = Object.fromEntries(
    timingKeys.map((key) => [
      key,
      summarize(record.samples.map((sample) => sample[key])),
    ]),
  );
  requireValue(
    stable(record.timings) === stable(stats),
    "Timing summaries differ from raw samples",
  );
  for (const key of [
    ...(protocol
      ? [
          "unknownDirectTriangleDrawCalls",
          "knownIndirectDrawCalls",
          "unknownIndirectDrawCalls",
          "knownIndirectTriangles",
        ]
      : []),
    "submissions",
    "drawCalls",
    "submittedTriangles",
    "renderPasses",
    "computePasses",
    "unknownCommandBuffers",
  ])
    requireValue(
      record.observationsAfterMeasured[key] -
        record.observationsBeforeMeasured[key] ===
        record.samples.reduce((sum, sample) => sum + sample[key], 0),
      `Native per-frame correlation failed: ${key}`,
    );
  const eligibility = validateWorkerEligibility(
    engine,
    record.observationsBeforeMeasured,
    record.observationsAfterMeasured,
  );
  requireValue(
    stable(record.workerEligibility) === stable(eligibility),
    "Worker eligibility evidence differs",
  );
  requireValue(
    renderer.value.status === "passed" &&
      stable(renderer.value.viewport) === stable(CONTRACT.viewport) &&
      renderer.value.sceneStatus?.ok === true &&
      renderer.value.sceneStatus.measuredFrames === CONTRACT.measuredFrames,
    "Verified renderer completion/viewport differs",
  );
  verifyLaunch(
    renderer.value.launch.requested,
    renderer.value.launch.actualArgv,
  );
  verifyProof(renderer.value.proof, renderer.value.errors);
  verifyProof(record.nativeProof);
  requireValue(
    renderer.value.proof.submissions >= record.nativeProof.submissions &&
      renderer.value.proof.draws >= record.nativeProof.draws,
    "Final proof regressed",
  );
  requireValue(
    record.views.length === CONTRACT.views.length &&
      record.artifacts.length + 1 === acknowledged.size &&
      acknowledged.has("measurement.json"),
    "Capture/artifact inventory incomplete",
  );
  for (const receipt of record.artifacts)
    requireValue(
      stable(acknowledged.get(receipt.path)) === stable(receipt),
      "Measurement receipt differs from recorder acknowledgment",
    );
  for (const [index, view] of record.views.entries()) {
    requireValue(
      stable(view.camera) === stable(CONTRACT.views[index]) &&
        view.screenshot.path === `${view.camera.id}.png` &&
        stable(acknowledged.get(view.screenshot.path)) ===
          stable(view.screenshot),
      "Frozen camera/capture provenance differs",
    );
    validateSample(view.frame);
    verifyProof(view.proof);
    const inspection = inspectPng(
      await verifyBytes(root, view.screenshot),
      CONTRACT.viewport,
    );
    requireValue(
      stable(inspection) === stable(view.screenshot.inspection),
      "Capture pixel inspection differs",
    );
  }
  const geometrySummary = protocol
    ? await checkGeometryEvidenceV2(root, geometry.value, record, verifyBytes)
    : await checkGeometry(root, geometry.value, record);
  return {
    status: "validated",
    artifactProtocol: protocol?.schema ?? "aperture.agent-house-artifacts.v1",
    engine,
    trial,
    path: root,
    hashes: {
      outcome: outcome.sha256,
      inputs: inputs.sha256,
      receipts: receipts.sha256,
      measurement: measurement.sha256,
      renderer: renderer.sha256,
      geometry: geometry.sha256,
    },
    appInputs: inputs.value.inputs,
    harnessInputs: inputs.value.harness,
    timing: stats,
    nativeCounts: Object.fromEntries(
      selectedNativeKeys.map((key) => [
        key,
        summarize(record.samples.map((sample) => sample[key])),
      ]),
    ),
    resources: {
      before: record.observationsBeforeMeasured,
      after: record.observationsAfterMeasured,
    },
    geometry: geometrySummary,
    workerEligibility: eligibility,
    captures: record.views.map((view) => ({
      camera: view.camera,
      screenshot: view.screenshot,
    })),
    warmupSamples: record.warmup,
    samples: record.samples,
    ...(protocol
      ? { nativeIndirectArgumentProof: record.nativeIndirectArgumentProof }
      : {}),
  };
}

async function invalidTrial(root, engine, trial, error) {
  const result = {
    status: "invalid-or-failed",
    engine,
    trial,
    path: root,
    error: error.message,
  };
  for (const name of ["outcome.json", "failure.json", "measurement.json"]) {
    try {
      const artifact = await jsonAt(root, name);
      result[name] = {
        sha256: artifact.sha256,
        ...(name === "measurement.json" || name === "failure.json"
          ? {
              warmupSamples: artifact.value.warmup ?? [],
              samples: artifact.value.samples ?? [],
              error: artifact.value.error ?? null,
            }
          : { outcome: artifact.value }),
      };
    } catch (failure) {
      result[name] = { unavailable: failure.message };
    }
  }
  return result;
}

async function authorAuditRoot(roundRoot, lane) {
  for (const candidate of [
    resolve(roundRoot, "author-audits", lane),
    resolve(roundRoot, "authors", lane, "audit-final"),
  ]) {
    let stat;
    try {
      stat = await lstat(candidate);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    requireValue(
      stat.isDirectory() &&
        !stat.isSymbolicLink() &&
        (await realpath(candidate)) === candidate,
      "Author audit directory must contain no symlinks",
    );
    return candidate;
  }
  throw new Error("Independent author audit directory is missing");
}

async function readAuthor(roundRoot, lane, engine, trials, method) {
  const root = resolve(roundRoot, "authors", lane),
    finish = await jsonAt(root, "finish.json");
  const auditRoot = await authorAuditRoot(roundRoot, lane);
  const record = finish.value;
  requireValue(
    record.schema === "aperture.author-transcript.v1" &&
      record.engine === engine &&
      record.lane === lane &&
      record.runningProcesses.length === 0,
    "Author finish provenance/process state differs",
  );
  for (const key of [
    "elapsedSeconds",
    "previewWaitSeconds",
    "activeBudgetElapsedSeconds",
  ])
    requireValue(
      Number.isFinite(record[key]) && record[key] >= 0,
      "Invalid recorded author timing",
    );
  requireValue(
    record.activeBudgetElapsedSeconds > 0 &&
      Math.abs(
        record.elapsedSeconds -
          record.previewWaitSeconds -
          record.activeBudgetElapsedSeconds,
      ) < 1e-6,
    "Author wall/active/preview timings do not reconcile",
  );
  const files = new Map();
  for (const file of record.files) {
    requireValue(!files.has(file.path), "Duplicate author source file");
    await verifyBytes(auditRoot, {
      ...file,
      path: `source/${file.path}`,
    });
    files.set(file.path, file);
  }
  for (const trial of trials.filter((trial) => trial.status === "validated"))
    for (const [path, pin] of Object.entries(trial.appInputs)) {
      const file = files.get("dist" + path);
      requireValue(
        file && file.sha256 === pin.sha256 && file.bytes === pin.bytes,
        `Final trial build differs from author finish: ${path}`,
      );
    }
  const audit = await jsonAt(auditRoot, "audit.json");
  requireValue(
    audit.value.schema === "aperture.author-audit.v1" &&
      audit.value.status === "verified" &&
      audit.value.lane === lane &&
      audit.value.engine === engine &&
      audit.value.finishSha256 === finish.sha256 &&
      audit.value.referenceSha256 === method.referenceSha256,
    "Independent author audit provenance differs",
  );
  for (const key of [
    "publicEventHashChain",
    "commandRecordAndOutputParity",
    "publicPromptAndReferencePins",
    "monotonicBudgetWaitAccounting",
    "finishedWorkspaceSourceHashes",
    "retainedCopiesReadBack",
  ])
    requireValue(
      audit.value.verificationChecks?.[key] === true,
      `Independent author audit check incomplete: ${key}`,
    );
  requireValue(
    audit.value.sourceFileCount === files.size &&
      stable(audit.value.sourceFiles) === stable(record.files),
    "Independent author source inventory differs",
  );
  for (const key of [
    "elapsedSeconds",
    "previewWaitSeconds",
    "activeBudgetElapsedSeconds",
  ])
    requireValue(
      Math.abs(audit.value[key] - record[key]) < 1e-6,
      "Independent author audit timing differs",
    );
  requireValue(
    audit.value.budgetSeconds === method.authorBudgetSeconds,
    "Independent author budget differs from frozen method",
  );
  requireValue(
    record.previewsRequested <= method.previewAllowance,
    "Preview allowance exceeded",
  );
  for (const [path, pin] of Object.entries(audit.value.retainedFiles))
    await verifyBytes(auditRoot, { ...pin, path });
  const start = await jsonAt(auditRoot, "public-records/start.json");
  requireValue(
    start.sha256 === audit.value.startSha256 &&
      start.value.engine === engine &&
      start.value.lane === lane &&
      Number.isSafeInteger(record.finishedMonotonicNs) &&
      Number.isSafeInteger(start.value.startedMonotonicNs) &&
      Math.abs(
        (record.finishedMonotonicNs - start.value.startedMonotonicNs) / 1e9 -
          record.elapsedSeconds,
      ) < 1e-6,
    "Recorded author monotonic elapsed time differs",
  );
  // Keep audit facts visible; successful byte/transcript audit is not semantic source approval.
  return {
    status: "validated-source-and-time",
    lane,
    finishSha256: finish.sha256,
    auditSha256: audit.sha256,
    auditRoot,
    audit: audit.value,
    authorRawSeconds: record.elapsedSeconds,
    authorActiveSeconds: record.activeBudgetElapsedSeconds,
    authorPreviewWaitingSeconds: record.previewWaitSeconds,
    activeBudgetOverrunSeconds: Math.max(
      0,
      record.activeBudgetElapsedSeconds - method.authorBudgetSeconds,
    ),
    previewsRequested: record.previewsRequested,
    preservedSourceFiles: files.size,
    semanticSourceAudit: "pending-independent-architecture-and-geometry-review",
  };
}

/** Formula calculation only; formal callers separately require supervision and eligibility. */
export function componentScores(engineResults, method) {
  requireValue(
    method.runtimeScore === runtimeFormula &&
      method.authorTimeScore === authorFormula,
    "Unsupported or changed frozen scoring formula",
  );
  const own = Object.fromEntries(
    engines.map((engine) => {
      const entry = engineResults[engine];
      requireValue(
        entry.trials.length === 3 &&
          entry.trials.every((trial) => trial.status === "validated") &&
          entry.author?.status === "validated-source-and-time",
        "Component scores require all six valid trials and authentic finish evidence",
      );
      return [
        engine,
        {
          median: summarize(
            entry.trials.map((trial) => trial.timing.endToEndMs.median),
          ).median,
          p95: summarize(
            entry.trials.map((trial) => trial.timing.endToEndMs.p95),
          ).median,
          active: entry.author.authorActiveSeconds,
        },
      ];
    }),
  );
  requireValue(
    Object.values(own).every(
      (entry) => entry.median > 0 && entry.p95 > 0 && entry.active > 0,
    ),
    "Positive observed durations required for ratio scores",
  );
  const fastestMedian = Math.min(
      ...Object.values(own).map((entry) => entry.median),
    ),
    fastestP95 = Math.min(...Object.values(own).map((entry) => entry.p95)),
    fastestActive = Math.min(
      ...Object.values(own).map((entry) => entry.active),
    );
  return Object.fromEntries(
    engines.map((engine) => [
      engine,
      {
        runtime:
          10 *
          ((0.75 * fastestMedian) / own[engine].median +
            (0.25 * fastestP95) / own[engine].p95),
        authoringTime: (10 * fastestActive) / own[engine].active,
        visual: null,
        geometry: null,
        combined: null,
        status:
          "provisional-components-pending-independent-quality-eligibility",
      },
    ]),
  );
}

async function unfinishedAuthor(roundRoot, lane, error) {
  const result = { status: "invalid-or-unfinished", error: error.message };
  try {
    const finish = await jsonAt(
      resolve(roundRoot, "authors", lane),
      "finish.json",
    );
    result.finishSha256 = finish.sha256;
    result.unverifiedRecordedTiming = {
      authorRawSeconds: finish.value.elapsedSeconds,
      authorActiveSeconds: finish.value.activeBudgetElapsedSeconds,
      authorPreviewWaitingSeconds: finish.value.previewWaitSeconds,
      limitation:
        "Raw finish values retained despite incomplete audit; excluded from component scores.",
    };
  } catch (failure) {
    result.finishUnavailable = failure.message;
  }
  return result;
}

export async function summarizeRound(
  roundRoot,
  { officialExecutionPath, officialExecutionSha256 } = {},
) {
  const round = /round-(\d{3})$/.exec(roundRoot);
  requireValue(round, "Round root must end in round-NNN");
  const raceRoot = dirname(roundRoot),
    method = await jsonAt(raceRoot, "method.json"),
    freeze = await jsonAt(raceRoot, `freezes/round-${round[1]}-inputs.json`);
  const methodPins = Object.entries(freeze.value.files).filter(([path]) =>
    path.endsWith("/method.json"),
  );
  requireValue(
    methodPins.length === 1 &&
      methodPins[0][1].sha256 === method.sha256 &&
      methodPins[0][1].bytes === method.bytes.length &&
      method.value.schema === "aperture.house-race-method.v1" &&
      method.value.trialsPerEngine === 3,
    "Frozen method provenance differs",
  );
  requireValue(
    method.value.runtimeScore === runtimeFormula &&
      method.value.authorTimeScore === authorFormula,
    "Unsupported frozen score formulas",
  );
  const result = {
    schema: SUMMARY_SCHEMA,
    recordedAt: new Date().toISOString(),
    roundRoot,
    methodSha256: method.sha256,
    dispatchFreezeSha256: freeze.sha256,
    method: method.value,
    engines: {},
    allAttempts: [],
    validationErrors: [],
    scores: null,
    visualJudging: "pending-independent-blinded-judge-records",
    geometryJudging:
      "pending-independent-blinded-judge-records-and-semantic-source-audit",
    combinedJudging: "pending-quality-eligibility",
    limitations: [
      "This offline analysis validates surviving bytes and recomputes facts; it does not re-attest a terminated browser or replace the live verified route.",
      "Serial CPU SwiftShader timings are not physical GPU timings or unfenced production throughput.",
      "Position-upload correlation does not prove index/shader/world-transform correctness. Preserved source requires independent semantic audit.",
    ],
  };
  for (const engine of engines) {
    const trials = [];
    for (let trial = 1; trial <= 3; trial++) {
      const root = resolve(
        roundRoot,
        "trials",
        engine,
        `trial-${String(trial).padStart(2, "0")}`,
      );
      try {
        trials.push(
          await validateTrial(
            root,
            engine,
            trial,
            method.value,
            freeze.value.provenance.inputs,
          ),
        );
      } catch (error) {
        trials.push(await invalidTrial(root, engine, trial, error));
        result.validationErrors.push({ engine, trial, error: error.message });
      }
    }
    const entry = { trials, author: null, aggregateTiming: null };
    result.engines[engine] = entry;
    try {
      entry.author = await readAuthor(
        roundRoot,
        `${engine}-r${round[1]}`,
        engine,
        trials,
        method.value,
      );
    } catch (error) {
      entry.author = await unfinishedAuthor(
        roundRoot,
        `${engine}-r${round[1]}`,
        error,
      );
      result.validationErrors.push({
        engine,
        author: true,
        error: error.message,
      });
    }
    const valid = trials.filter((trial) => trial.status === "validated");
    if (valid.length === 3) {
      if (
        !valid.every(
          (trial) =>
            stable(trial.appInputs) === stable(valid[0].appInputs) &&
            stable(trial.harnessInputs) === stable(valid[0].harnessInputs) &&
            stable(trial.geometry) === stable(valid[0].geometry),
        )
      )
        result.validationErrors.push({
          engine,
          error: "App/harness/geometry changed across frozen serial trials",
        });
      else
        entry.aggregateTiming = Object.fromEntries(
          timingKeys.map((key) => [
            key,
            {
              medianOfTrialMedians: summarize(
                valid.map((trial) => trial.timing[key].median),
              ).median,
              medianOfTrialP95: summarize(
                valid.map((trial) => trial.timing[key].p95),
              ).median,
              trialMedians: valid.map((trial) => trial.timing[key].median),
              trialP95: valid.map((trial) => trial.timing[key].p95),
            },
          ]),
        );
    }
    try {
      for (const directory of await readdir(
        resolve(roundRoot, "trials", engine),
        { withFileTypes: true },
      ))
        if (directory.isDirectory()) {
          const path = relative(
              roundRoot,
              resolve(roundRoot, "trials", engine, directory.name),
            )
              .split(sep)
              .join("/"),
            selected = /^trial-0[123]$/.test(directory.name);
          const inventory = { engine, path, selected };
          if (!selected) {
            const additional = await invalidTrial(
              resolve(roundRoot, path),
              engine,
              null,
              new Error(
                "Additional attempt outside the frozen three-trial selection",
              ),
            );
            Object.assign(inventory, additional);
            result.validationErrors.push({
              engine,
              error:
                "Additional trial attempts exist; automatic selection/scoring refused",
              path,
            });
          }
          result.allAttempts.push(inventory);
        }
    } catch (error) {
      result.validationErrors.push({
        engine,
        error: `Attempt inventory unavailable: ${error.message}`,
      });
    }
  }
  const protocols = new Set(
    Object.values(result.engines).flatMap((entry) =>
      entry.trials
        .filter((trial) => trial.status === "validated")
        .map((trial) => trial.artifactProtocol),
    ),
  );
  if (protocols.size > 1)
    result.validationErrors.push({
      error: "Mixed v1/v2 artifact protocols across engines or trials",
    });
  result.artifactProtocol = protocols.size === 1 ? [...protocols][0] : null;
  if (
    officialExecutionPath !== undefined ||
    officialExecutionSha256 !== undefined
  ) {
    result.executionEvidence = await verifyOfficialExecution({
      roundRoot,
      executionPath: officialExecutionPath,
      executionSha256: officialExecutionSha256,
      engines: result.engines,
      methodSha256: result.methodSha256,
      dispatchFreezeSha256: result.dispatchFreezeSha256,
    });
    result.validationErrors.push(
      ...result.executionEvidence.validationErrors.map((item) => ({
        ...item,
        officialExecution: true,
      })),
    );
  } else {
    result.executionEvidence = {
      status: "not-provided",
      operations: [],
      validationErrors: [],
      scope:
        "App artifacts only; official wrapper completion is not established and formal components are withheld.",
    };
  }
  if (
    result.validationErrors.length === 0 &&
    result.executionEvidence.status === EXECUTION_VALIDATED
  )
    result.scores = componentScores(result.engines, method.value);
  result.status = result.validationErrors.length
    ? "incomplete-or-invalid-evidence"
    : result.executionEvidence.status === EXECUTION_VALIDATED
      ? "validated-components-pending-independent-judging"
      : "app-artifacts-validated-unscored";
  return result;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const options = parseSummaryOptions(process.argv.slice(2)),
      report = await summarizeRound(options.roundRoot, options);
    await writeImmutable(
      options.outputPath,
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        status: report.status,
        outputPath: options.outputPath,
        validationErrors: report.validationErrors.length,
      }),
    );
    if (report.validationErrors.length) process.exitCode = 1;
  } catch (error) {
    console.error(error.stack ?? error);
    process.exitCode = 1;
  }
}
