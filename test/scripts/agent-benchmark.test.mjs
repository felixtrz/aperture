import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CONTRACT,
  inspectMesh,
  matchPositionStream,
  summarize,
  validateSample,
  validateWorkerEligibility,
} from "../../tools/agent-benchmark/contract.mjs";
import { installNativeObserver } from "../../tools/agent-benchmark/native-observer.mjs";
import {
  injectHarness,
  parseOptions,
  readSourceTree,
  preserveInputs,
} from "../../tools/agent-benchmark/run.mjs";
import {
  inspectPng,
  writeImmutable,
} from "../../tools/agent-benchmark/recorder.mjs";

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function fixture() {
  const calls = [],
    instances = [],
    originals = {};
  class BufferMock {
    constructor(size) {
      this.raw = new ArrayBuffer(size);
    }
    getMappedRange() {
      return this.raw;
    }
    unmap() {
      calls.push("unmap");
    }
    destroy() {
      calls.push("buffer-destroy");
    }
    async mapAsync() {}
  }
  const pass = () => ({
    setPipeline: (...args) => calls.push(["pipeline", args]),
    setVertexBuffer: (...args) => calls.push(["vertex", args]),
    draw: (...args) => {
      calls.push(["draw", args]);
      return "draw-result";
    },
    drawIndexed: (...args) => calls.push(["indexed", args]),
    drawIndirect: (...args) => calls.push(["indirect", args]),
    drawIndexedIndirect: (...args) => calls.push(["indexed-indirect", args]),
    executeBundles: (...args) => calls.push(["bundles", args]),
    end() {},
  });
  class GPUAdapter {
    async requestDevice() {
      const device = {
        queue: {
          submit: (...args) => {
            calls.push(["submit", args]);
            return "submit-result";
          },
          writeBuffer: (...args) => calls.push(["write", args]),
          async onSubmittedWorkDone() {
            calls.push("fence");
          },
        },
        createBuffer: (descriptor) => new BufferMock(descriptor.size),
        createTexture: () => ({ destroy: () => calls.push("texture-destroy") }),
        createRenderPipeline: () => ({}),
        async createRenderPipelineAsync() {
          return {};
        },
        createCommandEncoder: () => ({
          beginRenderPass: pass,
          beginComputePass: () => ({}),
          finish: () => ({}),
        }),
        createRenderBundleEncoder: () => ({ ...pass(), finish: () => ({}) }),
      };
      originals.submit = device.queue.submit;
      instances.push(device);
      return device;
    }
  }
  class HTMLCanvasElement {
    getContext() {
      return {};
    }
  }
  class PortMock {
    listeners = new Map();
    postMessage(...args) {
      calls.push(["port-message", args]);
    }
    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }
    dispatch(data) {
      for (const listener of this.listeners.get("message") ?? [])
        listener({ data });
    }
  }
  class MessageChannel {
    port1 = new PortMock();
    port2 = new PortMock();
  }
  class Worker {
    postMessage(...args) {
      calls.push(["worker-message", args]);
    }
    addEventListener() {}
    terminate() {
      calls.push("worker-terminate");
    }
  }
  let now = 0;
  const context = {
    GPUAdapter,
    HTMLCanvasElement,
    performance: { now: () => ++now },
    ArrayBuffer,
    Uint8Array,
    MessageChannel,
    Worker,
    SharedArrayBuffer,
  };
  runInNewContext(`(${installNativeObserver.toString()})()`, context);
  return {
    context,
    observer: context.__AGENT_NATIVE_OBSERVER__,
    calls,
    originals,
    createDevice: () => new GPUAdapter().requestDevice(),
  };
}

