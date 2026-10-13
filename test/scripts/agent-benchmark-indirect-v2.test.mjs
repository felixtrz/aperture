import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { ARTIFACT_PROTOCOL_V2 } from "../../tools/agent-benchmark/protocol-v2.mjs";
import { runMeasurement } from "../../tools/agent-benchmark/client-v2.mjs";
import { installNativeObserverV2 } from "../../tools/agent-benchmark/native-observer-v2.mjs";
import { sha256 } from "../../tools/agent-benchmark/recorder.mjs";
import { runInNewContext } from "node:vm";
import { createIndirectArgumentTrackerV2 } from "../../tools/agent-benchmark/indirect-args-v2.mjs";
import { rewriteRetainedSegmentsV2 } from "../../tools/agent-benchmark/upload-segments-v2.mjs";
import {
  TRIANGLE_ACCOUNTING_V2,
  validateTriangleAccountingV2,
  validateTriangleArgumentProofV2,
} from "../../tools/agent-benchmark/triangle-accounting-v2.mjs";

function argumentsBytes(indexed = true, count = 66, instances = 3) {
  const raw = new Uint8Array(indexed ? 20 : 16),
    view = new DataView(raw.buffer);
  view.setUint32(0, count, true);
  view.setUint32(4, instances, true);
  view.setUint32(8, 7, true);
  if (indexed) view.setInt32(12, -5, true);
  view.setUint32(indexed ? 16 : 12, 11, true);
  return raw;
}
function fixture(
  limits = { bytes: 1024, segments: 100, perBuffer: 100, buffers: 100 },
) {
  let clock = 0;
  const actual = [];
  class BufferMock {
    constructor(size) {
      this.raw = new Uint8Array(size);
      this.ranges = [];
    }
    getMappedRange(offset = 0, size = this.raw.length - offset) {
      const range = this.raw.slice(offset, offset + size).buffer;
      this.ranges.push({ offset, range });
      return range;
    }
    async mapAsync() {}
    unmap() {
      for (const item of this.ranges) {
        this.raw.set(new Uint8Array(item.range), item.offset);
        structuredClone(item.range, { transfer: [item.range] });
      }
      this.ranges = [];
    }
    destroy() {}
  }
  const pass = (operations) => ({
    setPipeline() {},
    setVertexBuffer() {},
    draw() {
      operations.push(() => actual.push({ method: "draw" }));
    },
    drawIndexed() {
      operations.push(() => actual.push({ method: "drawIndexed" }));
    },
    drawIndirect(buffer, offset) {
      operations.push(() =>
        actual.push({
          method: "drawIndirect",
          count: new DataView(buffer.raw.buffer).getUint32(offset, true),
        }),
      );
    },
    drawIndexedIndirect(buffer, offset) {
      operations.push(() =>
        actual.push({
          method: "drawIndexedIndirect",
          count: new DataView(buffer.raw.buffer).getUint32(offset, true),
        }),
      );
    },
    experimentalBufferMutation() {
      operations.push(() => {});
    },
    executeBundles(values) {
      for (const value of values) operations.push(...value.operations);
    },
    end() {},
  });
  class GPUAdapter {
    async requestDevice() {
      return {
        queue: {
          writeBuffer(buffer, offset, data, start = 0, size) {
            const unit = data.BYTES_PER_ELEMENT ?? 1,
              raw = ArrayBuffer.isView(data)
                ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
                : new Uint8Array(data);
            buffer.raw.set(
              raw.subarray(
                start * unit,
                size === undefined ? raw.length : (start + size) * unit,
              ),
              offset,
            );
          },
          submit(values) {
            for (const value of values)
              for (const operation of value.operations ?? []) operation();
          },
          async onSubmittedWorkDone() {},
          experimentalBufferMutation() {},
        },
        createBuffer: (descriptor) => new BufferMock(descriptor.size),
        createRenderPipeline: () => ({}),
        createRenderBundleEncoder() {
          const operations = [],
            result = { ...pass(operations), finish: () => ({ operations }) };
          return result;
        },
        createCommandEncoder() {
          const operations = [];
          return {
            beginRenderPass: () => pass(operations),
            beginComputePass: () => ({ end() {} }),
            copyBufferToBuffer(
              source,
              sourceOffset,
              target,
              targetOffset,
              size,
            ) {
              operations.push(() =>
                target.raw.set(
                  source.raw.subarray(sourceOffset, sourceOffset + size),
                  targetOffset,
                ),
              );
            },
            copyTextureToBuffer(_source, target) {
              operations.push(() => target.buffer.raw.fill(0));
            },
            clearBuffer(target) {
              operations.push(() => target.raw.fill(0));
            },
            resolveQuerySet(_query, _first, _count, target) {
              operations.push(() => target.raw.fill(0));
            },
            experimentalBufferMutation() {
              operations.push(() => {});
            },
            finish: () => ({ operations }),
          };
        },
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
    `(${installNativeObserverV2.toString()})(${rewriteRetainedSegmentsV2.toString()},${JSON.stringify(limits)},${createIndirectArgumentTrackerV2.toString()})`,
    context,
  );
  return {
    context,
    actual,
    observer: context.__AGENT_NATIVE_OBSERVER__,
    device: () => new GPUAdapter().requestDevice(),
  };
}
function encode(
  device,
  buffer,
  {
    method = "drawIndexedIndirect",
    offset = 0,
    topology = "triangle-list",
    vertexBuffer,
  } = {},
) {
  const encoder = device.createCommandEncoder(),
    pass = encoder.beginRenderPass({});
  pass.setPipeline(device.createRenderPipeline({ primitive: { topology } }));
  if (vertexBuffer) pass.setVertexBuffer(0, vertexBuffer);
  pass[method](buffer, offset);
  pass.end();
  return encoder;
}
function sample(observer, before) {
  const after = observer.snapshot(),
    references = observer.sampleIndirectArgumentReferences();
  return {
    ...Object.fromEntries(
      [
        "submittedTriangles",
        "indirectDrawCalls",
        "unknownDirectTriangleDrawCalls",
        "knownIndirectDrawCalls",
        "unknownIndirectDrawCalls",
        "knownIndirectTriangles",
        "unknownTopologyDrawCalls",
        "unknownCommandBuffers",
      ].map((key) => [key, after[key] - before[key]]),
    ),
    unknownIndirectReasons: Object.fromEntries(
      Object.keys(after.unknownIndirectReasons)
        .map((reason) => [
          reason,
          (after.unknownIndirectReasons[reason] ?? 0) -
            (before.unknownIndirectReasons[reason] ?? 0),
        ])
        .filter(([, count]) => count > 0),
    ),
    nativeIndirectArgumentReferences: references.references,
    unretainedKnownIndirectDrawCalls: references.unretainedKnownDrawCalls,
    submittedTriangleAccounting: {
      schema: TRIANGLE_ACCOUNTING_V2.schema,
      proofStatus: references.unretainedKnownDrawCalls
        ? "incomplete"
        : "complete",
      confidence:
        after.unknownDirectTriangleDrawCalls -
          before.unknownDirectTriangleDrawCalls ||
        after.unknownIndirectDrawCalls - before.unknownIndirectDrawCalls ||
        after.unknownTopologyDrawCalls - before.unknownTopologyDrawCalls ||
        after.unknownCommandBuffers - before.unknownCommandBuffers
          ? "lower-bound"
          : "exact-supported-command-arguments",
    },
  };
}

describe("native upload evidence scope", () => {
  it("ignores unrelated disjoint uploads without starving submitted vertex or CPU argument proof", async () => {
    const { device, observer } = await setup(256 | 8, {
      bytes: 128,
      segments: 3,
      perBuffer: 3,
      buffers: 100,
    });
    for (const usage of [64 | 8, 16 | 8, 4 | 8, 128 | 8, 256 | 128 | 8]) {
      const irrelevant = device.createBuffer({ size: 128, usage });
      for (let offset = 0; offset < 128; offset += 8)
        device.queue.writeBuffer(
          irrelevant,
          offset,
          new Uint8Array([1, 2, 3, 4]),
        );
    }
    const vertex = device.createBuffer({ size: 12, usage: 32 | 8 }),
      args = device.createBuffer({ size: 20, usage: 256 | 8 });
    device.queue.writeBuffer(vertex, 0, new Uint8Array(12).fill(7));
    device.queue.writeBuffer(args, 0, argumentsBytes());
    device.queue.submit([
      encode(device, args, { vertexBuffer: vertex }).finish(),
    ]);
    expect(observer.snapshot()).toMatchObject({
      buffersCreated: 8,
      knownIndirectDrawCalls: 1,
      knownIndirectTriangles: 66,
      geometryCapture: {
        retainedBytes: 32,
        retainedSegments: 2,
        skippedWrites: 0,
        incompleteBufferIds: [],
      },
    });
    const sealed = observer.sealGeometryCapture();
    expect(sealed).toHaveLength(1);
    expect([...sealed[0].segments[0].bytes]).toEqual(new Array(12).fill(7));
    device.queue.writeBuffer(args, 0, argumentsBytes(true, 72, 3));
    device.queue.submit([
      encode(device, args, { vertexBuffer: vertex }).finish(),
    ]);
    expect(observer.snapshot().knownIndirectTriangles).toBe(138);
    expect([...sealed[0].segments[0].bytes]).toEqual(new Array(12).fill(7));
  });

  it("retains mapped mixed vertex/storage bytes but keeps storage indirect arguments unknown", async () => {
    const { device, observer } = await setup();
    const mixed = device.createBuffer({
      size: 20,
      usage: 32 | 256 | 128 | 8,
      mappedAtCreation: true,
    });
    new Uint8Array(mixed.getMappedRange()).set(argumentsBytes());
    mixed.unmap();
    device.queue.submit([
      encode(device, mixed, { vertexBuffer: mixed }).finish(),
    ]);
    expect(observer.snapshot()).toMatchObject({
      knownIndirectDrawCalls: 0,
      unknownIndirectDrawCalls: 1,
    });
    const sealed = observer.sealGeometryCapture();
    expect(sealed).toHaveLength(1);
    expect([...sealed[0].segments[0].bytes]).toEqual([...argumentsBytes()]);
  });

  it("keeps the same hard vertex budget and reports genuine candidate overflow", async () => {
    const { device, observer } = await setup(256 | 8, {
      bytes: 8,
      segments: 1,
      perBuffer: 1,
      buffers: 10,
    });
    const vertex = device.createBuffer({ size: 16, usage: 32 | 8 });
    device.queue.writeBuffer(vertex, 0, new Uint8Array(16));
    expect(
      observer.snapshot().geometryCapture.incompleteBufferIds,
    ).not.toHaveLength(0);
    expect(observer.snapshot().geometryCapture.limitBytes).toBe(8);
  });
});
async function setup(usage = 256 | 8, limits) {
  const result = fixture(limits),
    device = await result.device(),
    buffer = device.createBuffer({ size: 64, usage });
  return { ...result, device, buffer };
}

describe("native CPU-readable indirect argument accounting", () => {
  it.each([
    ["drawIndexedIndirect", true, 66, 3, 66],
    ["drawIndirect", false, 12, 2, 8],
  ])(
    "decodes %s full native bytes with instances and signed indexed metadata",
    async (method, indexed, count, instances, expected) => {
      const { device, buffer, observer, actual } = await setup();
      device.queue.writeBuffer(
        buffer,
        8,
        argumentsBytes(indexed, count, instances),
      );
      const encoder = encode(device, buffer, { method, offset: 8 });
      observer.beginIndirectArgumentSample();
      const before = observer.snapshot();
      device.queue.submit([encoder.finish()]);
      const frame = sample(observer, before);
      expect(actual[0].count).toBe(count);
      expect(frame.submittedTriangles).toBe(expected);
      expect(frame.knownIndirectDrawCalls).toBe(1);
      expect(frame.unknownIndirectDrawCalls).toBe(0);
      validateTriangleAccountingV2(frame);
      const proof = observer.exportIndirectArgumentProof();
      expect(proof.witnesses[0].byteOffset).toBe(8);
      if (indexed) expect(proof.witnesses[0].baseVertex).toBe(-5);
      validateTriangleArgumentProofV2({
        warmup: [],
        samples: [frame],
        nativeIndirectArgumentProof: proof,
      });
    },
  );
  it("reads latest successful CPU upload at submit rather than encoder time", async () => {
    const { device, buffer, observer, actual } = await setup();
    device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 3, 1));
    const encoder = encode(device, buffer);
    device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 30, 2));
    device.queue.submit([encoder.finish()]);
    expect(actual[0].count).toBe(30);
    expect(observer.snapshot().submittedTriangles).toBe(20);
  });
  it("requires the complete argument span and combines split CPU spans after invalidation", async () => {
    const { device, buffer, observer } = await setup();
    const args = argumentsBytes();
    device.queue.writeBuffer(buffer, 0, args.subarray(0, 8));
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
    device.queue.writeBuffer(buffer, 8, args.subarray(8));
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(1);
    expect(observer.snapshot().submittedTriangles).toBe(66);
  });
  it("captures mapped writes before a real native-mock unmap detaches the ranges", async () => {
    const { device, observer } = await setup();
    const buffer = device.createBuffer({
        size: 24,
        usage: 256 | 8,
        mappedAtCreation: true,
      }),
      range = buffer.getMappedRange();
    new Uint8Array(range).set(argumentsBytes());
    buffer.unmap();
    expect(range.byteLength).toBe(0);
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().submittedTriangles).toBe(66);
  });
  it("never treats STORAGE args or shared CPU sources as proven", async () => {
    for (const usage of [256 | 8 | 128, 256 | 8]) {
      const { device, buffer, observer } = await setup(usage);
      let args = argumentsBytes();
      if (!(usage & 128)) {
        const shared = new Uint8Array(new SharedArrayBuffer(20));
        shared.set(args);
        args = shared;
      }
      device.queue.writeBuffer(buffer, 0, args);
      device.queue.submit([encode(device, buffer).finish()]);
      expect(observer.snapshot().knownIndirectDrawCalls).toBe(0);
      expect(observer.snapshot().indirectDrawCalls).toBe(1);
      expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
    }
  });
  it.each([
    "copyBufferToBuffer",
    "copyTextureToBuffer",
    "clearBuffer",
    "resolveQuerySet",
  ])(
    "invalidates %s at accepted encode and submit, even after a CPU overwrite between them",
    async (method) => {
      const { device, buffer, observer } = await setup();
      device.queue.writeBuffer(buffer, 0, argumentsBytes());
      const encoder = encode(device, buffer),
        source = device.createBuffer({ size: 64, usage: 4 | 8 });
      if (method === "copyBufferToBuffer")
        encoder[method](source, 0, buffer, 0, 20);
      else if (method === "copyTextureToBuffer")
        encoder[method]({}, { buffer }, {});
      else if (method === "clearBuffer") encoder[method](buffer);
      else encoder[method]({}, 0, 1, buffer, 0);
      device.queue.writeBuffer(buffer, 0, argumentsBytes());
      device.queue.submit([encoder.finish()]);
      expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
      device.queue.writeBuffer(buffer, 0, argumentsBytes());
      device.queue.submit([encode(device, buffer).finish()]);
      expect(observer.snapshot().knownIndirectDrawCalls).toBe(1);
    },
  );
  it("does not restore GPU-mutated provenance until every argument byte has a later CPU write", async () => {
    const { device, buffer, observer } = await setup();
    const args = argumentsBytes();
    device.queue.writeBuffer(buffer, 0, args);
    const mutation = device.createCommandEncoder();
    mutation.clearBuffer(buffer);
    device.queue.submit([mutation.finish()]);
    device.queue.writeBuffer(buffer, 0, args.subarray(0, 8));
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
    device.queue.writeBuffer(buffer, 8, args.subarray(8));
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(1);
  });
  it.each(["encoder", "pass", "queue", "unknown-command-buffer"])(
    "rejects unmodeled mutation route: %s",
    async (route) => {
      const { device, buffer, observer } = await setup();
      device.queue.writeBuffer(buffer, 0, argumentsBytes());
      const encoder = encode(device, buffer);
      if (route === "encoder") encoder.experimentalBufferMutation();
      if (route === "pass") {
        const pass = encoder.beginRenderPass({});
        pass.experimentalBufferMutation();
        pass.end();
      }
      if (route === "queue") device.queue.experimentalBufferMutation();
      if (route === "unknown-command-buffer") device.queue.submit([{}]);
      device.queue.submit([encoder.finish()]);
      expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
    },
  );
  it("keeps calls visible when native capture is incomplete and never reads stale overwritten args", async () => {
    const { device, buffer, observer } = await setup(256 | 8, {
      bytes: 16,
      segments: 100,
      perBuffer: 100,
      buffers: 100,
    });
    device.queue.writeBuffer(buffer, 0, argumentsBytes());
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().indirectDrawCalls).toBe(1);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(0);
    expect(observer.snapshot().submittedTriangles).toBe(0);
  });
  it.each([
    ["drawIndirect", "triangle-strip", 5, 2, 6, true],
    ["drawIndexedIndirect", "triangle-strip", 5, 2, 0, false],
    ["drawIndirect", "line-list", 5, 2, 0, false],
  ])(
    "supports only established topology/restart semantics %s/%s",
    async (method, topology, count, instances, expected, known) => {
      const { device, buffer, observer } = await setup();
      device.queue.writeBuffer(
        buffer,
        0,
        argumentsBytes(method === "drawIndexedIndirect", count, instances),
      );
      device.queue.submit([
        encode(device, buffer, { method, topology }).finish(),
      ]);
      expect(observer.snapshot().submittedTriangles).toBe(expected);
      expect(observer.snapshot().knownIndirectDrawCalls).toBe(Number(known));
      expect(observer.snapshot().unknownIndirectDrawCalls).toBe(Number(!known));
    },
  );
  it("deduplicates static witnesses across180 frames and retains exact per-frame multiplicity", async () => {
    const { device, buffer, observer } = await setup();
    device.queue.writeBuffer(buffer, 0, argumentsBytes());
    const frames = [];
    for (let i = 0; i < 180; i++) {
      observer.beginIndirectArgumentSample();
      const before = observer.snapshot();
      const encoder = device.createCommandEncoder(),
        pass = encoder.beginRenderPass({});
      pass.setPipeline(
        device.createRenderPipeline({
          primitive: { topology: "triangle-list" },
        }),
      );
      for (let j = 0; j < 120; j++) pass.drawIndexedIndirect(buffer, 0);
      pass.end();
      device.queue.submit([encoder.finish()]);
      frames.push(sample(observer, before));
    }
    expect(observer.exportIndirectArgumentProof().witnesses).toHaveLength(1);
    expect(
      frames.every(
        (frame) =>
          frame.knownIndirectDrawCalls === 120 &&
          frame.submittedTriangles === 7920 &&
          frame.nativeIndirectArgumentReferences[0][1] === 120,
      ),
    ).toBe(true);
    validateTriangleArgumentProofV2({
      warmup: frames.slice(0, 60),
      samples: frames.slice(60),
      nativeIndirectArgumentProof: observer.exportIndirectArgumentProof(),
    });
  });
});

