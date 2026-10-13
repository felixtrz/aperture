import {
  GEOMETRY_V2_LIMITS,
  numericFieldReader,
  snapshotGeometryNumericArrays,
} from "./geometry-codec-v2.mjs";

export const PREVIEW_GEOMETRY_V3 = Object.freeze({
  schema: "aperture.agent-house-preview-geometry-preflight.v3",
  scope: "adapter-numeric-export-only-no-score",
  phase: "after-short-canonical-frames-before-views",
  sourceBytes: GEOMETRY_V2_LIMITS.geometryBytes,
  chunkBytes: GEOMETRY_V2_LIMITS.chunkBytes,
  numericMetadataBytes: GEOMETRY_V2_LIMITS.manifestBytes,
  resultBytes: 64 * 1024,
  errorBytes: 128 * 1024,
});
const requireValue = (value, message) => {
  if (!value) throw new Error(message);
};
const encoded = (value) =>
  new TextEncoder().encode(JSON.stringify(value) + "\n");

/** Validate the adapter's numeric export. No hashes/uploads/parity/quality work. */
export function preflightPreviewNumericGeometryV3(input) {
  const snapshot = snapshotGeometryNumericArrays(input?.meshes);
  const { chunks, ...metadata } = snapshot;
  const metadataBytes = encoded(metadata).length;
  requireValue(
    metadataBytes <= PREVIEW_GEOMETRY_V3.numericMetadataBytes,
    "Geometry numeric descriptor metadata byte budget exceeded",
  );
  const counts = {
    meshes: metadata.meshes.length,
    sourceVertices: 0,
    sourceIndices: 0,
    matrixRows: 0,
    effectiveInstances: 0,
    transformedVertices: 0,
    instancedTriangles: 0,
  };
  const dtypeBytes = Object.create(null);
  const read = (descriptor) =>
    descriptor === null
      ? null
      : numericFieldReader(descriptor, chunks, metadata.chunkBytes);
  const affine = (matrix, offset) => {
    requireValue(
      Math.abs(matrix.get(offset + 15) - 1) < 1e-6 &&
        [3, 7, 11].every(
          (index) => Math.abs(matrix.get(offset + index)) < 1e-6,
        ),
      "Nonaffine world/instance matrix",
    );
  };
  for (const mesh of metadata.meshes) {
    const vertices = mesh.positions.elementCount / 3;
    const indices = read(mesh.indices);
    if (indices)
      for (let index = 0; index < indices.length; index++) {
        const value = indices.get(index);
        requireValue(
          Number.isInteger(value) && value >= 0 && value < vertices,
          "Triangle index out of range",
        );
      }
    for (const descriptor of [mesh.worldMatrix, mesh.instances].filter(
      Boolean,
    )) {
      const matrix = read(descriptor);
      counts.matrixRows += matrix.length / 16;
      for (let offset = 0; offset < matrix.length; offset += 16)
        affine(matrix, offset);
    }
    const instances = mesh.instances ? mesh.instances.elementCount / 16 : 1;
    counts.sourceVertices += vertices;
    counts.sourceIndices += indices?.length ?? 0;
    counts.effectiveInstances += instances;
    counts.transformedVertices += vertices * instances;
    counts.instancedTriangles +=
      ((indices?.length ?? vertices) / 3) * instances;
    for (const descriptor of [
      mesh.positions,
      mesh.indices,
      mesh.normals,
      mesh.worldMatrix,
      mesh.instances,
    ].filter(Boolean))
      dtypeBytes[descriptor.dtype] =
        (dtypeBytes[descriptor.dtype] ?? 0) + descriptor.byteLength;
  }
  // Only compact counts survive. chunks/readers/source descriptors stay local.
  return {
    schema: PREVIEW_GEOMETRY_V3.schema,
    scope: PREVIEW_GEOMETRY_V3.scope,
    status: "passed",
    phase: PREVIEW_GEOMETRY_V3.phase,
    sourceNumericBytes: snapshot.totalBytes,
    numericDescriptorBytes: metadataBytes,
    chunkCount: snapshot.chunkCount,
    counts,
    dtypeBytes: { ...dtypeBytes },
    fullVisibleCoverageChecked: false,
    nativeUploadParityChecked: false,
    fullOfficialManifestSizeChecked: false,
    officialEligibilityChecked: false,
  };
}

export async function inspectPreviewGeometryV3(app, observer) {
  requireValue(
    typeof app?.inspectGeometry === "function",
    "Diagnostic adapter method missing: inspectGeometry",
  );
  const before = observer.snapshot();
  const input = await app.inspectGeometry();
  const result = preflightPreviewNumericGeometryV3(input);
  const after = observer.snapshot();
  requireValue(
    after.submissions === before.submissions &&
      after.drawCalls === before.drawCalls,
    "Geometry inspection caused uncontrolled native submission",
  );
  return result;
}

/** Bound actual adapter/codec attribution; add no scene or implementation advice. */
export function previewGeometryErrorV3(error) {
  return {
    schema: "aperture.agent-house-preview-geometry-error.v3",
    name: (typeof error?.name === "string" ? error.name : "Error").slice(
      0,
      256,
    ),
    message: (typeof error?.message === "string"
      ? error.message
      : String(error)
    ).slice(0, 4096),
    ...(typeof error?.code === "string"
      ? { code: error.code.slice(0, 512) }
      : {}),
    ...(typeof error?.stack === "string"
      ? { stack: error.stack.slice(0, 8192) }
      : {}),
  };
}
