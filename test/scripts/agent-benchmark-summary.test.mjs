import { describe, expect, it } from "vitest";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import {
  CONTRACT,
  SCHEMA,
  inspectMesh,
  summarize,
  validateWorkerEligibility,
} from "../../tools/agent-benchmark/contract.mjs";
import { ARTIFACT_PROTOCOL_V2 } from "../../tools/agent-benchmark/protocol-v2.mjs";
import { captureGeometryV2 } from "../../tools/agent-benchmark/geometry-capture-v2.mjs";
import { HARNESS_V2_FILES } from "../../tools/agent-benchmark/run-v2.mjs";
import { preserveInputs } from "../../tools/agent-benchmark/run.mjs";
import { inspectPng, sha256 } from "../../tools/agent-benchmark/recorder.mjs";
import {
  componentScores,
  parseSummaryOptions,
  summarizeRound,
  semanticGeometryDigest,
} from "../../tools/agent-benchmark/summarize.mjs";
import { launchOptions } from "../../scripts/local-webgpu.mjs";
import {
  completedExecutionFixture,
  officialRun,
} from "../helpers/official-execution-fixture.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
// Six-trial fixtures validate 18 full-size PNGs and repeat complete summaries.
// Give V8-instrumented runs time to finish that evidence work.
const OFFLINE_FIXTURE_TIMEOUT_MS = 120_000;
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const positions = [0, 0, 0, 1, 0, 0, 0, 1, 0],
  indices = [0, 1, 2];
const timingKeys = [
  "cpuSubmissionMs",
  "applicationPromiseMs",
  "queueCompletionLatencyMs",
  "endToEndMs",
];

