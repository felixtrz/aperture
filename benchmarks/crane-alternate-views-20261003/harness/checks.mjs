/** Inherited gates plus composition/no-op/raw-byte fail-closed gates. */
import { validateCameraEvidence } from '../camera-proof.mjs';
export * from "./base-checks.mjs";
import * as base from "./base-checks.mjs";
import { nativeEvidenceBytes } from "../author-a/native-evidence.mjs";
import { inspectSemantics } from "../semantics.mjs";
export function validateRawEvidence(evidence, engine) {
  for (const mesh of evidence.nativeGeometry.meshes) {
    if (engine === "aperture") {
      for (const stream of mesh.streams) nativeEvidenceBytes(stream);
      if (mesh.indexBuffer) nativeEvidenceBytes(mesh.indexBuffer);
    } else {
      const source = evidence.sourceGeometry.meshes.find(
        (value) => value.name === mesh.name,
      );
      base.requireValue(source, `Missing source mesh: ${mesh.name}`);
      for (const stream of mesh.streams) {
        const semantic = {
          position: "positions",
          normal: "normals",
          index: "indices",
        }[stream.semantic];
        const raw = source.rawStreams?.find(
          (value) => value.semantic === semantic,
        );
        base.requireValue(
          raw &&
            Array.isArray(stream.rawBytes) &&
            stream.rawBytes.length === stream.byteLength &&
            stream.rawBytes.every(
              (n) => Number.isInteger(n) && n >= 0 && n <= 255,
            ),
          `Missing raw native/source stream: ${mesh.name}`,
        );
        base.requireValue(
          base.canonical(raw.rawBytes) === base.canonical(stream.rawBytes),
          `Native/source raw bytes differ: ${mesh.name}:${semantic}`,
        );
      }
      base.requireValue(
        mesh.streams.some((s) => s.semantic === "position") &&
          mesh.streams.some((s) => s.semantic === "index"),
        `Missing GPU stream: ${mesh.name}`,
      );
    }
  }
}
export function validateTransport(transport) {
  base.requireValue(
    transport?.active === "shared-array-buffer" &&
      transport.fallback === null &&
      transport.sharedArrayBuffer?.supported === true,
    "Fallback snapshot transport",
  );
}
export function validateEvidence(evidence, state, receipt) {
  base.validateEvidence(evidence, state, receipt);
  const engine = evidence.resources.worker ? "aperture" : "threejs";
  validateCameraEvidence(evidence, state, receipt, engine);
  validateRawEvidence(evidence, engine);
  if (engine === "aperture") validateTransport(evidence.transport);
  if (state.index === 0) {
    if (engine === "aperture")
      base.requireValue(
        evidence.resources.worker.meshAssetReplacements === 0,
        "Fresh constructor replaced mesh assets before first state",
      );
    else
      base.requireValue(
        evidence.resources.nativeObjects.inPlaceAttributeWrites === 0 &&
          evidence.resources.nativeObjects.matrixUpdates === 0,
        "Fresh constructor warmed edits before first state",
      );
  }
  const semantics = inspectSemantics(
    engine,
    evidence.sourceGeometry,
    evidence.nativeGeometry.meshes,
  );
  base.requireValue(
    semantics.ok,
    `Combined parameter semantics failed: ${JSON.stringify(semantics.checks.filter((c) => !c.ok))}`,
  );
  return evidence;
}
export function validateTransition(evidence, state, previous, engine) {
  if (!previous) {
    base.requireValue(state.index === 0, "Missing prior state");
    return;
  }
  base.requireValue(
    evidence.revision === previous.revision + 1,
    "Nonmonotonic evidence revision",
  );
  const same =
    base.canonical(base.geometryComparable(evidence)) ===
    base.canonical(base.geometryComparable(previous));
  if (state.noop) {
    base.requireValue(same, "No-op changed native geometry/raw bytes");
    const before =
      engine === "aperture"
        ? previous.resources.worker
        : previous.resources.nativeObjects;
    const after =
      engine === "aperture"
        ? evidence.resources.worker
        : evidence.resources.nativeObjects;
    const keys =
      engine === "aperture"
        ? [
            "meshAssetReplacements",
            "publishedVertexArrayReplacements",
            "publishedIndexArrayReplacements",
            "entityCreateCalls",
            "entityDestroyCalls",
          ]
        : [
            "geometriesCreated",
            "geometryReplacements",
            "attributesCreated",
            "attributeReplacements",
            "inPlaceAttributeWrites",
            "matrixUpdates",
            "meshesCreated",
            "geometryDisposeCalls",
          ];
    for (const key of keys)
      base.requireValue(
        Number.isSafeInteger(before?.[key]) && before[key] === after?.[key],
        `No-op changed resource counter: ${key}`,
      );
    if (engine === "aperture")
      base.requireValue(
        after.changedMeshes?.length === 0,
        "No-op published mesh assets",
      );
  } else
    base.requireValue(
      !same,
      "Requested composition/reset changed no native geometry",
    );
}
export function validateStateRecord(record, index, states) {
  base.validateStateRecord(record, index, states);
  validateEvidence(record.evidence, record.state, record.receipt);
  return record;
}
