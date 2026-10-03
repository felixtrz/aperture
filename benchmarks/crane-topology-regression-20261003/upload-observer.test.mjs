/** Simulated native API test; not genuine GPU execution or evidence. */
import test from "node:test";
import assert from "node:assert/strict";
import { installGpuObserver } from "./author-a/gpu-observer.mjs";
import { nativeArrayEvidence } from "./author-a/native-evidence.mjs";
test("upload observer selects every exact submitted object, never latest same-label history", async () => {
  const names = [
      "GPUAdapter",
      "GPURenderPassEncoder",
      "GPURenderBundleEncoder",
    ],
    old = names.map((k) => [k, globalThis[k]]);
  class Pass {
    setVertexBuffer() {}
    setIndexBuffer() {}
  }
  const device = {
    createBuffer(d) {
      return { ...d, destroy() {} };
    },
    queue: { writeBuffer() {} },
  };
  class Adapter {
    async requestDevice() {
      return device;
    }
  }
  try {
    Object.assign(globalThis, {
      GPUAdapter: Adapter,
      GPURenderPassEncoder: Pass,
      GPURenderBundleEncoder: undefined,
    });
    const ids = new WeakMap();
    let next = 1;
    const topology = {
        idFor(b) {
          if (!ids.has(b)) ids.set(b, next++);
          return ids.get(b);
        },
      },
      observer = installGpuObserver(topology),
      d = await new Adapter().requestDevice(),
      descriptor = {
        label: "pipe.hollow-elbow.outer/vertex:p",
        size: 12,
        usage: 0x20,
      },
      stale = d.createBuffer(descriptor),
      current = d.createBuffer(descriptor),
      good = new Float32Array([1, 2, 3]);
    d.queue.writeBuffer(stale, 0, new Float32Array([9, 9, 9]));
    d.queue.writeBuffer(current, 0, good);
    const pass = new Pass();
    pass.setVertexBuffer(0, stale);
    pass.setVertexBuffer(0, current);
    const meshes = [
        {
          name: "pipe.hollow-elbow.outer",
          streams: [{ id: "p", ...nativeArrayEvidence(good) }],
          indexBuffer: null,
        },
      ],
      scope = (buffers) => ({
        draws: buffers.map((b) => ({
          vertices: [{ id: topology.idFor(b), label: b.label }],
        })),
      });
    const correct = observer.evidence(meshes, scope([current]));
    assert(correct.checks.every((c) => c.ok));
    assert.equal(
      correct.buffers[0].nativeDrawBufferId,
      topology.idFor(current),
    );
    const wrong = observer.evidence(meshes, scope([stale]));
    assert.equal(wrong.checks[0].ok, false);
    assert.equal(wrong.buffers[0].nativeDrawBufferId, topology.idFor(stale));
    const both = observer.evidence(meshes, scope([stale, current]));
    assert.equal(both.buffers.length, 2);
    assert.equal(both.checks.filter((c) => !c.ok).length, 1);
    assert(observer.evidence(meshes, scope([])).checks.every((c) => !c.ok));
  } finally {
    for (const [k, v] of old)
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
  }
});
