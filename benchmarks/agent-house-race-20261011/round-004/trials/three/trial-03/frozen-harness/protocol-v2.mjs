import { TRIANGLE_ACCOUNTING_V2 } from "./triangle-accounting-v2.mjs";
import { CONTRACT } from "./contract.mjs";
import { GEOMETRY_V2_LIMITS } from "./geometry-codec-v2.mjs";

export const ARTIFACT_PROTOCOL_V2 = Object.freeze({
  schema: "aperture.agent-house-artifacts.v2",
  triangleAccounting: TRIANGLE_ACCOUNTING_V2,
  geometrySchema: "aperture.agent-house-geometry.v2",
  geometryManifest: "geometry-manifest-v2.json",
  capturePhase: "after-measured-before-views",
  nativeUploadCapturePhase: "startup-through-final-measured-frame",
  nativeIndirectArgumentCapturePhase: "startup-through-final-controlled-view",
  observerAccounting: "final-nonoverlapping-retained-byte-accounting.v2",
  normalizedGeometryHash: "float64-values-effective-uint32-indices-merkle.v2",
  semanticGeometryHash: "geometry-full-float64-matrix-multiplicity-merkle.v2",
  limits: GEOMETRY_V2_LIMITS,
  maxArtifactCount: GEOMETRY_V2_LIMITS.nativeSegments + 16 + 64 + 8,
  maxAttemptedBytes:
    GEOMETRY_V2_LIMITS.geometryBytes +
    GEOMETRY_V2_LIMITS.nativeBytes +
    4 * GEOMETRY_V2_LIMITS.manifestBytes +
    CONTRACT.views.length * 32 * 1024 * 1024,
  verifierReadinessNavigationDeadlineMs: 1800000,
  deadlineScope:
    "Finite readiness/navigation waits, not a strict whole-process wall timeout; awaited native/browser/lifecycle cleanup remains required.",
});

export function requireProtocolV2(protocol) {
  if (JSON.stringify(protocol) !== JSON.stringify(ARTIFACT_PROTOCOL_V2))
    throw new Error("Frozen binary geometry/capture/deadline protocol differs");
  return protocol;
}

export function artifactKindV2(name) {
  if (/^geometry-chunk-[0-9]{5}\.bin$/.test(name)) return "geometry";
  if (/^native-buffer-[0-9]{5}-[0-9]{3}-part-[0-9]{4}\.bin$/.test(name))
    return "native";
  if (CONTRACT.views.some((view) => name === `${view.id}.png`)) return "png";
  if (
    [
      ARTIFACT_PROTOCOL_V2.geometryManifest,
      "measurement.json",
      "failure.json",
    ].includes(name)
  )
    return "json";
  throw new Error("Unknown v2 artifact name");
}

export function artifactLimitV2(kind) {
  return kind === "geometry" || kind === "native"
    ? GEOMETRY_V2_LIMITS.chunkBytes
    : kind === "png"
      ? 32 * 1024 * 1024
      : GEOMETRY_V2_LIMITS.manifestBytes;
}