describe("agent benchmark native measurement", () => {
  it("counts submitted work rather than encoded unused draws and counts reused bundles each time", async () => {
    const { observer, createDevice, calls } = fixture(),
      device = await createDevice();
    const pipeline = device.createRenderPipeline({
      primitive: { topology: "triangle-list" },
    });
    const unused = device.createCommandEncoder(),
      unusedPass = unused.beginRenderPass({});
    unusedPass.setPipeline(pipeline);
    unusedPass.draw(300);
    unused.finish();
    const bundle = device.createRenderBundleEncoder({});
    bundle.setPipeline(pipeline);
    bundle.drawIndexed(6, 4);
    const finishedBundle = bundle.finish();
    const encoder = device.createCommandEncoder(),
      render = encoder.beginRenderPass({});
    render.setPipeline(pipeline);
    expect(render.draw(3, 2)).toBe("draw-result");
    render.executeBundles([finishedBundle, finishedBundle]);
    const commands = encoder.finish();
    expect(observer.snapshot().drawCalls).toBe(0);
    expect(device.queue.submit([commands])).toBe("submit-result");
    expect(observer.snapshot()).toMatchObject({
      submissions: 1,
      drawCalls: 3,
      submittedTriangles: 18,
      renderPasses: 1,
      unknownCommandBuffers: 0,
    });
    expect(
      calls.filter((call) => Array.isArray(call) && call[0] === "draw"),
    ).toHaveLength(2);
    await observer.fence();
    expect(calls).toContain("fence");
  });

  it("preserves topology and unknown indirect counts instead of inventing triangles", async () => {
    const { observer, createDevice } = fixture(),
      device = await createDevice();
    const pipeline = await device.createRenderPipelineAsync({
      primitive: { topology: "triangle-strip" },
    });
    const encoder = device.createCommandEncoder(),
      pass = encoder.beginRenderPass({});
    pass.setPipeline(pipeline);
    pass.draw(5, 2);
    pass.drawIndexedIndirect({ buffer: true }, 0);
    device.queue.submit([encoder.finish(), {}]);
    expect(observer.snapshot()).toMatchObject({
      submittedTriangles: 6,
      indirectDrawCalls: 1,
      unknownCommandBuffers: 1,
    });
  });

  it("captures typed-array offsets and mapped writes while correlating only submitted vertex buffers", async () => {
    const { observer, createDevice } = fixture(),
      device = await createDevice();
    const a = device.createBuffer({ size: 48, usage: 32, label: "a" });
    const b = device.createBuffer({
      size: 12,
      usage: 32,
      mappedAtCreation: true,
      label: "b",
    });
    const decorative = device.createBuffer({ size: 12, usage: 32 });
    device.queue.writeBuffer(a, 0, Float32Array.from([9, 1, 2, 3, 8]), 1, 3);
    device.queue.writeBuffer(decorative, 0, Float32Array.from([99, 99, 99]));
    new Float32Array(b.getMappedRange()).set([4, 5, 6]);
    b.unmap();
    const encoder = device.createCommandEncoder(),
      pass = encoder.beginRenderPass({});
    pass.setVertexBuffer(0, a);
    pass.setVertexBuffer(1, b);
    pass.draw(3);
    device.queue.submit([encoder.finish()]);
    const captured = observer.sealGeometryCapture();
    expect(captured).toHaveLength(2);
    expect(
      Array.from(new Float32Array(captured[0].segments[0].bytes.buffer)),
    ).toEqual([1, 2, 3]);
    expect(
      Array.from(new Float32Array(captured[1].segments[0].bytes.buffer)),
    ).toEqual([4, 5, 6]);
    a.destroy();
    a.destroy();
    expect(observer.snapshot()).toMatchObject({
      buffersCreated: 3,
      buffersDestroyed: 1,
      requestedBufferBytes: 72,
      liveRequestedBufferBytes: 24,
    });
  });

  it("does not retain stale overwritten geometry bytes", async () => {
    const { observer, createDevice } = fixture(),
      device = await createDevice();
    const buffer = device.createBuffer({ size: 12, usage: 32 });
    device.queue.writeBuffer(buffer, 0, Float32Array.from([1, 2, 3]));
    device.queue.writeBuffer(buffer, 0, Float32Array.from([8, 9, 10]));
    const encoder = device.createCommandEncoder(),
      pass = encoder.beginRenderPass({});
    pass.setVertexBuffer(0, buffer);
    pass.draw(3);
    device.queue.submit([encoder.finish()]);
    const captured = observer.sealGeometryCapture();
    expect(matchPositionStream([1, 2, 3], captured).matched).toBe(false);
    expect(matchPositionStream([8, 9, 10], captured).matched).toBe(true);
  });
});