describe("bounded raw argument proof and independent decode", () => {
  it("proof capacity cannot turn actual known triangle counters into moving lower bounds", () => {
    const tracker = createIndirectArgumentTrackerV2({ maxWitnesses: 1 }),
      raw = argumentsBytes(),
      record = {
        id: 1,
        usage: 256 | 8,
        requestedBytes: 20,
        segments: [{ offset: 0, bytes: raw }],
      };
    tracker.cpuWrite(record, 0, 20);
    expect(
      tracker.inspect(record, "drawIndexedIndirect", 0, "triangle-list"),
    ).toMatchObject({ known: true, triangles: 66, witnessId: 0 });
    record.segments[0].bytes = argumentsBytes(true, 69, 3);
    tracker.cpuWrite(record, 0, 20);
    expect(
      tracker.inspect(record, "drawIndexedIndirect", 0, "triangle-list"),
    ).toMatchObject({
      known: true,
      triangles: 69,
      witnessId: null,
      proofIncomplete: true,
    });
    expect(tracker.exportProof().capacityExceeded).toBe(true);
  });
  it("rejects unsafe exact contributions and independently detects changed bytes, signed args, references or claims", async () => {
    const { device, buffer, observer } = await setup();
    device.queue.writeBuffer(buffer, 0, argumentsBytes());
    observer.beginIndirectArgumentSample();
    const before = observer.snapshot();
    device.queue.submit([encode(device, buffer).finish()]);
    const frame = sample(observer, before),
      record = {
        warmup: [],
        samples: [frame],
        nativeIndirectArgumentProof: observer.exportIndirectArgumentProof(),
      };
    for (const change of [
      (copy) =>
        (copy.nativeIndirectArgumentProof.witnesses[0].argumentBytesHex =
          "0".repeat(40)),
      (copy) => (copy.nativeIndirectArgumentProof.witnesses[0].baseVertex = 4),
      (copy) => (copy.samples[0].nativeIndirectArgumentReferences[0][1] = 2),
      (copy) => copy.samples[0].knownIndirectTriangles++,
    ]) {
      const copy = structuredClone(record);
      change(copy);
      expect(() => validateTriangleArgumentProofV2(copy)).toThrow();
    }
    device.queue.writeBuffer(
      buffer,
      0,
      argumentsBytes(true, 0xffffffff, 0xffffffff),
    );
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
  });
});

