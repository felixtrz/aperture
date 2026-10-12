export const SCHEMA = "aperture.agent-house-benchmark.v1";
export const READY_GLOBAL = "__AGENT_BENCHMARK_STATUS__";
export const CONTRACT = Object.freeze({
  schema: SCHEMA,
  viewport: { width: 1024, height: 768 },
  devicePixelRatio: 1,
  warmupFrames: 60,
  measuredFrames: 120,
  deltaSeconds: 1 / 60,
  renderSettings: {
    backend: "native-webgpu-swiftshader",
    tonemap: "aces",
    exposure: 1,
    msaa: 4,
    shadowedSun: true,
    ambientFill: true,
  },
  views: [
    { id: "canonical", position: [14, 9, 19] },
    { id: "left-orbit", position: [-19, 10, 15] },
    { id: "rear-orbit", position: [14, 10, -19] },
  ].map((view) => ({
    ...view,
    target: [0, 2.5, 1],
    fovYDegrees: 37,
    near: 0.1,
    far: 200,
  })),
});

export function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

export function summarize(values) {
  requireValue(
    Array.isArray(values) &&
      values.length > 0 &&
      values.every((value) => Number.isFinite(value) && value >= 0),
    "Timing samples must be finite, nonnegative and nonempty",
  );
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p) => sorted[Math.ceil(p * sorted.length) - 1];
  return {
    count: sorted.length,
    min: sorted[0],
    median: quantile(0.5),
    p95: quantile(0.95),
    max: sorted.at(-1),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
  };
}

export function validateSample(sample) {
  requireValue(
    sample &&
      [
        "cpuSubmissionMs",
        "queueCompletionLatencyMs",
        "endToEndMs",
        "applicationPromiseMs",
      ].every((key) => Number.isFinite(sample[key]) && sample[key] >= 0),
    "Invalid frame timing sample",
  );
  requireValue(
    Number.isInteger(sample.submissions) &&
      sample.submissions > 0 &&
      Number.isInteger(sample.drawCalls) &&
      sample.drawCalls > 0 &&
      Number.isInteger(sample.unknownCommandBuffers) &&
      sample.unknownCommandBuffers === 0,
    "Frame lacks attributable native submitted draws",
  );
  requireValue(
    Math.abs(
      sample.cpuSubmissionMs +
        sample.queueCompletionLatencyMs -
        sample.endToEndMs,
    ) < 0.01,
    "Frame timing boundaries do not reconcile",
  );
  return sample;
}

/** Observed worker eligibility still requires independent architecture/source audit. */
export function validateWorkerEligibility(engine, before, after) {
  const evidence = {
    required: engine === "aperture",
    sourceAuditRequired: true,
    workersBefore: before.workerEvidence ?? [],
    workersAfter: after.workerEvidence ?? [],
    limitations:
      "Native worker/MessagePort protocol and advancing snapshot evidence are observed; source audit must confirm ECS/extraction runs there and consumes those snapshots. A dummy worker cannot establish eligibility.",
  };
  if (engine !== "aperture")
    return { ...evidence, status: "not-required-for-control" };
  const candidate = evidence.workersBefore.find(
    (worker) =>
      worker.connected &&
      worker.started &&
      !worker.terminated &&
      worker.snapshotMessages > 0 &&
      worker.snapshotPayloadObserved &&
      worker.errors === 0,
  );
  requireValue(
    candidate,
    "Aperture requires an observed live simulation worker with normal snapshot protocol",
  );
  const survived = evidence.workersAfter.find(
    (worker) => worker.id === candidate.id,
  );
  requireValue(
    survived &&
      !survived.terminated &&
      survived.errors === 0 &&
      before.workersCreated === after.workersCreated &&
      before.workerTerminationCalls === after.workerTerminationCalls,
    "Aperture simulation worker changed, failed or terminated during measurement",
  );
  requireValue(
    survived.lastSnapshotFrame > candidate.lastSnapshotFrame ||
      (survived.sharedFrame !== null &&
        candidate.sharedFrame !== null &&
        survived.sharedFrame > candidate.sharedFrame),
    "Aperture simulation worker did not advance snapshots during measurement",
  );
  return {
    ...evidence,
    status: "observed-live-simulation-protocol-awaiting-source-audit",
    workerId: candidate.id,
  };
}

