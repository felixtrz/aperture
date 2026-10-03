import { WORKER_SETTINGS, CONFIG } from "./contract.mjs";
import {
  inspectFrameCorrespondence,
  inspectConsumedSnapshot,
} from "./frame-proof.mjs";
import { nativeEvidenceBytes } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/native-evidence.mjs";
import { compareNativeUploadBytes } from "../crane-live-edits-20261003/author-a/post-author-byte-diagnostic/gpu-observer.mjs";
export const PIPELINES = Object.freeze({
  directional: "directional",
  cascaded: "directional-cascaded",
  spot: "spot",
  point: "point-array",
});
export const VARIANTS = Object.freeze([
  "live",
  "fresh-baseline",
  "fresh-vertices",
  "fresh-indices",
]);
export function requireValue(condition, message) {
  if (!condition) throw Error(message);
}
// JSON record objects have unordered keys; arrays and all field values remain exact.
export function sameStructure(a, b) {
  if (Object.is(a, b)) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a))
    return (
      a.length === b.length && a.every((value, i) => sameStructure(value, b[i]))
    );
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && sameStructure(a[key], b[key]))
  );
}
export function validateRecord(record, state, previous = null) {
  const { report, proof, identity, gpu, snapshot } = record;
  requireValue(
    record.state.id === state.id && record.assetVersion === state.version,
    "State/revision mismatch",
  );
  requireValue(
    report.ok === true &&
      report.frame === record.frame &&
      snapshot.frame === record.frame,
    "Actual renderSnapshot frame mismatch",
  );
  requireValue(
    report.counts.drawCalls > 0 && report.shadow?.ready === true,
    "Native main/shadow work not ready",
  );
  requireValue(
    proof.native === true &&
      proof.webglAttempts === 0 &&
      proof.submissions > 0 &&
      proof.draws > 0 &&
      proof.errors.length === 0 &&
      proof.deviceLost.length === 0,
    "Native GPU proof failed",
  );
  requireValue(
    proof.devices.length === 1 &&
      proof.canvasWebGPU === 1 &&
      proof.adapters.every((adapter) => adapter.architecture === "swiftshader"),
    "Expected one native SwiftShader device/canvas",
  );
  requireValue(
    identity.entityActive && identity.entityCount === 5,
    "Native ECS identity/count changed",
  );
  requireValue(
    gpu.checks.length === 2 && gpu.checks.every((check) => check.ok),
    "Bound native caster uploads differ from source bytes",
  );
  const coverage = report.shadow.requestCoverage;
  requireValue(
    coverage?.requestedCount === 1 &&
      coverage.servedCount === 1 &&
      coverage.omittedCount === 0,
    "Shadow request not served",
  );
  const reuse = report.resourceReuse;
  requireValue(
    reuse.autoShadowFrameCache?.pipelineKind === PIPELINES[record.mode],
    "Wrong native shadow pipeline",
  );
  requireValue(
    reuse.autoShadowFramesReused === (state.reuse ? 1 : 0) &&
      reuse.autoShadowFramesCreated === (state.reuse ? 0 : 1),
    "Shadow cache create/reuse mismatch",
  );
  const submitted = report.shadow.casterCounts?.submittedDrawCalls;
  requireValue(
    state.reuse ? submitted === 0 : submitted > 0,
    "Shadow submitted caster draw mismatch",
  );
  if (previous) {
    requireValue(
      record.frame > previous.frame &&
        proof.submissions > previous.proof.submissions,
      "No new native frame submission",
    );
    requireValue(
      JSON.stringify(identity) === JSON.stringify(previous.identity),
      "Same-handle ECS identity drift",
    );
    for (const key of [
      "meshDraws",
      "shadowCasterDraws",
      "lights",
      "shadowRequests",
      "bounds",
      "transforms",
      "views",
      "viewMatrices",
    ])
      requireValue(
        sameStructure(snapshot[key], previous.snapshot[key]),
        `Frozen snapshot input changed: ${key}`,
      );
    if (!state.reuse)
      requireValue(
        reuse.autoShadowFrameCache.firstChangedInputSection ===
          "caster-mesh-assets",
        "Mutation invalidated through another input",
      );
  }
  const { worker, reception, completion, runtime } = record;
  requireValue(
    worker && reception && completion && runtime,
    "Missing worker boundary evidence",
  );
  requireValue(
    record.revision === (previous ? previous.revision + 1 : 1),
    "Non-monotonic state revision",
  );
  const gate = inspectFrameCorrespondence(
    state,
    record.revision,
    new Map([[record.frame, worker]]),
    new Map([[record.frame, reception]]),
    { frame: report, snapshot },
    completion.ack,
  );
  requireValue(
    gate.ok && completion.nativeRenderMethodCompletionObserved === true,
    "Worker/received/consumed/completed frame mismatch",
  );
  requireValue(
    runtime.nativeWorkerCount === 1 &&
      runtime.nativeWorkerScope === true &&
      runtime.crossOriginIsolated === true,
    "Missing real native Worker",
  );
  requireValue(
    runtime.transport?.active === "shared-array-buffer" &&
      runtime.transport.fallback === null &&
      runtime.transport.sharedArrayBuffer?.supported === true &&
      worker.publication.transport === "shared-array-buffer" &&
      reception.transport === "shared-array-buffer",
    "Fallback snapshot transport",
  );
  requireValue(
    worker.observedStart?.transport === "shared-array-buffer" &&
      worker.observedStart.sharedHeaderIsNative === true &&
      worker.observedStart.simulationPaused === true,
    "Worker did not receive native SAB/demand start",
  );
  for (const [key, value] of Object.entries(WORKER_SETTINGS))
    requireValue(
      worker.observedStart[key] === value,
      `Wrong effective worker setting: ${key}`,
    );
  requireValue(
    worker.publication.summaryCadence?.fullSummaryIntervalMilliseconds === 16,
    "Wrong full summary cadence",
  );
  requireValue(
    sameStructure(runtime.config, CONFIG) &&
      runtime.useFrameGraph === true &&
      runtime.renderSettings?.requestedSampleCount === 1 &&
      runtime.renderSettings.pixelRatio === 1,
    "Effective render settings drift",
  );
  requireValue(
    sameStructure(worker.identity, identity) &&
      sameStructure(worker.sourceMesh, record.sourceMesh),
    "Worker source/identity evidence drift",
  );
  requireValue(
    worker.assetVersions?.length === 4 &&
      sameStructure(worker.assetVersions, reception.availableAssets),
    "Missing or stale received source assets",
  );
  const delivered = worker.publication.sourceAssets;
  requireValue(
    sameStructure(delivered, reception.deliveredAssets),
    "Worker/received asset version mismatch",
  );
  requireValue(
    delivered.length === (previous ? (state.reuse ? 0 : 1) : 4),
    "Unexpected asset publication count",
  );
  const expectedReplacements = state.version - 1;
  for (const key of [
    "meshAssetReplacements",
    "publishedVertexArrayReplacements",
    "publishedIndexArrayReplacements",
  ])
    requireValue(
      worker.resources[key] === expectedReplacements,
      `Wrong replacement count: ${key}`,
    );
  requireValue(
    inspectConsumedSnapshot([record.sourceMesh], snapshot).every(
      (check) => check.ok,
    ),
    "Actual consumed caster identity/transform mismatch",
  );
  requireValue(
    record.sourceMesh.assetVersion === state.version &&
      reception.sourceMesh?.assetVersion === state.version,
    "Source mesh revision mismatch",
  );
  const sourceViews = [
    ...record.sourceMesh.streams,
    record.sourceMesh.indexBuffer,
  ];
  const receivedViews = [
    ...(reception.sourceMesh?.streams ?? []),
    reception.sourceMesh?.indexBuffer,
  ];
  requireValue(
    sourceViews.length === 2 &&
      receivedViews.length === 2 &&
      gpu.buffers?.length === 2,
    "Missing source/received/upload byte evidence",
  );
  sourceViews.forEach((source, index) => {
    requireValue(
      compareNativeUploadBytes(
        nativeEvidenceBytes(receivedViews[index]),
        source,
      ).ok,
      "Worker/received raw bytes differ",
    );
    requireValue(
      compareNativeUploadBytes(
        new Uint8Array(gpu.buffers[index].fullUploadBytes),
        source,
      ).ok && gpu.buffers[index].nativeBindCalls > 0,
      "Bound upload raw bytes differ",
    );
  });
  requireValue(
    record.capture?.gpuFenceCompleted === true &&
      record.capture.width === 512 &&
      record.capture.height === 512,
    "Missing GPU-fenced capture",
  );
  requireValue(
    runtime.validationErrors?.length === 0,
    "Runtime validation errors",
  );
  return true;
}