// Synthetic unit fixture bytes only: these never represent a browser benchmark.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length);
  bytes.write(type, 4);
  data.copy(bytes, 8);
  bytes.writeUInt32BE(
    crc32(bytes.subarray(4, bytes.length - 4)),
    bytes.length - 4,
  );
  return bytes;
}
function fixturePng() {
  const { width, height } = CONTRACT.viewport,
    header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const offset = y * (width * 4 + 1) + x * 4 + 1;
      raw[offset] = x % 256;
      raw[offset + 1] = y % 256;
      raw[offset + 2] = 64;
      raw[offset + 3] = 255;
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pin = (bytes) => ({ bytes: bytes.length, sha256: sha256(bytes) });
async function save(root, name, value) {
  const target = join(root, name);
  await mkdir(dirname(target), { recursive: true });
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(JSON.stringify(value, null, 2) + "\n");
  await writeFile(target, bytes);
  return pin(bytes);
}
function sample(engine, frame) {
  const cpu = engine === "three" ? 1 : 2,
    queue = engine === "three" ? 2 : 3;
  return {
    frame,
    cpuSubmissionMs: cpu,
    applicationPromiseMs: cpu,
    queueCompletionLatencyMs: queue,
    endToEndMs: cpu + queue,
    submissions: 1,
    drawCalls: 1,
    submittedTriangles: 1,
    indirectDrawCalls: 0,
    unknownDirectTriangleDrawCalls: 0,
    knownIndirectDrawCalls: 0,
    unknownIndirectDrawCalls: 0,
    knownIndirectTriangles: 0,
    unknownIndirectReasons: {},
    nativeIndirectArgumentReferences: [],
    unretainedKnownIndirectDrawCalls: 0,
    submittedTriangleAccounting: {
      schema: "aperture.native-triangle-accounting.v2.1",
      confidence: "exact-supported-command-arguments",
      proofStatus: "complete",
    },
    nonTriangleDrawCalls: 0,
    unknownTopologyDrawCalls: 0,
    unknownCommandBuffers: 0,
    renderPasses: 1,
    computePasses: 0,
    buffersCreated: 0,
    buffersDestroyed: 0,
    texturesCreated: 0,
    texturesDestroyed: 0,
    renderPipelinesCreated: 0,
  };
}
function observed(engine, frame) {
  return {
    unknownDirectTriangleDrawCalls: 0,
    knownIndirectDrawCalls: 0,
    unknownIndirectDrawCalls: 0,
    knownIndirectTriangles: 0,
    unknownIndirectReasons: {},
    submissions: frame,
    drawCalls: frame,
    submittedTriangles: frame,
    renderPasses: frame,
    computePasses: 0,
    unknownCommandBuffers: 0,
    workersCreated: engine === "aperture" ? 1 : 0,
    workerTerminationCalls: 0,
    submittedVertexBufferIds: [0],
    workerEvidence:
      engine === "aperture"
        ? [
            {
              id: 0,
              connected: true,
              started: true,
              terminated: false,
              snapshotMessages: frame,
              snapshotPayloadObserved: true,
              lastSnapshotFrame: frame,
              errors: 0,
              sharedFrame: null,
            },
          ]
        : [],
  };
}
function proof() {
  const adapter = { description: "Synthetic unit fixture SwiftShader Device" };
  return {
    native: true,
    adapters: [adapter],
    devices: [{ adapter }],
    canvasWebGPU: 1,
    webglAttempts: 0,
    submissions: 183,
    draws: 183,
    errors: [],
    deviceLost: [],
  };
}

async function fixture(
  v2 = false,
  methodSchema = "aperture.house-race-method.v1",
) {
  const root = await mkdtemp(join(tmpdir(), "agent-summary-fixture-")),
    round = join(root, "round-001");
  const method = JSON.parse(
    await readFile(
      join(repo, "benchmarks/agent-house-race-20261011/method.json"),
      "utf8",
    ),
  );
  method.schema = methodSchema;
  if (methodSchema === "aperture.house-race-method.v2")
    method.referencePolicy = {
      kind: "fresh-low-poly-per-round",
      sharedWithinRound: true,
      uniqueImagePerRound: true,
    };
  const methodPin = await save(root, "method.json", method);
  const harness = new Map();
  for (const name of v2
    ? HARNESS_V2_FILES
    : [
        "client.mjs",
        "contract.mjs",
        "native-observer.mjs",
        "recorder.mjs",
        "run.mjs",
        "README.md",
      ])
    harness.set(
      name,
      await readFile(join(repo, "tools/agent-benchmark", name)),
    );
  const freeze = {
    files: { "race/method.json": methodPin },
    provenance: {
      inputs: Object.fromEntries(
        [...harness].map(([name, bytes]) => [
          `tools/agent-benchmark/${name}`,
          pin(bytes),
        ]),
      ),
    },
  };
  if (methodSchema === "aperture.house-race-method.v2")
    freeze.files["race/reference.png"] = {
      sha256: method.referenceSha256,
      bytes: 1,
    };
  const driver = await save(
    root,
    "setup/driver.py",
    Buffer.from("# fixture driver\n"),
  );
  freeze.provenance.inputs["source-driver.py"] = {
    ...driver,
    snapshotPath: "setup/driver.py",
  };
  await save(root, "freezes/round-001-inputs.json", freeze);
  const png = fixturePng(),
    inspection = inspectPng(png, CONTRACT.viewport),
    vertexBytes = Buffer.from(Float32Array.from(positions).buffer);
  const geometrySha256 = sha256(
    Buffer.from(JSON.stringify({ positions, indices, normals: null })),
  );
  const mesh = {
    ...inspectMesh({
      id: "triangle",
      positions,
      indices,
      worldMatrix: identity,
    }),
    geometrySha256,
    nativePositionParity: {
      matched: true,
      bufferId: 0,
      byteOffset: 0,
      strideBytes: 12,
      vertexCount: 3,
    },
  };
  const geometrySummary = {
    meshEntries: 1,
    renderInstances: 1,
    uniqueGeometryCount: 1,
    uniqueAuthoredVertices: 3,
    uniqueAuthoredTriangles: 1,
    instancedAuthoredTriangles: 1,
    degenerateInstancedTriangles: 0,
    exactNativePositionStreamMatches: 1,
    missingNormalMeshEntries: 1,
    bounds: { min: [0, 0, 0], max: [1, 1, 0] },
    confidence: "actual-native-submitted-vertex-upload-correlated",
    limitations: ["Synthetic unit test geometry"],
  };
  for (const engine of ["three", "aperture"]) {
    const app = new Map([
      [
        "/index.html",
        Buffer.from(`<html><head></head><body>${engine}</body></html>`),
      ],
      [
        "/assets/main.js",
        Buffer.from(`/* synthetic unit fixture ${engine} */`),
      ],
    ]);
    for (let trial = 1; trial <= 3; trial++) {
      const target = join(round, "trials", engine, `trial-0${trial}`);
      await mkdir(target, { recursive: true });
      const retainedInputs = await preserveInputs(
        target,
        app,
        harness,
        app.get("/index.html"),
      );
      const inputs = {
        schema: SCHEMA,
        ...(v2 ? { artifactProtocol: ARTIFACT_PROTOCOL_V2 } : {}),
        engine,
        trial,
        lifecycle: {
          run: officialRun(engine, trial),
          root: join(root, "scratch"),
        },
        contract: CONTRACT,
        retainedInputs,
        inputs: Object.fromEntries(
          [...app].map(([path, bytes]) => [path, pin(bytes)]),
        ),
        harness: Object.fromEntries(
          [...harness].map(([path, bytes]) => [path, pin(bytes)]),
        ),
      };
      const inputPin = await save(target, "inputs.json", inputs),
        receipts = [];
      const add = async (name, value, extra = {}) => {
        const receipt = {
          ok: true,
          path: name,
          ...(await save(target, name, value)),
          ...extra,
        };
        receipts.push(receipt);
        return receipt;
      };
      let trialGeometrySummary = geometrySummary;
      const before = observed(engine, 60),
        after = observed(engine, 180);
      if (v2) {
        const geometryCapture = {
          limitBytes: ARTIFACT_PROTOCOL_V2.limits.nativeBytes,
          bufferRecordLimit: ARTIFACT_PROTOCOL_V2.limits.nativeBuffers,
          omittedBufferRecords: 0,
          retainedBytes: vertexBytes.length,
          retainedSegments: 1,
          segmentLimit: 10000,
          segmentLimitPerBuffer: 1000,
          incompleteBufferIds: [],
          skippedWrites: 0,
          skippedBytes: 0,
          accounting: ARTIFACT_PROTOCOL_V2.observerAccounting,
        };
        before.geometryCapture = geometryCapture;
        after.geometryCapture = geometryCapture;
        trialGeometrySummary = await captureGeometryV2(
          {
            engine,
            inspectGeometry: async () => ({
              meshes: [
                { id: "triangle", positions, indices, worldMatrix: identity },
              ],
            }),
          },
          {
            snapshot: () => after,
            sealGeometryCapture: () => [
              {
                id: 0,
                label: "fixture",
                usage: 32,
                requestedBytes: vertexBytes.length,
                segments: [{ offset: 0, bytes: new Uint8Array(vertexBytes) }],
              },
            ],
          },
          receipts,
          async (name, bytes) => ({
            ok: true,
            path: name,
            ...(await save(target, name, Buffer.from(bytes))),
          }),
          after,
        );
      } else {
        const upload = await add("native-buffer-00000-000.bin", vertexBytes);
        const geometry = {
          schema: SCHEMA,
          engine,
          summary: geometrySummary,
          meshes: [mesh],
          nativeUploads: [
            {
              bufferId: 0,
              label: "fixture",
              usage: 32,
              requestedBytes: vertexBytes.length,
              offset: 0,
              captureTruncated: false,
              receipt: upload,
            },
          ],
        };
        await add("geometry.json", geometry);
      }
      const views = [];
      for (let index = 0; index < CONTRACT.views.length; index++) {
        const camera = CONTRACT.views[index],
          screenshot = await add(`${camera.id}.png`, png, { inspection });
        views.push({
          camera,
          screenshot,
          frame: sample(engine, 180 + index),
          proof: proof(),
        });
      }
      const warmup = Array.from({ length: 60 }, (_, frame) =>
        sample(engine, frame),
      );
      const samples = Array.from({ length: 120 }, (_, index) =>
        sample(engine, 60 + index),
      );
      const record = {
        schema: SCHEMA,
        ...(v2 ? { artifactProtocol: ARTIFACT_PROTOCOL_V2 } : {}),
        engine,
        trial,
        contract: CONTRACT,
        warmup,
        samples,
        timings: Object.fromEntries(
          timingKeys.map((key) => [
            key,
            summarize(samples.map((value) => value[key])),
          ]),
        ),
        geometry: trialGeometrySummary,
        views,
        observationsBeforeMeasured: before,
        observationsAfterMeasured: after,
        workerEligibility: validateWorkerEligibility(engine, before, after),
        nativeProof: proof(),
        artifacts: [...receipts],
        ...(v2
          ? {
              nativeIndirectArgumentProof: {
                schema: "aperture.native-indirect-arguments.v2.1",
                capacityExceeded: false,
                maxWitnesses: 16384,
                witnesses: [],
              },
            }
          : {}),
      };
      await add("measurement.json", record);
      const receiptPin = await save(target, "receipts.json", {
        schema: SCHEMA,
        ...(v2 ? { artifactProtocol: ARTIFACT_PROTOCOL_V2 } : {}),
        receipts,
        failures: [],
      });
      const launch = launchOptions(
        "/synthetic-unit-fixture/chromium",
        "/tmp/fixture-profile",
      );
      await save(target, "verified-runner.json", {
        schema: 1,
        status: "passed",
        viewport: CONTRACT.viewport,
        sceneStatus: { ok: true, measuredFrames: 120 },
        launch: {
          requested: launch,
          actualArgv: [launch.executablePath, ...launch.args],
        },
        proof: proof(),
        errors: [],
      });
      await save(target, "outcome.json", {
        schema: SCHEMA,
        ...(v2 ? { artifactProtocol: ARTIFACT_PROTOCOL_V2 } : {}),
        status: "passed",
        browserStatus: "passed",
        inputManifestSha256: inputPin.sha256,
        receiptManifestSha256: receiptPin.sha256,
      });
    }
    const lane = `${engine}-r001`,
      author = join(round, "authors", lane),
      auditRoot = join(round, "author-audits", lane),
      active = engine === "three" ? 80 : 160,
      waiting = engine === "three" ? 20 : 10;
    const files = [];
    for (const [path, bytes] of app) {
      const file = { path: "dist" + path, ...pin(bytes) };
      files.push(file);
      await save(auditRoot, "source/" + file.path, bytes);
    }
    const startedNs = 1000000000,
      finishedNs = startedNs + (active + waiting) * 1e9;
    const finish = {
      schema: "aperture.author-transcript.v1",
      lane,
      engine,
      runningProcesses: [],
      elapsedSeconds: active + waiting,
      previewWaitSeconds: waiting,
      activeBudgetElapsedSeconds: active,
      finishedMonotonicNs: finishedNs,
      previewsRequested: 1,
      files,
    };
    const finishPin = await save(author, "finish.json", finish);
    const startPin = await save(auditRoot, "public-records/start.json", {
      engine,
      lane,
      startedMonotonicNs: startedNs,
    });
    await save(auditRoot, "audit.json", {
      schema: "aperture.author-audit.v1",
      status: "verified",
      verificationChecks: {
        publicEventHashChain: true,
        commandRecordAndOutputParity: true,
        publicPromptAndReferencePins: true,
        monotonicBudgetWaitAccounting: true,
        finishedWorkspaceSourceHashes: true,
        retainedCopiesReadBack: true,
      },
      engine,
      lane,
      finishSha256: finishPin.sha256,
      startSha256: startPin.sha256,
      referenceSha256: method.referenceSha256,
      elapsedSeconds: active + waiting,
      previewWaitSeconds: waiting,
      activeBudgetElapsedSeconds: active,
      budgetSeconds: method.authorBudgetSeconds,
      sourceFileCount: files.length,
      sourceFiles: files,
      retainedFiles: Object.fromEntries([
        ...files.map((file) => [
          "source/" + file.path,
          { bytes: file.bytes, sha256: file.sha256 },
        ]),
        ["public-records/start.json", startPin],
      ]),
    });
  }
  return { root, round };
}

describe("offline agent benchmark summaries", () => {
  it("digests complete semantic transforms as a multiset while ignoring volatile mesh/buffer identities", () => {
    const moved = [...identity];
    moved[12] = 2;
    const base = [
      {
        id: "random-uuid-A",
        geometrySha256: "a".repeat(64),
        matrices: [identity, moved],
        nativePositionParity: { bufferId: 1 },
      },
      {
        id: "another-random-uuid",
        geometrySha256: "b".repeat(64),
        matrices: [identity],
      },
    ];
    const reallocated = [
      {
        id: "random-uuid-B",
        geometrySha256: "a".repeat(64),
        matrices: [moved, identity],
        nativePositionParity: { bufferId: 99 },
      },
      {
        id: "different-random-uuid",
        geometrySha256: "b".repeat(64),
        matrices: [identity],
      },
    ];
    expect(semanticGeometryDigest(base)).toBe(
      semanticGeometryDigest([...reallocated].reverse()),
    );
    const changed = structuredClone(reallocated);
    changed[0].matrices[0][12] = 3;
    expect(semanticGeometryDigest(base)).not.toBe(
      semanticGeometryDigest(changed),
    );
    expect(semanticGeometryDigest(base)).not.toBe(
      semanticGeometryDigest([...base, ...base]),
    );
  });

  it(
    "rejects changed world matrices across trials even when geometry counts and overall bounds remain identical",
    async () => {
      const { root, round } = await fixture();
      try {
        const target = join(round, "trials/aperture/trial-02");
        const geometry = JSON.parse(
          await readFile(join(target, "geometry.json"), "utf8"),
        );
        const transform = [-1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1];
        geometry.meshes[0].matrices = [transform];
        // A 180-degree rotation/translation keeps this triangle's aggregate AABB
        // and every reported count unchanged, but moves the actual three vertices.
        const geometryPin = await save(target, "geometry.json", geometry);
        const measurement = JSON.parse(
          await readFile(join(target, "measurement.json"), "utf8"),
        );
        Object.assign(
          measurement.artifacts.find(
            (receipt) => receipt.path === "geometry.json",
          ),
          geometryPin,
        );
        const measurementPin = await save(
          target,
          "measurement.json",
          measurement,
        );
        const receipts = JSON.parse(
          await readFile(join(target, "receipts.json"), "utf8"),
        );
        Object.assign(
          receipts.receipts.find((receipt) => receipt.path === "geometry.json"),
          geometryPin,
        );
        Object.assign(
          receipts.receipts.find(
            (receipt) => receipt.path === "measurement.json",
          ),
          measurementPin,
        );
        const receiptPin = await save(target, "receipts.json", receipts);
        const outcome = JSON.parse(
          await readFile(join(target, "outcome.json"), "utf8"),
        );
        await save(target, "outcome.json", {
          ...outcome,
          receiptManifestSha256: receiptPin.sha256,
        });
        const report = await summarizeRound(round);
        expect(
          report.engines.aperture.trials.every(
            (trial) => trial.status === "validated",
          ),
        ).toBe(true);
        expect(report.engines.aperture.trials[0].geometry.bounds).toEqual(
          report.engines.aperture.trials[1].geometry.bounds,
        );
        expect(
          report.engines.aperture.trials[0].geometry.semanticGeometrySha256,
        ).not.toBe(
          report.engines.aperture.trials[1].geometry.semanticGeometrySha256,
        );
        expect(report.scores).toBeNull();
        expect(report.validationErrors).toContainEqual({
          engine: "aperture",
          error: "App/harness/geometry changed across frozen serial trials",
        });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    OFFLINE_FIXTURE_TIMEOUT_MS,
  );
  it(
    "validates complete binary-v2 trials through the same offline summary without accepting protocol downgrade",
    async () => {
      const { root, round } = await fixture(true);
      try {
        const appOnly = await summarizeRound(round);
        expect(appOnly.status).toBe("app-artifacts-validated-unscored");
        expect(appOnly.scores).toBeNull();
        const execution = await completedExecutionFixture(root, appOnly, {
          existingApp: true,
        });
        const result = await summarizeRound(round, execution.options);
        expect(result.validationErrors).toEqual([]);
        expect(result.artifactProtocol).toBe(ARTIFACT_PROTOCOL_V2.schema);
        expect(
          result.engines.aperture.trials.every(
            (trial) =>
              trial.geometry.independentlyRecomputed &&
              trial.samples.length === 120,
          ),
        ).toBe(true);
        const target = join(round, "trials/three/trial-01"),
          outcome = JSON.parse(
            await readFile(join(target, "outcome.json"), "utf8"),
          );
        delete outcome.artifactProtocol;
        await save(target, "outcome.json", outcome);
        const invalid = await summarizeRound(round);
        expect(invalid.scores).toBeNull();
        expect(
          invalid.validationErrors.some((item) =>
            item.error.includes("protocol differs"),
          ),
        ).toBe(true);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    OFFLINE_FIXTURE_TIMEOUT_MS,
  );

  it(
    "validates surviving evidence and computes frozen component ratios while retaining every sample",
    async () => {
      const { root, round } = await fixture();
      try {
        const appOnly = await summarizeRound(round);
        expect(appOnly.status).toBe("app-artifacts-validated-unscored");
        expect(appOnly.scores).toBeNull();
        const execution = await completedExecutionFixture(root, appOnly, {
          existingApp: true,
        });
        const result = await summarizeRound(round, execution.options);
        expect(result.validationErrors).toEqual([]);
        expect(result.status).toBe(
          "validated-components-pending-independent-judging",
        );
        expect(
          result.engines.three.trials.every(
            (trial) =>
              trial.samples.length === 120 && trial.warmupSamples.length === 60,
          ),
        ).toBe(true);
        expect(
          result.engines.aperture.aggregateTiming.endToEndMs,
        ).toMatchObject({
          medianOfTrialMedians: 5,
          medianOfTrialP95: 5,
        });
        expect(result.engines.three.author).toMatchObject({
          authorRawSeconds: 100,
          authorActiveSeconds: 80,
          authorPreviewWaitingSeconds: 20,
        });
        expect(result.scores.three).toMatchObject({
          runtime: 10,
          authoringTime: 10,
          visual: null,
          geometry: null,
          combined: null,
        });
        expect(result.scores.aperture).toMatchObject({
          runtime: 6,
          authoringTime: 5,
          combined: null,
        });
        await rm(join(execution.operations[5].root, "operation.json"));
        const interrupted = await summarizeRound(round, execution.options);
        expect(interrupted.scores).toBeNull();
        expect(interrupted.status).toBe("incomplete-or-invalid-evidence");
        expect(interrupted.engines.aperture.trials[2].samples).toHaveLength(
          120,
        );
        expect(interrupted.engines.aperture.author.authorActiveSeconds).toBe(
          160,
        );
        expect(interrupted.executionEvidence.operations).toHaveLength(5);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    OFFLINE_FIXTURE_TIMEOUT_MS,
  );

  it(
    "retains failed trials and blocks scores rather than substituting or dropping their samples",
    async () => {
      const { root, round } = await fixture();
      try {
        const target = join(round, "trials/aperture/trial-02");
        const outcome = JSON.parse(
          await readFile(join(target, "outcome.json"), "utf8"),
        );
        await save(target, "outcome.json", {
          ...outcome,
          status: "failed",
          browserStatus: "failed",
        });
        const result = await summarizeRound(round);
        expect(result.status).toBe("incomplete-or-invalid-evidence");
        expect(result.scores).toBeNull();
        expect(
          result.engines.aperture.trials[1]["measurement.json"].samples,
        ).toHaveLength(120);
        expect(
          result.validationErrors.some(
            (error) => error.engine === "aperture" && error.trial === 2,
          ),
        ).toBe(true);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    OFFLINE_FIXTURE_TIMEOUT_MS,
  );

  it(
    "rejects source/hash tampering and extra trial selection",
    async () => {
      const { root, round } = await fixture();
      try {
        await writeFile(
          join(round, "trials/three/trial-01/frozen-app/assets/main.js"),
          "replaced bytes",
        );
        await mkdir(join(round, "trials/aperture/trial-04"));
        const result = await summarizeRound(round);
        expect(result.scores).toBeNull();
        expect(
          result.validationErrors.some((error) =>
            /hash\/size mismatch/.test(error.error),
          ),
        ).toBe(true);
        expect(
          result.allAttempts.some(
            (attempt) => !attempt.selected && attempt.path.endsWith("trial-04"),
          ),
        ).toBe(true);
        await rm(join(round, "author-audits/aperture-r001/audit.json"));
        const unaudited = await summarizeRound(round);
        expect(
          unaudited.engines.aperture.author.unverifiedRecordedTiming,
        ).toMatchObject({
          authorRawSeconds: 170,
          authorActiveSeconds: 160,
          authorPreviewWaitingSeconds: 10,
        });
        expect(unaudited.scores).toBeNull();
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    OFFLINE_FIXTURE_TIMEOUT_MS,
  );

  it("fails changed formulas and invalid CLI options without executing formula text", () => {
    expect(() =>
      componentScores(
        {},
        { runtimeScore: "process.exit(0)", authorTimeScore: "anything" },
      ),
    ).toThrow(/formula/);
    expect(() =>
      parseSummaryOptions(["--round", "relative", "--output", "/out.json"]),
    ).toThrow(/absolute/);
    expect(() =>
      parseSummaryOptions([
        "--round",
        "/round-001",
        "--output",
        "/out.json",
        "--allow-missing",
        "yes",
      ]),
    ).toThrow(/option/);
  });

  it(
    "keeps method v1 default and explicitly validates v2 bytes without granting missing official execution",
    async () => {
      const { root, round } = await fixture(
        true,
        "aperture.house-race-method.v2",
      );
      try {
        await expect(summarizeRound(round)).rejects.toThrow(
          "Frozen method provenance differs",
        );
        const report = await summarizeRound(round, {
          acceptedMethodSchema: "aperture.house-race-method.v2",
        });
        expect(report.validationErrors).toEqual([]);
        expect(report.status).toBe("app-artifacts-validated-unscored");
        expect(report.scores).toBeNull();
        expect(report.method.schema).toBe("aperture.house-race-method.v2");
        expect(
          parseSummaryOptions([
            "--round",
            round,
            "--output",
            "/out.json",
            "--method-schema",
            "aperture.house-race-method.v2",
          ]).acceptedMethodSchema,
        ).toBe("aperture.house-race-method.v2");
        await expect(
          summarizeRound(round, { acceptedMethodSchema: "invented-method" }),
        ).rejects.toThrow("Frozen method provenance differs");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    OFFLINE_FIXTURE_TIMEOUT_MS,
  );

  it(
    "supports the legacy audit location while rejecting a symlinked preferred directory",
    async () => {
      const { root, round } = await fixture();
      try {
        const preferred = join(round, "author-audits/three-r001"),
          legacy = join(round, "authors/three-r001/audit-final");
        await rename(preferred, legacy);
        const accepted = await summarizeRound(round);
        expect(accepted.validationErrors).toEqual([]);
        expect(accepted.engines.three.author.auditRoot).toBe(legacy);
        await symlink(legacy, preferred);
        const refused = await summarizeRound(round);
        expect(refused.scores).toBeNull();
        expect(refused.engines.three.author.error).toMatch(/no symlinks/);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    OFFLINE_FIXTURE_TIMEOUT_MS,
  );
});