describe("serialized injection and full measurement retention", () => {
  it("runs the actual staged run-v2 serialized classic script in a fresh VM with its third-argument tracker factory", async () => {
    const source = await readFile(
      new URL("../../tools/agent-benchmark/run-v2.mjs", import.meta.url),
      "utf8",
    );
    const functionSource = source
      .slice(
        source.indexOf("export function injectHarnessV2("),
        source.indexOf("\nexport async function runAttemptV2("),
      )
      .replace("export function", "function");
    const inject = runInNewContext(`(${functionSource})`, {
      installNativeObserverV2,
      rewriteRetainedSegmentsV2,
      createIndirectArgumentTrackerV2,
      ARTIFACT_PROTOCOL_V2,
      requireValue: (value, message) => {
        if (!value) throw new Error(message);
      },
    });
    const html = inject("<html><head></head><body></body></html>"),
      classic = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    class GPUAdapter {
      async requestDevice() {
        return {
          queue: {
            writeBuffer() {},
            submit() {},
            async onSubmittedWorkDone() {},
          },
          createBuffer: () => ({ destroy() {} }),
          createRenderPipeline: () => ({}),
          createCommandEncoder: () => ({
            beginRenderPass: () => ({
              setPipeline() {},
              drawIndexedIndirect() {},
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
      performance: { now: () => 1 },
    };
    runInNewContext(classic, context);
    const device = await new GPUAdapter().requestDevice(),
      buffer = device.createBuffer({ size: 20, usage: 256 | 8 });
    device.queue.writeBuffer(buffer, 0, argumentsBytes());
    device.queue.submit([encode(device, buffer).finish()]);
    expect(
      context.__AGENT_NATIVE_OBSERVER__.snapshot().knownIndirectDrawCalls,
    ).toBe(1);
    expect(
      context.__AGENT_NATIVE_OBSERVER__.snapshot().submittedTriangles,
    ).toBe(66);
  });
  it("fails proof-capacity export after all60+120 frames without changing decoded known counters", async () => {
    const { device, buffer, observer, context } = await setup(256 | 8, {
      bytes: 1024,
      segments: 100,
      perBuffer: 100,
      buffers: 100,
      argumentWitnesses: 1,
    });
    const posts = [];
    let rendered = 0,
      inspected = 0;
    class Canvas {
      width = 1024;
      height = 768;
    }
    const canvas = new Canvas();
    vi.stubGlobal("performance", context.performance);
    vi.stubGlobal("HTMLCanvasElement", Canvas);
    vi.stubGlobal("document", { querySelectorAll: () => [canvas] });
    vi.stubGlobal("devicePixelRatio", 1);
    vi.stubGlobal("__AGENT_NATIVE_OBSERVER__", observer);
    vi.stubGlobal("__APERTURE_VERIFIED_GPU__", { native: true });
    vi.stubGlobal("__AGENT_BENCHMARK__", {
      engine: "three",
      canvas,
      ready: Promise.resolve(),
      setCamera: async () => {},
      renderFrame: async () => {
        rendered++;
        device.queue.writeBuffer(
          buffer,
          0,
          argumentsBytes(true, rendered * 3, 1),
        );
        device.queue.submit([encode(device, buffer).finish()]);
      },
      inspectGeometry: async () => {
        inspected++;
        return { meshes: [] };
      },
      dispose: async () => {},
    });
    vi.stubGlobal("fetch", async (path, options) => {
      if (!options)
        return {
          json: async () => ({
            engine: "three",
            trial: 1,
            contract: (await import("../../tools/agent-benchmark/contract.mjs"))
              .CONTRACT,
            artifactProtocol: ARTIFACT_PROTOCOL_V2,
          }),
        };
      posts.push({
        path,
        body: JSON.parse(new TextDecoder().decode(options.body)),
      });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          path: path.split("/").at(-1),
          bytes: options.body.length,
          sha256: sha256(options.body),
        }),
      };
    });
    try {
      await runMeasurement();
      const failure = posts.find((item) =>
        item.path.endsWith("failure.json"),
      ).body;
      expect(rendered).toBe(180);
      expect(inspected).toBe(0);
      expect(failure.warmup).toHaveLength(60);
      expect(failure.samples).toHaveLength(120);
      expect(
        failure.samples.every(
          (frame) =>
            frame.knownIndirectDrawCalls === 1 &&
            frame.unknownIndirectDrawCalls === 0,
        ),
      ).toBe(true);
      expect(failure.samples.map((frame) => frame.submittedTriangles)).toEqual(
        Array.from({ length: 120 }, (_, i) => 61 + i),
      );
      expect(failure.error.message).toMatch(/proof metadata capacity/);
      expect(failure.nativeIndirectArgumentProof.capacityExceeded).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      delete globalThis.__AGENT_BENCHMARK_STATUS__;
      delete globalThis.__AGENT_BENCHMARK_PROGRESS__;
    }
  });
  it("reports explicit reason counts for unreadable arguments in valid lower-bound samples", async () => {
    const { device, buffer, observer } = await setup(256 | 8 | 128);
    device.queue.writeBuffer(buffer, 0, argumentsBytes());
    observer.beginIndirectArgumentSample();
    const before = observer.snapshot();
    device.queue.submit([encode(device, buffer).finish()]);
    const frame = sample(observer, before);
    validateTriangleAccountingV2(frame);
    expect(frame.unknownIndirectReasons).toEqual({
      "storage-buffer-gpu-writable": 1,
    });
    expect(frame.submittedTriangleAccounting.confidence).toBe("lower-bound");
  });
});

describe("bundle replay and unsupported direct primitive scope", () => {
  it("keeps legitimate bundle finish readable and decodes latest args on every native replay", async () => {
    const { device, buffer, observer } = await setup();
    device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 3, 1));
    const bundle = device.createRenderBundleEncoder();
    bundle.setPipeline(
      device.createRenderPipeline({ primitive: { topology: "triangle-list" } }),
    );
    bundle.drawIndexedIndirect(buffer, 0);
    const finished = bundle.finish();
    for (const count of [6, 9]) {
      device.queue.writeBuffer(buffer, 0, argumentsBytes(true, count, 2));
      const encoder = device.createCommandEncoder(),
        pass = encoder.beginRenderPass({});
      pass.executeBundles([finished]);
      pass.end();
      device.queue.submit([encoder.finish()]);
    }
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(2);
    expect(observer.snapshot().unknownIndirectDrawCalls).toBe(0);
    expect(observer.snapshot().submittedTriangles).toBe(10);
  });
  it.each([
    ["drawIndexed", "triangle-strip", 5, 1],
    ["draw", "triangle-list", 0xffffffff, 0xffffffff],
  ])(
    "keeps direct %s/%s unsupported or unsafe counts as explicit lower bounds",
    async (method, topology, count, instances) => {
      const { device, observer } = await setup();
      observer.beginIndirectArgumentSample();
      const before = observer.snapshot();
      const encoder = device.createCommandEncoder(),
        pass = encoder.beginRenderPass({});
      pass.setPipeline(
        device.createRenderPipeline({ primitive: { topology } }),
      );
      pass[method](count, instances);
      pass.end();
      device.queue.submit([encoder.finish()]);
      const frame = sample(observer, before);
      expect(frame.submittedTriangles).toBe(0);
      expect(frame.unknownDirectTriangleDrawCalls).toBe(1);
      expect(frame.submittedTriangleAccounting.confidence).toBe("lower-bound");
      validateTriangleAccountingV2(frame);
    },
  );
});

describe("conservative submitted-list mutation order", () => {
  it("keeps an earlier readable indirect draw unknown if a later command buffer mutates its args in the same submit", async () => {
    const { device, buffer, observer, actual } = await setup();
    device.queue.writeBuffer(buffer, 0, argumentsBytes());
    const draw = encode(device, buffer),
      later = device.createCommandEncoder();
    later.clearBuffer(buffer);
    device.queue.submit([draw.finish(), later.finish()]);
    expect(actual[0].count).toBe(66);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(0);
    expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
    expect(observer.snapshot().unknownIndirectReasons).toEqual({
      "submitted-gpu-buffer-mutation": 1,
    });
  });
});

describe("cumulative native triangle arithmetic", () => {
  it("preserves the first safe direct contribution and marks a later overflowing contribution unknown", async () => {
    const { device, observer } = await setup();
    observer.beginIndirectArgumentSample();
    const before = observer.snapshot();
    const encoder = device.createCommandEncoder(),
      pass = encoder.beginRenderPass({});
    pass.setPipeline(
      device.createRenderPipeline({ primitive: { topology: "triangle-list" } }),
    );
    for (let i = 0; i < 2; i++) pass.draw(3 * 2 ** 26, 2 ** 26);
    pass.end();
    device.queue.submit([encoder.finish()]);
    const frame = sample(observer, before);
    expect(frame.submittedTriangles).toBe(2 ** 52);
    expect(frame.unknownDirectTriangleDrawCalls).toBe(1);
    expect(frame.submittedTriangleAccounting.confidence).toBe("lower-bound");
    validateTriangleAccountingV2(frame);
  });
});

const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

describe("separate frozen geometry and controlled-view argument lifetimes", () => {
  it("preserves cached indirect bundle arguments without a post-seal CPU write", async () => {
    const { device, buffer, observer } = await setup();
    device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 72, 1));
    const encoder = device.createRenderBundleEncoder();
    encoder.setPipeline(
      device.createRenderPipeline({ primitive: { topology: "triangle-list" } }),
    );
    encoder.drawIndexedIndirect(buffer, 0);
    const bundle = encoder.finish();
    const replay = () => {
      const command = device.createCommandEncoder(),
        pass = command.beginRenderPass({});
      pass.executeBundles([bundle]);
      pass.end();
      device.queue.submit([command.finish()]);
    };
    replay();
    const preSeal = observer.snapshot();
    expect(observer.sealGeometryCapture()).toEqual([]);
    observer.beginIndirectArgumentSample();
    const before = observer.snapshot();
    replay();
    const frame = sample(observer, before);
    expect(frame.knownIndirectDrawCalls).toBe(1);
    expect(frame.unknownIndirectDrawCalls).toBe(0);
    expect(frame.submittedTriangles).toBe(24);
    expect(observer.snapshot().geometryCapture).toEqual(
      preSeal.geometryCapture,
    );
    expect(
      observer.snapshot().indirectArgumentCapture.sharedRetainedBytes,
    ).toBe(20);
  });
  it("keeps mixed VERTEX|INDIRECT exported bytes and metadata immutable after latest CPU arguments change", async () => {
    const { device, buffer, observer, actual } = await setup(256 | 32 | 8);
    device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 3, 1));
    device.queue.submit([
      encode(device, buffer, { vertexBuffer: buffer }).finish(),
    ]);
    const beforeSeal = observer.snapshot(),
      exported = observer.sealGeometryCapture();
    const original = structuredClone(exported);
    device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 72, 2));
    device.queue.submit([
      encode(device, buffer, { vertexBuffer: buffer }).finish(),
    ]);
    expect(actual.at(-1).count).toBe(72);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(2);
    expect(observer.snapshot().knownIndirectTriangles).toBe(49);
    expect(exported).toEqual(original);
    expect(observer.snapshot().geometryCapture).toEqual(
      beforeSeal.geometryCapture,
    );
    expect(observer.snapshot().indirectArgumentCapture).toMatchObject({
      frozenGeometryBytes: 20,
      frozenGeometrySegments: 1,
      sharedRetainedBytes: 40,
      sharedRetainedSegments: 2,
      incompleteBufferIds: [],
      skippedWrites: 0,
    });
    buffer.destroy();
    expect(exported).toEqual(original);
  });
  it("retains a later mapped CPU argument write before native unmap detaches its range", async () => {
    const { device, buffer, observer } = await setup(256 | 8);
    device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 3, 1));
    observer.sealGeometryCapture();
    await buffer.mapAsync(2);
    const range = buffer.getMappedRange(0, 20);
    new Uint8Array(range).set(argumentsBytes(true, 72, 1));
    buffer.unmap();
    expect(range.byteLength).toBe(0);
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(1);
    expect(observer.snapshot().submittedTriangles).toBe(24);
    expect(
      observer.snapshot().indirectArgumentCapture.sharedRetainedBytes,
    ).toBe(20);
  });
  it.each([
    [
      { bytes: 39, segments: 100, perBuffer: 100 },
      "native-capture-byte-budget-exceeded",
    ],
    [
      { bytes: 1024, segments: 1, perBuffer: 100 },
      "native-capture-segment-budget-exceeded",
    ],
    [
      { bytes: 1024, segments: 100, perBuffer: 1 },
      "native-capture-segment-budget-exceeded",
    ],
  ])(
    "bounds separately owned mixed storage without altering frozen geometry: %j",
    async (limits, reason) => {
      const { device, buffer, observer } = await setup(256 | 32 | 8, {
        ...limits,
        buffers: 100,
      });
      device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 3, 1));
      device.queue.submit([
        encode(device, buffer, { vertexBuffer: buffer }).finish(),
      ]);
      const preSeal = observer.snapshot(),
        exported = observer.sealGeometryCapture(),
        original = structuredClone(exported);
      expect(
        observer.snapshot().indirectArgumentCapture.incompleteBufferIds,
      ).toEqual([0]);
      expect(observer.snapshot().indirectArgumentCapture.skippedWrites).toBe(1);
      device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 6, 1));
      device.queue.submit([
        encode(device, buffer, { vertexBuffer: buffer }).finish(),
      ]);
      expect(observer.snapshot().knownIndirectDrawCalls).toBe(1);
      expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
      expect(observer.snapshot().unknownIndirectReasons).toEqual({
        "incomplete-native-capture": 1,
      });
      expect(exported).toEqual(original);
      expect(observer.snapshot().geometryCapture).toEqual(
        preSeal.geometryCapture,
      );
      expect(
        observer.snapshot().indirectArgumentCapture.sharedRetainedBytes,
      ).toBeLessThanOrEqual(limits.bytes);
      expect(
        observer.snapshot().indirectArgumentCapture.sharedRetainedSegments,
      ).toBeLessThanOrEqual(limits.segments);
      expect(exported[0].captureFailureReason).not.toBe(reason);
    },
  );
  it("does not re-bless GPU-invalidated bytes when cloning mixed storage at the seal", async () => {
    const { device, buffer, observer } = await setup(256 | 32 | 8);
    device.queue.writeBuffer(buffer, 0, argumentsBytes());
    device.queue.submit([
      encode(device, buffer, { vertexBuffer: buffer }).finish(),
    ]);
    const mutate = device.createCommandEncoder();
    mutate.clearBuffer(buffer);
    device.queue.submit([mutate.finish()]);
    observer.sealGeometryCapture();
    device.queue.submit([encode(device, buffer).finish()]);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(1);
    expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
    expect(observer.snapshot().unknownIndirectReasons).toEqual({
      "submitted-gpu-buffer-mutation": 1,
    });
  });
  it("preserves original capture failure facts while releasing unexported raw bytes", async () => {
    const { device, buffer, observer } = await setup(256 | 8, {
      bytes: 16,
      segments: 100,
      perBuffer: 100,
      buffers: 100,
    });
    device.queue.writeBuffer(buffer, 0, argumentsBytes());
    const before = observer.snapshot();
    observer.sealGeometryCapture();
    expect(observer.snapshot().geometryCapture).toEqual(before.geometryCapture);
    expect(observer.snapshot().geometryCapture.incompleteBufferIds).toEqual([
      0,
    ]);
    device.queue.writeBuffer(buffer, 0, argumentsBytes(false, 3, 1));
    device.queue.submit([
      encode(device, buffer, { method: "drawIndirect" }).finish(),
    ]);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(0);
    expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
  });
});

