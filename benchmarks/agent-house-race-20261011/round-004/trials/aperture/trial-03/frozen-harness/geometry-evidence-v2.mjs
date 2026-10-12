import { requireValue } from "./contract.mjs";
import { ARTIFACT_PROTOCOL_V2, requireProtocolV2 } from "./protocol-v2.mjs";
import { GEOMETRY_V2_LIMITS } from "./geometry-codec-v2.mjs";
import {
  decodeNumericSnapshotV2,
  inspectNumericMeshV2,
  canonicalGeometryHashV2,
  geometrySummaryV2,
  stableV2,
  digestV2,
  verifyPositionWitnessV2,
  addSemanticMatricesV2,
  effectiveMatrixReaderV2,
  semanticDigestV2,
} from "./geometry-data-v2.mjs";

/** All file reads go through the existing receipt hash/path/symlink verifier. */
export async function checkGeometryEvidenceV2(
  root,
  record,
  measurement,
  verifyBytes,
) {
  requireProtocolV2(record.artifactProtocol);
  requireProtocolV2(measurement.artifactProtocol);
  requireValue(
    record.schema === ARTIFACT_PROTOCOL_V2.geometrySchema &&
      record.engine === measurement.engine &&
      record.capturedAfterFrame === 179 &&
      record.capturedAtNativeSubmission ===
        measurement.observationsAfterMeasured.submissions &&
      record.nativeCapture?.omittedBufferRecords === 0 &&
      record.nativeCapture.bufferRecordLimit ===
        GEOMETRY_V2_LIMITS.nativeBuffers &&
      record.nativeCapture?.incompleteBufferIds?.length === 0 &&
      record.nativeCapture.skippedWrites === 0 &&
      record.nativeCapture.segmentLimit === GEOMETRY_V2_LIMITS.nativeSegments &&
      record.nativeCapture.segmentLimitPerBuffer ===
        GEOMETRY_V2_LIMITS.nativeSegmentsPerBuffer &&
      Number.isSafeInteger(record.nativeCapture.retainedSegments) &&
      record.nativeCapture.retainedSegments >= 0 &&
      record.nativeCapture.retainedSegments <=
        GEOMETRY_V2_LIMITS.nativeSegments &&
      record.nativeCapture.limitBytes === GEOMETRY_V2_LIMITS.nativeBytes &&
      Number.isSafeInteger(record.nativeCapture.retainedBytes) &&
      record.nativeCapture.retainedBytes >= 0 &&
      record.nativeCapture.retainedBytes <= GEOMETRY_V2_LIMITS.nativeBytes &&
      stableV2(record.nativeCapture) ===
        stableV2(measurement.observationsAfterMeasured.geometryCapture) &&
      record.nativeCapture.accounting ===
        ARTIFACT_PROTOCOL_V2.observerAccounting,
    "Invalid v2 capture phase/completeness",
  );
  const chunks = [],
    referenced = new Set();
  const read = async (receipt) => {
    requireValue(
      receipt?.ok === true &&
        Number.isSafeInteger(receipt.bytes) &&
        receipt.bytes > 0 &&
        receipt.bytes <= GEOMETRY_V2_LIMITS.chunkBytes &&
        !referenced.has(receipt.path),
      "Duplicate/missing binary receipt reference",
    );
    referenced.add(receipt.path);
    return new Uint8Array(await verifyBytes(root, receipt));
  };
  requireValue(
    Number.isSafeInteger(record.numeric?.totalBytes) &&
      record.numeric.totalBytes > 0 &&
      record.numeric.totalBytes <= GEOMETRY_V2_LIMITS.geometryBytes &&
      Array.isArray(record.sourceChunks) &&
      record.sourceChunks.length ===
        Math.ceil(record.numeric.totalBytes / GEOMETRY_V2_LIMITS.chunkBytes),
    "Source chunk inventory differs",
  );
  for (const [index, part] of record.sourceChunks.entries()) {
    requireValue(
      part.index === index &&
        part.byteOffset === index * GEOMETRY_V2_LIMITS.chunkBytes &&
        part.receipt.path ===
          `geometry-chunk-${String(index).padStart(5, "0")}.bin`,
      "Source chunk order/path differs",
    );
    const bytes = await read(part.receipt);
    requireValue(
      bytes.length ===
        Math.min(
          GEOMETRY_V2_LIMITS.chunkBytes,
          record.numeric.totalBytes - part.byteOffset,
        ),
      "Source chunk length differs",
    );
    chunks.push(bytes);
  }
  const buffers = new Map(),
    segmentIds = new Set();
  let nativeBytes = 0;
  requireValue(
    Array.isArray(record.nativeUploads) &&
      record.nativeUploads.length <= GEOMETRY_V2_LIMITS.nativeSegments,
    "Native segment budget exceeded",
  );
  for (const upload of record.nativeUploads) {
    requireValue(
      Number.isSafeInteger(upload.bufferId) &&
        upload.bufferId >= 0 &&
        upload.bufferId < 100000 &&
        Number.isSafeInteger(upload.segmentIndex) &&
        upload.segmentIndex >= 0 &&
        upload.segmentIndex < GEOMETRY_V2_LIMITS.nativeSegmentsPerBuffer &&
        Number.isSafeInteger(upload.offset) &&
        upload.offset >= 0 &&
        Number.isSafeInteger(upload.bytes) &&
        upload.bytes > 0 &&
        typeof upload.label === "string" &&
        new TextEncoder().encode(upload.label).length <= 256 &&
        Number.isSafeInteger(upload.usage) &&
        upload.usage >= 0 &&
        Number.isSafeInteger(upload.requestedBytes) &&
        upload.offset + upload.bytes <= upload.requestedBytes &&
        !upload.captureTruncated &&
        !upload.captureIncomplete &&
        upload.usage & 32 &&
        measurement.observationsAfterMeasured.submittedVertexBufferIds.includes(
          upload.bufferId,
        ),
      "Invalid native upload identity/usage/completeness/bounds",
    );
    requireValue(
      !segmentIds.has(`${upload.bufferId}:${upload.segmentIndex}`),
      "Duplicate native upload segment",
    );
    segmentIds.add(`${upload.bufferId}:${upload.segmentIndex}`);
    nativeBytes += upload.bytes;
    requireValue(
      nativeBytes <= GEOMETRY_V2_LIMITS.nativeBytes &&
        Array.isArray(upload.parts) &&
        upload.parts.length ===
          Math.ceil(upload.bytes / GEOMETRY_V2_LIMITS.chunkBytes),
      "Native byte/part budget differs",
    );
    const bytes = new Uint8Array(upload.bytes);
    for (const [index, part] of upload.parts.entries()) {
      requireValue(
        part.index === index &&
          part.byteOffset === index * GEOMETRY_V2_LIMITS.chunkBytes &&
          part.receipt.path ===
            `native-buffer-${String(upload.bufferId).padStart(5, "0")}-${String(upload.segmentIndex).padStart(3, "0")}-part-${String(index).padStart(4, "0")}.bin`,
        "Native part order/path differs",
      );
      const value = await read(part.receipt);
      requireValue(
        value.length ===
          Math.min(
            GEOMETRY_V2_LIMITS.chunkBytes,
            upload.bytes - part.byteOffset,
          ),
        "Native part length differs",
      );
      bytes.set(value, part.byteOffset);
    }
    requireValue(
      (await digestV2(bytes)) === upload.sha256,
      "Native full segment hash differs",
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
        !buffer.segments.some(
          (part) =>
            part.offset < upload.offset + bytes.length &&
            part.offset + part.bytes.length > upload.offset,
        ),
      "Native buffer metadata/overlap differs",
    );
    buffer.segments.push({ offset: upload.offset, bytes });
  }
  requireValue(
    nativeBytes <= record.nativeCapture.retainedBytes &&
      record.nativeUploads.length <= record.nativeCapture.retainedSegments &&
      nativeBytes === record.nativeBytes &&
      record.nativeSegments === record.nativeUploads.length,
    "Native totals differ",
  );
  const expectedArtifacts = measurement.artifacts.filter((item) =>
    /^(geometry-chunk-|native-buffer-)/.test(item.path),
  );
  requireValue(
    expectedArtifacts.length === referenced.size &&
      expectedArtifacts.every((receipt) => referenced.has(receipt.path)),
    "Unreferenced/missing binary evidence",
  );
  const decoded = decodeNumericSnapshotV2(record.numeric, chunks),
    facts = [],
    unique = new Map(),
    semantic = new Map();
  requireValue(
    record.meshes.length === decoded.length,
    "Geometry fact inventory differs",
  );
  for (const [index, mesh] of decoded.entries()) {
    const supplied = record.meshes[index],
      inspected = inspectNumericMeshV2(mesh);
    for (const key of Object.keys(inspected))
      requireValue(
        stableV2(supplied[key]) === stableV2(inspected[key]),
        `Independent geometry fact differs: ${mesh.id}/${key}`,
      );
    const geometrySha256 = await canonicalGeometryHashV2(mesh);
    requireValue(
      geometrySha256 === supplied.geometrySha256,
      "Canonical numeric geometry hash differs",
    );
    if (supplied.nativePositionParity?.matched)
      verifyPositionWitnessV2(mesh.positions, supplied.nativePositionParity, [
        ...buffers.values(),
      ]);
    else
      requireValue(
        [
          "no-exact-observed-vertex-upload",
          "comparison-budget-exhausted",
        ].includes(supplied.nativePositionParity?.reason),
        "Unknown missing-parity status",
      );
    const fact = {
      ...inspected,
      geometrySha256,
      nativePositionParity: supplied.nativePositionParity,
    };
    facts.push(fact);
    unique.set(geometrySha256, inspected);
    addSemanticMatricesV2(
      semantic,
      geometrySha256,
      effectiveMatrixReaderV2(mesh),
    );
  }
  const summary = geometrySummaryV2(facts, unique),
    semanticGeometrySha256 = await semanticDigestV2(semantic);
  requireValue(
    stableV2(summary) === stableV2(record.summary) &&
      stableV2(summary) === stableV2(measurement.geometry) &&
      semanticGeometrySha256 === record.semanticGeometrySha256,
    "Independent geometry summary/semantic hash differs",
  );
  return {
    ...summary,
    uniqueGeometryHashes: [...unique.keys()].sort(),
    semanticGeometrySha256,
    artifactProtocol: ARTIFACT_PROTOCOL_V2.schema,
    independentlyRecomputed: true,
  };
}