describe("agent benchmark worker eligibility", () => {
  it("requires a normal simulation channel with advancing worker snapshots", () => {
    const { context, observer } = fixture();
    const worker = new context.Worker("/assets/simulation-worker.js", {
      type: "module",
    });
    const channel = new context.MessageChannel();
    worker.postMessage(
      { type: "aperture.simulation.connect", port: channel.port2 },
      [channel.port2],
    );
    channel.port1.postMessage({
      type: "aperture.simulation.start",
      options: {},
    });
    const snapshot = (frame) => ({
      type: "aperture.simulation.snapshot",
      snapshot: {
        frame,
        transforms: new Float32Array(16),
        meshDraws: [{}],
        views: [{}],
      },
    });
    channel.port1.dispatch(snapshot(60));
    const before = observer.snapshot();
    channel.port1.dispatch(snapshot(180));
    const after = observer.snapshot();
    expect(validateWorkerEligibility("aperture", before, after)).toMatchObject({
      status: "observed-live-simulation-protocol-awaiting-source-audit",
      sourceAuditRequired: true,
      workerId: 0,
    });
    expect(() => validateWorkerEligibility("aperture", before, before)).toThrow(
      /advance/,
    );
    worker.terminate();
    expect(() =>
      validateWorkerEligibility("aperture", before, observer.snapshot()),
    ).toThrow(/terminated/);
    expect(validateWorkerEligibility("three", before, after).status).toBe(
      "not-required-for-control",
    );
  });

  it("accepts native shared snapshot progression and rejects a dummy worker", () => {
    const { context, observer } = fixture();
    const worker = new context.Worker("/worker.js"),
      channel = new context.MessageChannel();
    expect(() =>
      validateWorkerEligibility(
        "aperture",
        observer.snapshot(),
        observer.snapshot(),
      ),
    ).toThrow(/normal snapshot protocol/);
    worker.postMessage(
      { type: "aperture.simulation.connect", port: channel.port2 },
      [channel.port2],
    );
    const headerBuffer = new SharedArrayBuffer(44),
      header = new Int32Array(headerBuffer);
    channel.port1.postMessage({
      type: "aperture.simulation.start",
      options: { transport: { mode: "shared-array-buffer", headerBuffer } },
    });
    channel.port1.dispatch({
      type: "aperture.simulation.snapshot",
      snapshot: {
        frame: 0,
        transforms: new Float32Array(0),
        meshDraws: [],
        views: [],
      },
      transport: { mode: "shared-array-buffer" },
    });
    Atomics.store(header, 1, 60);
    const before = observer.snapshot();
    Atomics.store(header, 1, 180);
    expect(
      validateWorkerEligibility("aperture", before, observer.snapshot())
        .workerId,
    ).toBe(0);
  });
});