async function fullControlledClient({
  failViewCapture = false,
  failViewBufferRecords = false,
} = {}) {
  const { device, buffer, observer, context } = await setup(256 | 8, {
    bytes: 128,
    segments: 100,
    perBuffer: 100,
    buffers: failViewBufferRecords ? 3 : 100,
  });
  const vertex = device.createBuffer({ size: 36, usage: 32 | 8 });
  device.queue.writeBuffer(vertex, 0, positions);
  const unused = device.createBuffer({ size: 32, usage: 8 });
  device.queue.writeBuffer(unused, 0, new Uint8Array(32));
  const posts = [],
    cameras = [];
  let rendered = 0,
    inspected = 0;
  class Canvas {
    width = 1024;
    height = 768;
    toBlob(callback) {
      callback(new Blob([new Uint8Array([1])], { type: "image/png" }));
    }
  }
  const canvas = new Canvas();
  vi.stubGlobal("performance", context.performance);
  vi.stubGlobal("HTMLCanvasElement", Canvas);
  vi.stubGlobal("document", { querySelectorAll: () => [canvas] });
  vi.stubGlobal("devicePixelRatio", 1);
  vi.stubGlobal("__AGENT_NATIVE_OBSERVER__", observer);
  vi.stubGlobal("__APERTURE_VERIFIED_GPU__", { native: true });
  vi.stubGlobal("__APERTURE_WAIT_GPU__", async () => ({ native: true }));
  vi.stubGlobal("__AGENT_BENCHMARK__", {
    engine: "three",
    canvas,
    ready: Promise.resolve(),
    setCamera: async (camera) => cameras.push(camera.id),
    renderFrame: async () => {
      rendered++;
      device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 3, 1));
      if (failViewCapture && rendered === 181) {
        const extra = device.createBuffer({ size: 128, usage: 256 | 8 });
        device.queue.writeBuffer(extra, 0, new Uint8Array(128));
      }
      if (failViewBufferRecords && rendered === 181) {
        const extra = device.createBuffer({ size: 20, usage: 256 | 8 });
        device.queue.writeBuffer(extra, 0, argumentsBytes(true, 3, 1));
      }
      device.queue.submit([
        encode(device, buffer, { vertexBuffer: vertex }).finish(),
      ]);
    },
    inspectGeometry: async () => {
      inspected++;
      return {
        meshes: [
          {
            id: "triangle",
            positions,
            indices: new Uint32Array([0, 1, 2]),
            worldMatrix: new Float32Array([
              1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
            ]),
          },
        ],
      };
    },
    dispose: async () => {},
  });
  vi.stubGlobal("fetch", async (path, options) => {
    if (!options)
      return {
        json: async () => ({
          engine: "three",
          trial: 1,
          contract: (await import("../../tools/agent-benchmark/contract.mjs"))
            .CONTRACT,
          artifactProtocol: ARTIFACT_PROTOCOL_V2,
        }),
      };
    const bytes = new Uint8Array(options.body),
      name = path.split("/").at(-1);
    posts.push({
      name,
      bytes,
      body: name.endsWith(".json")
        ? JSON.parse(new TextDecoder().decode(bytes))
        : null,
    });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        path: name,
        bytes: bytes.length,
        sha256: sha256(bytes),
      }),
    };
  });
  try {
    await runMeasurement();
    return {
      rendered,
      inspected,
      cameras,
      posts,
      status: globalThis.__AGENT_BENCHMARK_STATUS__,
    };
  } finally {
    vi.unstubAllGlobals();
    delete globalThis.__AGENT_BENCHMARK_STATUS__;
    delete globalThis.__AGENT_BENCHMARK_PROGRESS__;
  }
}

