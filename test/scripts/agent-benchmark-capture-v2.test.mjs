import { describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { RecorderV2 } from "../../tools/agent-benchmark/recorder-v2.mjs";
import { installNativeObserverV2 } from "../../tools/agent-benchmark/native-observer-v2.mjs";
import { rewriteRetainedSegmentsV2 } from "../../tools/agent-benchmark/upload-segments-v2.mjs";
import { captureGeometryV2 } from "../../tools/agent-benchmark/geometry-capture-v2.mjs";
import { checkGeometryEvidenceV2 } from "../../tools/agent-benchmark/geometry-evidence-v2.mjs";
import { ARTIFACT_PROTOCOL_V2 } from "../../tools/agent-benchmark/protocol-v2.mjs";
import { sha256 } from "../../tools/agent-benchmark/recorder.mjs";
import { runMeasurement } from "../../tools/agent-benchmark/client-v2.mjs";
import {
  CONTRACT,
  SCHEMA,
  READY_GLOBAL,
} from "../../tools/agent-benchmark/contract.mjs";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const clone = (value) => JSON.parse(JSON.stringify(value));
function request(bytes, type = "application/octet-stream") {
  const result = Readable.from([bytes]);
  result.headers = { "content-type": type };
  return result;
}
function observerFixture(limits) {
  let clock = 0,
    nativeUnmaps = 0;
  class GPUAdapter {
    async requestDevice() {
      return {
        queue: {
          submit() {},
          writeBuffer() {},
          async onSubmittedWorkDone() {},
        },
        createBuffer: (descriptor) => {
          const raw = new ArrayBuffer(descriptor.size);
          return {
            destroy() {},
            getMappedRange: (offset = 0, size = descriptor.size - offset) =>
              raw.slice(offset, offset + size),
            unmap: () => {
              nativeUnmaps++;
            },
          };
        },
        createRenderPipeline: () => ({}),
        createCommandEncoder: () => ({
          beginRenderPass: () => ({
            setPipeline() {},
            setVertexBuffer() {},
            draw() {},
            end() {},
          }),
          finish: () => ({}),
        }),
      };
    }
  }
  const context = {
    GPUAdapter,
    ArrayBuffer,
    Uint8Array,
    performance: { now: () => ++clock },
  };
  runInNewContext(
    `(${installNativeObserverV2.toString()})(${rewriteRetainedSegmentsV2.toString()}, ${JSON.stringify(limits)})`,
    context,
  );
  return {
    observer: context.__AGENT_NATIVE_OBSERVER__,
    nativeUnmaps: () => nativeUnmaps,
    createDevice: () => new GPUAdapter().requestDevice(),
  };
}
const completeCapture = (bytes, segments) => ({
  limitBytes: ARTIFACT_PROTOCOL_V2.limits.nativeBytes,
  bufferRecordLimit: ARTIFACT_PROTOCOL_V2.limits.nativeBuffers,
  omittedBufferRecords: 0,
  retainedBytes: bytes,
  retainedSegments: segments,
  segmentLimit: 10000,
  segmentLimitPerBuffer: 1000,
  incompleteBufferIds: [],
  skippedWrites: 0,
  skippedBytes: 0,
  accounting: ARTIFACT_PROTOCOL_V2.observerAccounting,
});

describe("binary capture receipts and independent geometry verification", () => {
  it("commits exact values and hashes, then independently rejects mutated bytes, arrays, native parity and receipt inventories", async () => {
    const root = await mkdtemp(join(tmpdir(), "geometry-v2-evidence-"));
    try {
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
      const buffers = [
        {
          id: 0,
          label: "vertices",
          usage: 32,
          requestedBytes: 36,
          segments: [{ offset: 0, bytes: new Uint8Array(positions.buffer) }],
        },
      ];
      const after = {
        submissions: 180,
        submittedVertexBufferIds: [0],
        geometryCapture: completeCapture(36, 1),
      };
      const observer = {
        sealGeometryCapture: () => buffers,
        snapshot: () => clone(after),
      };
      const app = {
        engine: "three",
        inspectGeometry: async () => ({
          meshes: [
            {
              id: "mesh",
              positions,
              indices: new Uint16Array([0, 1, 2]),
              normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
              worldMatrix: identity,
              instances: [identity, identity],
            },
          ],
        }),
      };
      const recorder = new RecorderV2(root, "three", 1),
        receipts = [];
      const post = (name, body, type = "application/json") =>
        recorder.record(name, request(body, type));
      const summary = await captureGeometryV2(
        app,
        observer,
        receipts,
        post,
        after,
      );
      const manifest = JSON.parse(
        await readFile(
          join(root, ARTIFACT_PROTOCOL_V2.geometryManifest),
          "utf8",
        ),
      );
      const measurement = {
        engine: "three",
        artifactProtocol: ARTIFACT_PROTOCOL_V2,
        observationsAfterMeasured: after,
        geometry: summary,
        artifacts: receipts,
      };
      const verify = async (_root, pin) => {
        const bytes = await readFile(join(root, pin.path));
        expect(bytes.length).toBe(pin.bytes);
        expect(sha256(bytes)).toBe(pin.sha256);
        return bytes;
      };
      const result = await checkGeometryEvidenceV2(
        root,
        manifest,
        measurement,
        verify,
      );
      expect(result.independentlyRecomputed).toBe(true);
      expect(result.renderInstances).toBe(2);
      expect(result.exactNativePositionStreamMatches).toBe(1);
      const changes = [
        (record) => record.numeric.meshes[0].indices.byteOffset++,
        (record) => record.meshes[0].bounds.max[0]++,
        (record) => (record.meshes[0].nativePositionParity.byteOffset = 4),
        (record) => (record.nativeUploads[0].sha256 = "0".repeat(64)),
        (record) =>
          (record.nativeUploads[0].parts[0].receipt.bytes = 5 * 1024 * 1024),
        (record) => (record.sourceChunks[0].index = 1),
        (record) => (record.semanticGeometrySha256 = "0".repeat(64)),
        (record) => (record.nativeCapture.incompleteBufferIds = [0]),
      ];
      for (const change of changes) {
        const copy = clone(manifest);
        change(copy);
        await expect(
          checkGeometryEvidenceV2(root, copy, measurement, verify),
        ).rejects.toThrow();
      }
      const missing = clone(measurement);
      missing.artifacts = missing.artifacts.filter(
        (item) => !item.path.startsWith("native-buffer-"),
      );
      await expect(
        checkGeometryEvidenceV2(root, manifest, missing, verify),
      ).rejects.toThrow(/Unreferenced\/missing/);
      const badBytes = async (_root, pin) => {
        const bytes = await verify(root, pin);
        if (pin.path.startsWith("geometry-chunk-")) bytes[0] ^= 1;
        return bytes;
      };
      await expect(
        checkGeometryEvidenceV2(root, manifest, measurement, badBytes),
      ).rejects.toThrow();
      await expect(
        recorder.record(receipts[0].path, request(new Uint8Array([0]))),
      ).rejects.toThrow(/Duplicate/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("retains a bounded rejected prefix and permits the reserved raw-sample failure record after aggregate exhaustion", async () => {
    const root = await mkdtemp(join(tmpdir(), "geometry-v2-rejection-"));
    try {
      const recorder = new RecorderV2(root, "three", 1),
        limit = ARTIFACT_PROTOCOL_V2.limits.chunkBytes;
      await expect(
        recorder.record(
          "geometry-chunk-00000.bin",
          request(Buffer.alloc(limit + 1)),
        ),
      ).rejects.toThrow(/body limit/);
      expect(recorder.failures[0].observedBytesLowerBound).toBe(limit + 1);
      expect(
        (await readFile(join(root, recorder.failures[0].boundedPrefix.path)))
          .length,
      ).toBe(limit);
      recorder.nonFailureAttemptedBytes =
        ARTIFACT_PROTOCOL_V2.maxAttemptedBytes;
      await expect(
        recorder.record(
          "geometry-chunk-00001.bin",
          request(new Uint8Array([1])),
        ),
      ).rejects.toThrow(/Aggregate/);
      const failure = {
        schema: SCHEMA,
        artifactProtocol: ARTIFACT_PROTOCOL_V2,
        warmup: Array.from({ length: 60 }, (_, frame) => ({ frame })),
        samples: Array.from({ length: 120 }, (_, i) => ({ frame: 60 + i })),
        error: { message: "bounded export rejected" },
      };
      await recorder.record(
        "failure.json",
        request(Buffer.from(JSON.stringify(failure)), "application/json"),
      );
      expect(
        JSON.parse(await readFile(join(root, "failure.json"), "utf8")).samples,
      ).toHaveLength(120);
      await expect(recorder.verifyMeasurementFile()).rejects.toThrow(
        /did not finish/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("bounded v2 native observer", () => {
  it("caps empty buffer records with explicit incomplete evidence while retaining native create/destroy counts", async () => {
    const { observer, createDevice } = observerFixture({
        bytes: 64,
        segments: 4,
        perBuffer: 4,
        buffers: 2,
      }),
      device = await createDevice();
    const created = Array.from({ length: 10 }, () =>
      device.createBuffer({ size: 0, usage: 32 }),
    );
    for (const buffer of created) buffer.destroy();
    expect(observer.snapshot().buffersCreated).toBe(10);
    expect(observer.snapshot().buffersDestroyed).toBe(10);
    expect(observer.snapshot().geometryCapture.omittedBufferRecords).toBe(8);
    expect(observer.snapshot().geometryCapture.bufferRecordLimit).toBe(2);
  });
  it("preflights mapped spans without oversized copies and calls the native unmap even on capture exhaustion", async () => {
    const { observer, createDevice, nativeUnmaps } = observerFixture({
        bytes: 8,
        segments: 2,
        perBuffer: 2,
      }),
      device = await createDevice();
    const buffer = device.createBuffer({
      size: 16,
      usage: 32,
      mappedAtCreation: true,
    });
    new Uint8Array(buffer.getMappedRange()).fill(7);
    buffer.unmap();
    expect(nativeUnmaps()).toBe(1);
    expect(observer.snapshot().geometryCapture.retainedBytes).toBe(0);
    expect(observer.snapshot().geometryCapture.skippedBytes).toBe(16);
    expect(observer.snapshot().geometryCapture.incompleteBufferIds).toEqual([
      0,
    ]);
  });
  it("bounds pending mapped-range metadata and records discarded spans before an actual native unmap", async () => {
    const { observer, createDevice, nativeUnmaps } = observerFixture({
        bytes: 64,
        segments: 2,
        perBuffer: 2,
      }),
      device = await createDevice();
    const buffer = device.createBuffer({
      size: 32,
      usage: 32,
      mappedAtCreation: true,
    });
    for (const offset of [0, 8, 16])
      new Uint8Array(buffer.getMappedRange(offset, 4)).fill(1);
    buffer.unmap();
    expect(nativeUnmaps()).toBe(1);
    expect(observer.snapshot().geometryCapture.retainedSegments).toBe(2);
    expect(observer.snapshot().geometryCapture.skippedWrites).toBe(1);
    expect(observer.snapshot().geometryCapture.skippedBytes).toBe(4);
    expect(observer.snapshot().geometryCapture.incompleteBufferIds).toEqual([
      0,
    ]);
  });
  it("allows an exact overwrite at the byte cap and records permanent incompleteness on real overflow", async () => {
    const { observer, createDevice } = observerFixture({
        bytes: 8,
        segments: 4,
        perBuffer: 4,
      }),
      device = await createDevice(),
      buffer = device.createBuffer({ size: 32, usage: 32 });
    device.queue.writeBuffer(buffer, 0, new Uint8Array(8));
    device.queue.writeBuffer(buffer, 0, new Uint8Array(8).fill(2));
    expect(observer.snapshot().geometryCapture.retainedBytes).toBe(8);
    expect(observer.snapshot().geometryCapture.skippedWrites).toBe(0);
    device.queue.writeBuffer(buffer, 4, new Uint8Array(8).fill(3));
    expect(observer.snapshot().geometryCapture.retainedBytes).toBe(4);
    expect(observer.snapshot().geometryCapture.incompleteBufferIds).toEqual([
      0,
    ]);
    device.queue.writeBuffer(buffer, 0, new Uint8Array(4).fill(4));
    expect(observer.snapshot().geometryCapture.incompleteBufferIds).toEqual([
      0,
    ]);
  });
  it("bounds disjoint fragment metadata while leaving native submissions/draws unchanged", async () => {
    const { observer, createDevice } = observerFixture({
        bytes: 64,
        segments: 2,
        perBuffer: 2,
      }),
      device = await createDevice(),
      buffer = device.createBuffer({ size: 32, usage: 32 });
    for (const offset of [0, 8, 16])
      device.queue.writeBuffer(buffer, offset, new Uint8Array(4));
    const pipeline = device.createRenderPipeline({
        primitive: { topology: "triangle-list" },
      }),
      encoder = device.createCommandEncoder(),
      pass = encoder.beginRenderPass({});
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, buffer);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    expect(observer.snapshot().geometryCapture.retainedSegments).toBe(2);
    expect(observer.snapshot().geometryCapture.skippedWrites).toBe(1);
    expect(observer.snapshot().submissions).toBe(1);
    expect(observer.snapshot().drawCalls).toBe(1);
    const captured = observer.sealGeometryCapture();
    expect(captured[0].captureFailureReason).toBe(
      "native-capture-segment-budget-exceeded",
    );
    expect(captured[0].segments).toHaveLength(2);
  });
});

describe("post-measurement export failure retention", () => {
  it("runs the unchanged60+120 sequence before export and preserves every sample when export throws", async () => {
    let submissions = 0,
      lastSubmitAt = 0,
      sealAt = null,
      inspectAt = null;
    const posts = [];
    const keys = [
      "drawCalls",
      "submittedTriangles",
      "unknownDirectTriangleDrawCalls",
      "knownIndirectDrawCalls",
      "unknownIndirectDrawCalls",
      "knownIndirectTriangles",
      "renderPasses",
      "submissions",
      "indirectDrawCalls",
      "nonTriangleDrawCalls",
      "unknownTopologyDrawCalls",
      "unknownCommandBuffers",
      "computePasses",
      "buffersCreated",
      "buffersDestroyed",
      "texturesCreated",
      "texturesDestroyed",
      "renderPipelinesCreated",
    ];
    const snapshot = () => ({
      ...Object.fromEntries(
        keys.map((key) => [
          key,
          [
            "drawCalls",
            "submittedTriangles",
            "renderPasses",
            "submissions",
          ].includes(key)
            ? submissions
            : 0,
        ]),
      ),
      lastSubmitAt,
      workerEvidence: [],
      unknownIndirectReasons: {},
      geometryCapture: completeCapture(0, 0),
    });
    class Canvas {
      width = 1024;
      height = 768;
    }
    const canvas = new Canvas();
    vi.stubGlobal("HTMLCanvasElement", Canvas);
    vi.stubGlobal("document", { querySelectorAll: () => [canvas] });
    vi.stubGlobal("devicePixelRatio", 1);
    vi.stubGlobal("__AGENT_NATIVE_OBSERVER__", {
      snapshot,
      beginIndirectArgumentSample: () => {},
      sampleIndirectArgumentReferences: () => ({
        references: [],
        unretainedKnownDrawCalls: 0,
      }),
      exportIndirectArgumentProof: () => ({
        schema: "aperture.native-indirect-arguments.v2.1",
        capacityExceeded: false,
        maxWitnesses: 16384,
        witnesses: [],
      }),
      fence: async () => performance.now(),
      sealGeometryCapture: () => {
        sealAt = submissions;
        return [];
      },
    });
    vi.stubGlobal("__APERTURE_VERIFIED_GPU__", { native: true });
    vi.stubGlobal("__AGENT_BENCHMARK__", {
      engine: "three",
      canvas,
      ready: Promise.resolve(),
      setCamera: async () => {},
      renderFrame: async () => {
        submissions++;
        lastSubmitAt = performance.now();
      },
      inspectGeometry: async () => {
        inspectAt = submissions;
        throw new Error("deliberate export failure");
      },
      dispose: async () => {},
    });
    vi.stubGlobal("fetch", async (path, options) => {
      if (!options)
        return {
          json: async () => ({
            engine: "three",
            trial: 1,
            contract: CONTRACT,
            artifactProtocol: ARTIFACT_PROTOCOL_V2,
          }),
        };
      const bytes = options.body;
      posts.push({ path, body: JSON.parse(new TextDecoder().decode(bytes)) });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          path: path.split("/").at(-1),
          bytes: bytes.length,
          sha256: sha256(bytes),
        }),
      };
    });
    try {
      await runMeasurement();
      expect(sealAt).toBe(180);
      expect(inspectAt).toBe(180);
      const failure = posts.find((item) =>
        item.path.endsWith("failure.json"),
      ).body;
      expect(failure.warmup.map((item) => item.frame)).toEqual(
        Array.from({ length: 60 }, (_, i) => i),
      );
      expect(failure.samples.map((item) => item.frame)).toEqual(
        Array.from({ length: 120 }, (_, i) => 60 + i),
      );
      expect(
        failure.observationsAfterMeasured.submissions -
          failure.observationsBeforeMeasured.submissions,
      ).toBe(120);
      expect(globalThis[READY_GLOBAL].ok).toBe(false);
      expect(failure.error.message).toBe("deliberate export failure");
    } finally {
      vi.unstubAllGlobals();
      delete globalThis[READY_GLOBAL];
      delete globalThis.__AGENT_BENCHMARK_PROGRESS__;
    }
  });
});