describe("agent benchmark geometry and evidence", () => {
  it("calculates transformed instance bounds, source triangle counts and degeneracy", () => {
    const translated = [...identity];
    translated[12] = 10;
    const mesh = inspectMesh({
      id: "triangle",
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      indices: [0, 1, 2, 0, 0, 0],
      worldMatrix: identity,
      instances: [identity, translated],
    });
    expect(mesh).toMatchObject({
      vertices: 3,
      authoredTriangles: 2,
      instances: 2,
      instancedTriangles: 4,
      degenerateTriangles: 2,
      bounds: { min: [0, 0, 0], max: [11, 1, 0] },
    });
    expect(() =>
      inspectMesh({
        id: "bad",
        positions: [0, 0, 0],
        indices: [0, 1, 0],
        worldMatrix: identity,
      }),
    ).toThrow(/indices/);
    expect(() =>
      inspectMesh({ id: "bad", positions: [NaN, 0, 0], worldMatrix: identity }),
    ).toThrow(/positions/);
  });

  it("finds exact interleaved uploaded positions and refuses decorative/unbounded matches", () => {
    const bytes = new Uint8Array(
      Float32Array.from([0, 0, 0, 5, 5, 5, 1, 0, 0, 5, 5, 5, 0, 1, 0, 5, 5, 5])
        .buffer,
    );
    const buffers = [{ id: 7, usage: 32, segments: [{ offset: 64, bytes }] }];
    expect(matchPositionStream([0, 0, 0, 1, 0, 0, 0, 1, 0], buffers)).toEqual({
      matched: true,
      bufferId: 7,
      byteOffset: 64,
      strideBytes: 24,
      vertexCount: 3,
    });
    expect(matchPositionStream([8, 0, 0], buffers).matched).toBe(false);
    expect(matchPositionStream([0, 0, 0], buffers, 0).reason).toBe(
      "comparison-budget-exhausted",
    );
  });

  it("retains outliers in descriptive statistics and fails non-reconciling timings", () => {
    expect(summarize([1, 2, 3, 4, 1000])).toMatchObject({
      count: 5,
      min: 1,
      median: 3,
      p95: 1000,
      max: 1000,
    });
    const sample = {
      cpuSubmissionMs: 2,
      queueCompletionLatencyMs: 3,
      endToEndMs: 5,
      applicationPromiseMs: 2,
      submissions: 1,
      drawCalls: 2,
      unknownCommandBuffers: 0,
    };
    expect(validateSample(sample)).toBe(sample);
    expect(() => validateSample({ ...sample, endToEndMs: 4 })).toThrow(
      /reconcile/,
    );
    expect(() =>
      validateSample({ ...sample, unknownCommandBuffers: 1 }),
    ).toThrow(/attributable/);
  });

  it("freezes equal camera/settings and injects pre-boot observation ahead of author code", () => {
    const html = injectHarness(
      '<html><head><script type="module" src="/main.js"></script></head></html>',
    );
    expect(html.indexOf("Benchmark observer already installed")).toBeLessThan(
      html.indexOf("/main.js"),
    );
    expect(CONTRACT).toMatchObject({
      viewport: { width: 1024, height: 768 },
      warmupFrames: 60,
      measuredFrames: 120,
    });
    expect(CONTRACT.views[0]).toMatchObject({
      position: [14, 9, 19],
      target: [0, 2.5, 1],
      fovYDegrees: 37,
    });
    expect(() =>
      parseOptions([
        "--app",
        "/app",
        "--output",
        "/out",
        "--engine",
        "three",
        "--trial",
        "1",
        "--flags",
        "anything",
      ]),
    ).toThrow(/option/);
    expect(() => inspectPng(Buffer.from("not PNG"), CONTRACT.viewport)).toThrow(
      /PNG/,
    );
  });

  it("preserves exclusive evidence bytes and reads only a real built source tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-benchmark-"));
    try {
      const path = join(root, "index.html");
      await writeImmutable(path, "<html><head></head></html>");
      await expect(writeImmutable(path, "replacement")).rejects.toMatchObject({
        code: "EEXIST",
      });
      expect(await readFile(path, "utf8")).toContain("<head>");
      await writeFile(join(root, "app.js"), "console.log('app')");
      const tree = await readSourceTree(root);
      expect([...tree.keys()].sort()).toEqual(["/app.js", "/index.html"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("retains original app, injected HTML and every harness byte with independent hashes", async () => {
    const root = await mkdtemp(join(tmpdir(), "agent-benchmark-freeze-"));
    try {
      const output = join(root, "attempt");
      await mkdir(output);
      const app = new Map([
        ["/index.html", Buffer.from("<html><head></head></html>")],
        ["/assets/main.js", Buffer.from("original app bytes")],
      ]);
      const harness = new Map([
        ["client.mjs", Buffer.from("original harness bytes")],
      ]);
      const served = Buffer.from(
        injectHarness(app.get("/index.html").toString()),
      );
      const inventory = await preserveInputs(output, app, harness, served);
      expect(
        await readFile(join(output, "frozen-app/assets/main.js"), "utf8"),
      ).toBe("original app bytes");
      expect(
        await readFile(join(output, "frozen-harness/client.mjs"), "utf8"),
      ).toBe("original harness bytes");
      expect(await readFile(join(output, "served-index.html"))).toEqual(served);
      expect(inventory["frozen-app"]["/assets/main.js"]).toMatchObject({
        path: "frozen-app/assets/main.js",
        bytes: 18,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      });
      await expect(
        preserveInputs(output, app, harness, served),
      ).rejects.toMatchObject({ code: "EEXIST" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