describe("complete controlled client including three post-export views", () => {
  it("keeps all60+120+3 CPU-updated native indirect frames known with frozen exact POSITION receipts", async () => {
    const result = await fullControlledClient();
    const record = result.posts.find(
      (item) => item.name === "measurement.json",
    )?.body;
    expect(
      result.posts.find((item) => item.name === "failure.json")?.body.error
        .message,
    ).toBeUndefined();
    expect(result.rendered).toBe(183);
    expect(result.inspected).toBe(1);
    expect(record.warmup).toHaveLength(60);
    expect(record.samples).toHaveLength(120);
    expect(record.views).toHaveLength(3);
    validateTriangleArgumentProofV2(record);
    const all = [
      ...record.warmup,
      ...record.samples,
      ...record.views.map((view) => view.frame),
    ];
    expect(all.map((frame) => frame.frame)).toEqual(
      Array.from({ length: 183 }, (_, i) => i),
    );
    expect(
      all.every(
        (frame) =>
          frame.knownIndirectDrawCalls === 1 &&
          frame.unknownIndirectDrawCalls === 0 &&
          frame.submittedTriangles === 1 &&
          frame.knownIndirectTriangles === 1,
      ),
    ).toBe(true);
    expect(record.nativeIndirectArgumentProof.witnesses).toHaveLength(1);
    const manifest = result.posts.find(
      (item) => item.name === "geometry-manifest-v2.json",
    ).body;
    expect(manifest.nativeCapture).toEqual(
      record.observationsAfterMeasured.geometryCapture,
    );
    expect(manifest.nativeBytes).toBe(36);
    expect(record.observationsAfterViews.geometryCapture).toEqual(
      manifest.nativeCapture,
    );
    expect(record.observationsAfterViews.indirectArgumentCapture).toMatchObject(
      {
        frozenGeometryBytes: 36,
        sharedRetainedBytes: 56,
        sharedRetainedSegments: 2,
        incompleteBufferIds: [],
        skippedWrites: 0,
      },
    );
    const native = result.posts.find((item) =>
      item.name.startsWith("native-buffer-"),
    ).bytes;
    expect(native).toEqual(new Uint8Array(positions.buffer));
    expect(manifest.nativeUploads[0].sha256).toBe(sha256(native));
  });
  it("retains all120 measured samples and fails explicitly on view-phase argument capacity", async () => {
    const result = await fullControlledClient({ failViewCapture: true });
    expect(
      result.posts.find((item) => item.name === "measurement.json"),
    ).toBeUndefined();
    const failure = result.posts.find(
      (item) => item.name === "failure.json",
    ).body;
    expect(result.rendered).toBe(183);
    expect(failure.samples).toHaveLength(120);
    expect(failure.views).toHaveLength(3);
    expect(failure.error.message).toMatch(/argument capture\/proof capacity/);
    expect(
      failure.observations.indirectArgumentCapture.incompleteBufferIds,
    ).toHaveLength(1);
    expect(
      failure.observations.indirectArgumentCapture.sharedRetainedBytes,
    ).toBeLessThanOrEqual(128);
  });
});

