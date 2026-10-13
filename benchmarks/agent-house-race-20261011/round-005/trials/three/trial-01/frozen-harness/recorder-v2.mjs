import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ARTIFACT_PROTOCOL_V2,
  artifactKindV2,
  artifactLimitV2,
  requireProtocolV2,
} from "./protocol-v2.mjs";
import { inspectPng, sha256, writeImmutable } from "./recorder.mjs";
import {
  CONTRACT,
  SCHEMA,
  requireValue,
  validateSample,
  validateWorkerEligibility,
} from "./contract.mjs";

export class RecorderV2 {
  receipts = [];
  failures = [];
  attempted = new Set();
  successfulBytes = { geometry: 0, native: 0 };
  attemptedBytes = 0;
  nonFailureAttemptedBytes = 0;
  terminal = false;
  measurement = null;
  constructor(root, engine, trial) {
    this.root = root;
    this.engine = engine;
    this.trial = trial;
  }

  async record(name, request) {
    const kind = artifactKindV2(name),
      limit = artifactLimitV2(kind);
    requireValue(
      !this.terminal &&
        !this.attempted.has(name) &&
        this.attempted.size < ARTIFACT_PROTOCOL_V2.maxArtifactCount,
      "Duplicate/terminal/excessive artifact attempt",
    );
    this.attempted.add(name);
    const expectedType =
      kind === "json"
        ? "application/json"
        : kind === "png"
          ? "image/png"
          : "application/octet-stream";
    requireValue(
      request.headers["content-type"] === expectedType,
      "V2 artifact content type differs",
    );
    const parts = [];
    let length = 0;
    for await (const bytes of request) {
      length += bytes.length;
      this.attemptedBytes += bytes.length;
      if (name !== "failure.json") {
        this.nonFailureAttemptedBytes += bytes.length;
        requireValue(
          this.nonFailureAttemptedBytes <=
            ARTIFACT_PROTOCOL_V2.maxAttemptedBytes -
              ARTIFACT_PROTOCOL_V2.limits.manifestBytes,
          "Aggregate attempted artifact byte budget exceeded; failure-record quota remains available",
        );
      }
      if (length > limit) {
        const remaining = limit - (length - bytes.length);
        if (remaining > 0) parts.push(bytes.subarray(0, remaining));
        const prefix = Buffer.concat(parts),
          path = `rejected-artifact-${String(this.failures.length).padStart(5, "0")}.bin`;
        await writeImmutable(resolve(this.root, path), prefix);
        this.failures.push({
          path: name,
          error: "Artifact body limit exceeded",
          observedBytesLowerBound: length,
          declaredContentLength: request.headers["content-length"] ?? null,
          boundedPrefix: { path, bytes: prefix.length, sha256: sha256(prefix) },
        });
        throw new Error(
          "Artifact body limit exceeded; bounded prefix retained",
        );
      }
      parts.push(bytes);
    }
    requireValue(length > 0, "Empty artifact");
    if (kind === "geometry" || kind === "native") {
      const total = this.successfulBytes[kind] + length;
      requireValue(
        total <=
          ARTIFACT_PROTOCOL_V2.limits[
            kind === "geometry" ? "geometryBytes" : "nativeBytes"
          ],
        "Aggregate successful numeric/native byte budget exceeded",
      );
      this.successfulBytes[kind] = total;
    }
    const body = Buffer.concat(parts);
    await writeImmutable(resolve(this.root, name), body);
    let inspection;
    if (kind === "png") inspection = inspectPng(body, CONTRACT.viewport);
    if (name === ARTIFACT_PROTOCOL_V2.geometryManifest)
      this.validateGeometryCommit(JSON.parse(body.toString("utf8")));
    if (name === "measurement.json") {
      const value = JSON.parse(body.toString("utf8"));
      this.validateMeasurement(value);
      this.measurement = value;
      this.terminal = true;
    }
    if (name === "failure.json") this.terminal = true;
    const receipt = {
      ok: true,
      path: name,
      bytes: length,
      sha256: sha256(body),
      ...(inspection ? { inspection } : {}),
    };
    this.receipts.push(receipt);
    return receipt;
  }

