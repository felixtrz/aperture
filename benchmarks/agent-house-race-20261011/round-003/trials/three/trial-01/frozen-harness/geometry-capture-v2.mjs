import { requireValue } from "./contract.mjs";
import { createPositionParityMatcherV2 } from "./position-parity-v2.mjs";
import {
  snapshotGeometryNumericArrays,
  GEOMETRY_V2_LIMITS,
} from "./geometry-codec-v2.mjs";
import { ARTIFACT_PROTOCOL_V2 } from "./protocol-v2.mjs";
import {
  decodeNumericSnapshotV2,
  inspectNumericMeshV2,
  canonicalGeometryHashV2,
  geometrySummaryV2,
  jsonBytesV2,
  digestV2,
  addSemanticMatricesV2,
  effectiveMatrixReaderV2,
  semanticDigestV2,
} from "./geometry-data-v2.mjs";

export async function captureGeometryV2(
  app,
  observer,
  receipts,
  postArtifact,
  afterMeasured,
) {
  const buffers = observer.sealGeometryCapture();
  const capture = observer.snapshot().geometryCapture;
  requireValue(
    capture &&
      capture.omittedBufferRecords === 0 &&
      capture.incompleteBufferIds.length === 0 &&
      capture.skippedWrites === 0,
    "Incomplete native upload capture; exact final geometry export refused",
  );
  const input = await app.inspectGeometry();
  requireValue(
    observer.snapshot().submissions === afterMeasured.submissions,
    "Geometry inspection caused uncontrolled native submission",
  );
  const snapshot = snapshotGeometryNumericArrays(input?.meshes);
  const { chunks, ...numeric } = snapshot;
  const decoded = decodeNumericSnapshotV2(numeric, chunks);
  const meshes = [],
    unique = new Map(),
    semantic = new Map(),
    parity = createPositionParityMatcherV2(buffers);
  for (const mesh of decoded) {
    const facts = inspectNumericMeshV2(mesh);
    const geometrySha256 = await canonicalGeometryHashV2(mesh);
    const nativePositionParity = parity.match(geometrySha256, mesh.positions);
    unique.set(geometrySha256, facts);
    addSemanticMatricesV2(
      semantic,
      geometrySha256,
      effectiveMatrixReaderV2(mesh),
    );
    meshes.push({ ...facts, geometrySha256, nativePositionParity });
  }
  const sourceChunks = [];
  for (let i = 0; i < chunks.length; i++) {
    const receipt = await postArtifact(
      `geometry-chunk-${String(i).padStart(5, "0")}.bin`,
      chunks[i],
      "application/octet-stream",
    );
    receipts.push(receipt);
    sourceChunks.push({
      index: i,
      byteOffset: i * GEOMETRY_V2_LIMITS.chunkBytes,
      receipt,
    });
  }
  let nativeBytes = 0,
    nativeSegments = 0;
  const nativeUploads = [];
  for (const buffer of buffers) {
    requireValue(
      !buffer.captureTruncated &&
        !buffer.captureIncomplete &&
        buffer.id >= 0 &&
        buffer.id < 100000,
      "Incomplete/excessive native buffer identity",
    );
    requireValue(
      typeof buffer.label === "string" &&
        new TextEncoder().encode(buffer.label).length <= 256,
      "Oversized native buffer label",
    );
    for (let i = 0; i < buffer.segments.length; i++) {
      const segment = buffer.segments[i];
      nativeSegments++;
      nativeBytes += segment.bytes.length;
      requireValue(
        i < GEOMETRY_V2_LIMITS.nativeSegmentsPerBuffer &&
          nativeSegments <= GEOMETRY_V2_LIMITS.nativeSegments &&
          nativeBytes <= GEOMETRY_V2_LIMITS.nativeBytes,
        "Native upload segment/byte budget exceeded",
      );
      const parts = [];
      for (
        let start = 0;
        start < segment.bytes.length;
        start += GEOMETRY_V2_LIMITS.chunkBytes
      ) {
        const number = parts.length;
        const bytes = segment.bytes.subarray(
          start,
          Math.min(segment.bytes.length, start + GEOMETRY_V2_LIMITS.chunkBytes),
        );
        const receipt = await postArtifact(
          `native-buffer-${String(buffer.id).padStart(5, "0")}-${String(i).padStart(3, "0")}-part-${String(number).padStart(4, "0")}.bin`,
          bytes,
          "application/octet-stream",
        );
        receipts.push(receipt);
        parts.push({ index: number, byteOffset: start, receipt });
      }
      nativeUploads.push({
        bufferId: buffer.id,
        segmentIndex: i,
        label: buffer.label,
        usage: buffer.usage,
        requestedBytes: buffer.requestedBytes,
        offset: segment.offset,
        bytes: segment.bytes.length,
        captureTruncated: false,
        captureIncomplete: false,
        sha256: await digestV2(segment.bytes),
        parts,
      });
    }
  }
  const summary = geometrySummaryV2(meshes, unique);
  const semanticGeometrySha256 = await semanticDigestV2(semantic);
  const manifest = {
    schema: ARTIFACT_PROTOCOL_V2.geometrySchema,
    engine: app.engine,
    artifactProtocol: ARTIFACT_PROTOCOL_V2,
    capturedAfterFrame: 179,
    capturedAtNativeSubmission: afterMeasured.submissions,
    numeric,
    sourceChunks,
    nativeUploads,
    nativeBytes,
    nativeSegments,
    nativeCapture: capture,
    meshes,
    summary,
    semanticGeometrySha256,
    paritySearch: parity.snapshot(),
  };
  const body = jsonBytesV2(manifest);
  requireValue(
    body.length <= GEOMETRY_V2_LIMITS.manifestBytes,
    "Geometry manifest metadata byte budget exceeded",
  );
  receipts.push(
    await postArtifact(ARTIFACT_PROTOCOL_V2.geometryManifest, body),
  );
  return summary;
}
