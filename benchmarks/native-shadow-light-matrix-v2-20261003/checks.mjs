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
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((value, i) => sameStructure(value, b[i]));
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameStructure(a[key], b[key]));
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
      record.frame === previous.frame + 1 &&
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
  return true;
}