  acknowledged(receipt) {
    const real = this.receipts.find((item) => item.path === receipt?.path);
    requireValue(
      real &&
        real.bytes === receipt.bytes &&
        real.sha256 === receipt.sha256 &&
        receipt.ok === true,
      "Binary receipt does not match recorder acknowledgment",
    );
  }

  validateGeometryCommit(record) {
    requireProtocolV2(record.artifactProtocol);
    requireValue(
      record.schema === ARTIFACT_PROTOCOL_V2.geometrySchema &&
        record.engine === this.engine &&
        record.capturedAfterFrame === 179,
      "Geometry protocol/engine/phase differs",
    );
    const referenced = new Set();
    const add = (receipt) => {
      this.acknowledged(receipt);
      requireValue(
        !referenced.has(receipt.path),
        "Duplicate geometry part reference",
      );
      referenced.add(receipt.path);
    };
    requireValue(
      Array.isArray(record.sourceChunks) &&
        record.sourceChunks.length <= 64 &&
        Array.isArray(record.nativeUploads) &&
        record.nativeUploads.length <=
          ARTIFACT_PROTOCOL_V2.limits.nativeSegments,
      "Geometry part inventory exceeds bounds",
    );
    for (const part of record.sourceChunks) {
      requireValue(
        artifactKindV2(part.receipt.path) === "geometry",
        "Wrong source part kind",
      );
      add(part.receipt);
    }
    for (const segment of record.nativeUploads) {
      requireValue(
        Array.isArray(segment.parts) && segment.parts.length <= 16,
        "Native part inventory exceeds bounds",
      );
      for (const part of segment.parts) {
        requireValue(
          artifactKindV2(part.receipt.path) === "native",
          "Wrong native part kind",
        );
        add(part.receipt);
      }
    }
    const actual = this.receipts.filter((item) =>
      ["geometry", "native"].includes(artifactKindV2(item.path)),
    );
    requireValue(
      actual.length === referenced.size &&
        actual.every((item) => referenced.has(item.path)),
      "Unreferenced/missing committed binary artifact",
    );
  }

  validateMeasurement(record) {
    requireProtocolV2(record.artifactProtocol);
    requireValue(
      record.schema === SCHEMA &&
        record.engine === this.engine &&
        record.trial === this.trial &&
        JSON.stringify(record.contract) === JSON.stringify(CONTRACT) &&
        record.warmup.length === 60 &&
        record.samples.length === 120,
      "V2 measurement provenance/frame count differs",
    );
    for (const [frame, sample] of [
      ...record.warmup,
      ...record.samples,
    ].entries()) {
      validateSample(sample);
      requireValue(sample.frame === frame, "Raw sample order differs");
    }
    requireValue(
      JSON.stringify(record.workerEligibility) ===
        JSON.stringify(
          validateWorkerEligibility(
            this.engine,
            record.observationsBeforeMeasured,
            record.observationsAfterMeasured,
          ),
        ),
      "Worker eligibility differs",
    );
    requireValue(
      record.views.length === CONTRACT.views.length &&
        record.views.every(
          (item, index) =>
            JSON.stringify(item.camera) ===
            JSON.stringify(CONTRACT.views[index]),
        ),
      "Fixed view cameras differ",
    );
    requireValue(
      this.receipts.some(
        (item) => item.path === ARTIFACT_PROTOCOL_V2.geometryManifest,
      ) &&
        CONTRACT.views.every((view) =>
          this.receipts.some((item) => item.path === `${view.id}.png`),
        ),
      "Incomplete geometry/view commit",
    );
    requireValue(
      record.artifacts.length === this.receipts.length,
      "Measurement artifact count differs",
    );
    for (const receipt of record.artifacts) this.acknowledged(receipt);
    requireValue(
      new Set(record.artifacts.map((item) => item.path)).size ===
        this.receipts.length,
      "Measurement artifact references duplicate",
    );
  }

  async verifyMeasurementFile() {
    requireValue(
      this.measurement && this.terminal && this.failures.length === 0,
      "V2 attempt did not finish with complete recorder evidence",
    );
    return JSON.parse(
      await readFile(resolve(this.root, "measurement.json"), "utf8"),
    );
  }
}