/** Counts are calculated from actual arrays; confidence is reported separately. */
export function inspectMesh(mesh) {
  requireValue(
    typeof mesh?.id === "string" && mesh.id.length > 0,
    "Mesh id missing",
  );
  const positions = Array.from(mesh.positions ?? []);
  requireValue(
    positions.length > 0 &&
      positions.length % 3 === 0 &&
      positions.every(Number.isFinite),
    `Invalid positions: ${mesh.id}`,
  );
  const vertices = positions.length / 3;
  const indices =
    mesh.indices === undefined
      ? Array.from({ length: vertices }, (_, i) => i)
      : Array.from(mesh.indices);
  requireValue(
    indices.length > 0 &&
      indices.length % 3 === 0 &&
      indices.every(
        (value) => Number.isInteger(value) && value >= 0 && value < vertices,
      ),
    `Invalid triangle-list indices: ${mesh.id}`,
  );
  const matrices =
    mesh.instances === undefined
      ? [Array.from(mesh.worldMatrix ?? [])]
      : mesh.instances.map((matrix) => Array.from(matrix));
  requireValue(
    matrices.length > 0 &&
      matrices.every(
        (matrix) =>
          matrix.length === 16 &&
          matrix.every(Number.isFinite) &&
          Math.abs(matrix[15] - 1) < 1e-6 &&
          [3, 7, 11].every((i) => Math.abs(matrix[i]) < 1e-6),
      ),
    `Invalid affine world matrix: ${mesh.id}`,
  );
  if (mesh.normals !== undefined)
    requireValue(
      mesh.normals.length === positions.length &&
        Array.from(mesh.normals).every(Number.isFinite),
      `Invalid normals: ${mesh.id}`,
    );
  const bounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  let degenerateTriangles = 0;
  for (const matrix of matrices) {
    const transformed = [];
    for (let i = 0; i < positions.length; i += 3) {
      const [x, y, z] = positions.slice(i, i + 3);
      const point = [0, 1, 2].map(
        (axis) =>
          matrix[axis] * x +
          matrix[axis + 4] * y +
          matrix[axis + 8] * z +
          matrix[axis + 12],
      );
      transformed.push(point);
      point.forEach((value, axis) => {
        bounds.min[axis] = Math.min(bounds.min[axis], value);
        bounds.max[axis] = Math.max(bounds.max[axis], value);
      });
    }
    for (let i = 0; i < indices.length; i += 3) {
      const a = transformed[indices[i]],
        b = transformed[indices[i + 1]],
        c = transformed[indices[i + 2]];
      const u = a.map((value, axis) => b[axis] - value),
        v = a.map((value, axis) => c[axis] - value);
      const squaredArea4 =
        (u[1] * v[2] - u[2] * v[1]) ** 2 +
        (u[2] * v[0] - u[0] * v[2]) ** 2 +
        (u[0] * v[1] - u[1] * v[0]) ** 2;
      if (squaredArea4 <= 1e-20) degenerateTriangles++;
    }
  }
  return {
    id: mesh.id,
    vertices,
    authoredTriangles: indices.length / 3,
    instances: matrices.length,
    instancedTriangles: (indices.length / 3) * matrices.length,
    degenerateTriangles,
    normalsPresent: mesh.normals !== undefined,
    bounds,
    positions,
    indices,
    matrices,
  };
}

/** Exact Float32 position parity with successful observed vertex-buffer uploads. */
export function matchPositionStream(
  positions,
  buffers,
  maxComparisons = 20_000_000,
) {
  const expected = Float32Array.from(positions);
  let comparisons = 0;
  for (const buffer of buffers) {
    if (!(buffer.usage & 32)) continue; // GPUBufferUsage.VERTEX
    for (const segment of buffer.segments) {
      const raw = segment.bytes;
      const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
      if (bytes.byteOffset % 4 !== 0) continue;
      const values = new Float32Array(
        bytes.buffer,
        bytes.byteOffset,
        Math.floor(bytes.byteLength / 4),
      );
      for (let offset = 0; offset + 2 < values.length; offset++) {
        if (++comparisons > maxComparisons)
          return { matched: false, reason: "comparison-budget-exhausted" };
        if (
          ![0, 1, 2].every((axis) => values[offset + axis] === expected[axis])
        )
          continue;
        for (const stride of [3, 6, 8, 10, 12, 16]) {
          const last = offset + (expected.length / 3 - 1) * stride + 2;
          if (last >= values.length) continue;
          let matches = true;
          for (let i = 0; i < expected.length; i++) {
            if (++comparisons > maxComparisons)
              return { matched: false, reason: "comparison-budget-exhausted" };
            if (
              values[offset + Math.floor(i / 3) * stride + (i % 3)] !==
              expected[i]
            ) {
              matches = false;
              break;
            }
          }
          if (matches)
            return {
              matched: true,
              bufferId: buffer.id,
              byteOffset: segment.offset + offset * 4,
              strideBytes: stride * 4,
              vertexCount: expected.length / 3,
            };
        }
      }
    }
  }
  return { matched: false, reason: "no-exact-observed-vertex-upload" };
}