describe("new argument buffers after geometry sealing", () => {
  it.each([false, true])(
    "tracks a newly created CPU-only INDIRECT buffer with mappedAtCreation=%s",
    async (mappedAtCreation) => {
      const { device, observer } = await setup();
      const before = observer.snapshot().geometryCapture;
      observer.sealGeometryCapture();
      const buffer = device.createBuffer({
        size: 20,
        usage: 256 | 8,
        mappedAtCreation,
      });
      if (mappedAtCreation) {
        const range = buffer.getMappedRange(0, 20);
        new Uint8Array(range).set(argumentsBytes(true, 72, 1));
        buffer.unmap();
      } else device.queue.writeBuffer(buffer, 0, argumentsBytes(true, 72, 1));
      device.queue.submit([encode(device, buffer).finish()]);
      expect(observer.snapshot().knownIndirectDrawCalls).toBe(1);
      expect(observer.snapshot().unknownIndirectDrawCalls).toBe(0);
      expect(observer.snapshot().submittedTriangles).toBe(24);
      expect(observer.snapshot().geometryCapture).toEqual(before);
      expect(
        observer.snapshot().indirectArgumentCapture.sharedRetainedBytes,
      ).toBe(20);
    },
  );
});

describe("post-seal native record capacity", () => {
  it("keeps frozen statistics unchanged while exposing late omitted records and actual native counts", async () => {
    const { device, observer } = await setup(256 | 8, {
      bytes: 1024,
      segments: 100,
      perBuffer: 100,
      buffers: 1,
    });
    const before = observer.snapshot().geometryCapture;
    observer.sealGeometryCapture();
    const omitted = device.createBuffer({ size: 20, usage: 256 | 8 });
    device.queue.writeBuffer(omitted, 0, argumentsBytes(true, 3, 1));
    device.queue.submit([encode(device, omitted).finish()]);
    expect(observer.snapshot().geometryCapture).toEqual(before);
    expect(
      observer.snapshot().indirectArgumentCapture.omittedBufferRecords,
    ).toBe(1);
    expect(observer.snapshot().buffersCreated).toBe(2);
    expect(observer.snapshot().drawCalls).toBe(1);
    expect(observer.snapshot().knownIndirectDrawCalls).toBe(0);
    expect(observer.snapshot().unknownIndirectDrawCalls).toBe(1);
  });
  it("rejects late buffer-record exhaustion while retaining120 samples even when every drawn argument is known", async () => {
    const result = await fullControlledClient({ failViewBufferRecords: true });
    expect(
      result.posts.find((item) => item.name === "measurement.json"),
    ).toBeUndefined();
    const failure = result.posts.find(
      (item) => item.name === "failure.json",
    )?.body;
    expect(failure?.error.message).toMatch(/argument capture\/proof capacity/);
    expect(result.rendered).toBe(183);
    expect(failure.samples).toHaveLength(120);
    expect(failure.views).toHaveLength(3);
    expect(
      failure.samples.every(
        (frame) =>
          frame.knownIndirectDrawCalls === 1 &&
          frame.unknownIndirectDrawCalls === 0,
      ),
    ).toBe(true);
    expect(
      failure.observations.indirectArgumentCapture.omittedBufferRecords,
    ).toBe(1);
    expect(failure.observations.geometryCapture.omittedBufferRecords).toBe(0);
  });
});
