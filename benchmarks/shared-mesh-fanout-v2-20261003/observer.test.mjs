/** Simulated native API behavior verifies observation, never substitutes native evidence. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  installNativeObserver,
  expandNativeScope,
  compactNativeScope,
  classifyPass,
} from "./native-observer.mjs";
import { SHADOW_CASTER_DEPTH_ONLY_WGSL } from "./shader-contract.mjs";
test("observer preserves submit object joins, bundles, changed buffer versions and honest texture cache invalidation", async () => {
  const keys = [
      "GPUAdapter",
      "GPUTexture",
      "GPUCommandEncoder",
      "GPURenderPassEncoder",
      "GPURenderBundleEncoder",
      "GPUQueue",
    ],
    old = keys.map((k) => [k, globalThis[k]]),
    calls = [];
  class Texture {
    constructor() {
      this.format = "depth24plus";
      this.label = "actual depth";
    }
    createView() {
      return {};
    }
    destroy() {
      calls.push("destroy texture");
    }
  }
  class Base {
    setVertexBuffer() {}
    setIndexBuffer() {}
    setBindGroup() {}
    setPipeline() {}
    draw(...args) {
      calls.push(["draw", ...args]);
      if (args[0] < 0) throw Error("native draw failed");
    }
    drawIndexed() {}
    drawIndirect() {}
    drawIndexedIndirect() {}
  }
  class Pass extends Base {
    executeBundles() {}
    end() {}
  }
  class Bundle extends Base {
    finish() {
      return {};
    }
  }
  class Command {
    beginRenderPass() {
      return new Pass();
    }
    finish() {
      return {};
    }
    copyBufferToTexture() {}
    copyTextureToTexture() {}
  }
  class Queue {
    writeBuffer() {}
    submit() {
      calls.push("submit");
    }
    writeTexture() {}
    copyExternalImageToTexture() {}
  }
  class Device {
    constructor() {
      this.queue = new Queue();
    }
    createBuffer(d) {
      return {
        ...d,
        getMappedRange() {
          return new ArrayBuffer(d.size);
        },
        unmap() {},
        destroy() {},
      };
    }
    createShaderModule() {
      return {};
    }
    createRenderPipeline(d) {
      return { descriptor: d };
    }
    createBindGroup(d) {
      return { descriptor: d };
    }
  }
  class Adapter {
    async requestDevice() {
      return new Device();
    }
  }
  try {
    Object.assign(globalThis, {
      GPUAdapter: Adapter,
      GPUTexture: Texture,
      GPUCommandEncoder: Command,
      GPURenderPassEncoder: Pass,
      GPURenderBundleEncoder: Bundle,
      GPUQueue: Queue,
    });
    const observer = installNativeObserver(),
      device = await new Adapter().requestDevice(),
      depth = new Texture(),
      depthView = depth.createView(),
      vertex = device.createBuffer({ label: "geometry", size: 128, usage: 32 }),
      transform = device.createBuffer({
        label: "matrix",
        size: 192,
        usage: 128,
      });
    device.queue.writeBuffer(vertex, 0, new Uint8Array(128).fill(7));
    device.queue.writeBuffer(transform, 0, new Float32Array(48));
    const shader = device.createShaderModule({
        code: SHADOW_CASTER_DEPTH_ONLY_WGSL,
      }),
      pipeline = device.createRenderPipeline({
        vertex: { module: shader, buffers: [] },
        fragment: { module: shader, targets: [] },
        depthStencil: { format: "depth24plus" },
      }),
      group = device.createBindGroup({
        entries: [{ binding: 1, resource: { buffer: transform } }],
      });
    const draw = (p) => {
      p.setPipeline(pipeline);
      p.setVertexBuffer(0, vertex);
      p.setBindGroup(0, group);
      p.draw(6, 3, 0, 0);
    };
    function encoder(clear = true, withDraw = true, store = "store") {
      const c = new Command(),
        p = c.beginRenderPass({
          colorAttachments: [],
          depthStencilAttachment: {
            view: depthView,
            depthLoadOp: clear ? "clear" : "load",
            depthStoreOp: store,
          },
        });
      if (withDraw) draw(p);
      p.end();
      return c;
    }
    let scope = observer.begin(1);
    const orphan = encoder();
    orphan.finish();
    const c = encoder();
    device.queue.submit([c.finish()]);
    let report = observer.end(scope),
      full = expandNativeScope(report);
    assert.equal(full.draws.length, 1);
    assert.equal(full.shadowHistory.length, 1);
    assert.equal(classifyPass(full.draws[0]), "shadow-depth");
    assert.equal(Object.keys(report.bufferSnapshots).length, 2);
    assert.equal(report.draws[0].uploads, undefined);
    assert.equal(report.draws[0].pipeline, undefined);
    assert.equal(
      full.draws[0].uploads.find((b) => b.label === "geometry")
        .fullUploadBytes[0],
      7,
    );
    // No-op submission leaves the untouched depth texture valid and honestly cached.
    scope = observer.begin(2);
    device.queue.submit([new Command().finish()]);
    report = observer.end(scope);
    assert.equal(report.shadowHistory.length, 1);
    assert.equal(report.shadowHistory[0].frame, 1);
    assert.equal(report.draws.length, 0);
    // A later clear-only submission invalidates old valid shadow coverage.
    scope = observer.begin(3);
    device.queue.submit([encoder(true, false).finish()]);
    const colorShader = device.createShaderModule({
        code: "@group(1) @binding(0) var<storage, read> worldTransforms: array<mat4x4<f32>>;",
      }),
      colorPipeline = device.createRenderPipeline({
        vertex: { module: colorShader },
        fragment: { targets: [{ format: "rgba16float" }] },
        depthStencil: { format: "depth24plus" },
      }),
      colorGroup = device.createBindGroup({
        entries: [
          { binding: 0, resource: { buffer: transform } },
          { binding: 3, resource: depthView },
        ],
      }),
      colorEncoder = new Command(),
      colorPass = colorEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: new Texture().createView(),
            loadOp: "clear",
            storeOp: "store",
          },
        ],
        depthStencilAttachment: {
          view: new Texture().createView(),
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
    colorPass.setPipeline(colorPipeline);
    colorPass.setVertexBuffer(0, vertex);
    colorPass.setBindGroup(1, colorGroup);
    colorPass.draw(6, 3, 0, 0);
    colorPass.end();
    device.queue.submit([colorEncoder.finish()]);
    report = observer.end(scope);
    const color = expandNativeScope(report).draws.find(
      (d) => classifyPass(d) === "main-color",
    );
    assert(color);
    assert(color.sampledTextureVersions.some((v) => v.contentRevision === 2));

    assert.equal(report.shadowHistory.length, 0);
    assert.equal(report.depthEffects[0].drawCount, 0);
    assert(
      report.textureInvalidations.some(
        (x) => x.reason === "clear-only depth pass",
      ),
    );
    scope = observer.begin(4);
    device.queue.submit([encoder().finish()]);
    device.queue.writeBuffer(vertex, 0, new Uint8Array(128).fill(9));
    device.queue.submit([encoder().finish()]);
    report = observer.end(scope);
    full = expandNativeScope(report);
    assert.equal(
      full.draws[0].uploads.find((b) => b.label === "geometry")
        .fullUploadBytes[0],
      7,
    );
    assert.equal(
      full.draws[1].uploads.find((b) => b.label === "geometry")
        .fullUploadBytes[0],
      9,
    );
    assert.equal(Object.keys(report.bufferSnapshots).length, 4);
    scope = observer.begin(5);
    device.queue.submit([encoder(true, false, "discard").finish()]);
    assert.equal(observer.end(scope).shadowHistory.length, 0);
    scope = observer.begin(6);
    device.queue.submit([encoder().finish()]);
    device.queue.writeTexture({ texture: depth }, new Uint8Array(4), {}, {});
    assert.equal(observer.end(scope).shadowHistory.length, 0);
    scope = observer.begin(7);
    device.queue.submit([encoder().finish()]);
    const copy = new Command();
    copy.copyTextureToTexture(
      { texture: new Texture() },
      { texture: depth },
      {},
    );
    device.queue.submit([copy.finish()]);
    assert.equal(observer.end(scope).shadowHistory.length, 0);
    scope = observer.begin(8);
    device.queue.submit([encoder().finish()]);
    depth.destroy();
    assert.equal(observer.end(scope).shadowHistory.length, 0);
    // Bundle draw state is captured at bundle creation and attached to the executing pass.
    const bundle = new Bundle();
    draw(bundle);
    const done = bundle.finish();
    scope = observer.begin(9);
    const bc = new Command(),
      bp = bc.beginRenderPass({
        colorAttachments: [],
        depthStencilAttachment: {
          view: depthView,
          depthLoadOp: "clear",
          depthStoreOp: "store",
        },
      });
    bp.executeBundles([done]);
    assert.throws(() => bp.draw(-1), /native draw failed/);
    bp.end();
    device.queue.submit([bc.finish()]);
    report = expandNativeScope(observer.end(scope));
    assert.equal(report.draws.length, 1);
    assert.equal(report.draws[0].viaBundle, true);
    assert.equal(report.draws[0].instances, 3);
    const bad = compactNativeScope(report);
    bad.draws[0].uploadSnapshotIds[0] = "missing";
    assert.throws(() => expandNativeScope(bad), /exact buffer/);
  } finally {
    for (const [k, v] of old)
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
  }
});
