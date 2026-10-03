/** Synthetic CPU checks of evidence handling; no native GPU or browser execution. */
import test from "node:test";
import assert from "node:assert/strict";
import { decodeSubmittedDraw } from "./indirect-evidence.mjs";
import {
  installNativeObserver,
  expandNativeScope,
} from "./native-observer.mjs";
const clone = (v) => structuredClone(v);
const commands = [{ id: 10, encoderId: 11, submissionSerial: 2 }];
function argumentsBytes(indexed = false, offset = 20) {
  const bytes = new Uint8Array(offset + (indexed ? 20 : 16)),
    view = new DataView(bytes.buffer);
  for (const [i, n] of [99, 3, 7, indexed ? -17 : 6, 6].entries()) {
    if (!indexed && i === 4) break;
    if (indexed && i === 3) view.setInt32(offset + i * 4, n, true);
    else view.setUint32(offset + i * 4, n, true);
  }
  return bytes;
}
function record(indexed = false, offset = 20) {
  const bytes = argumentsBytes(indexed, offset),
    buffer = { id: 9, label: "same-label", allocationBytes: bytes.length };
  return {
    method: indexed ? "drawIndexedIndirect" : "drawIndirect",
    indirect: { buffer, offset },
    commandBufferId: 10,
    commandEncoderId: 11,
    submissionSerial: 2,
    uploads: [
      {
        ...buffer,
        submissionSerial: 2,
        contentVersion: 1,
        writeCalls: 1,
        destroyed: false,
        usage: 264,
        indirectFirstInstanceSupported: true,
        fullUploadBytes: [...bytes],
        writtenRanges: [[offset, bytes.length]],
        uncertainRanges: [],
      },
    ],
  };
}
test("16/20-byte argument formats retain method, nonzero slot offsets and signed baseVertex", () => {
  for (const indexed of [false, true])
    for (const offset of [0, 4, 20, 40]) {
      const raw = record(indexed, offset),
        decoded = decodeSubmittedDraw(raw, commands);
      assert.equal(decoded.method, raw.method);
      assert.equal(decoded.count, 99);
      assert.equal(decoded.instances, 3);
      assert.equal(decoded.start, 7);
      assert.equal(decoded.firstInstance, 6);
      assert.equal(decoded.baseVertex, indexed ? -17 : undefined);
      assert.equal(decoded.firstIndex, indexed ? 7 : undefined);
      assert.equal(decoded.firstVertex, indexed ? undefined : 7);
      assert.equal(decoded.argumentEvidence.byteOffset, offset);
      assert.equal(decoded.argumentEvidence.byteLength, indexed ? 20 : 16);
      assert.equal(raw.count, undefined);
      assert.equal(decoded.argumentSource, "submit-time-upload-observation");
    }
});
test("indirect evidence fails closed on truncation, alignment, initialization, object, version and usage defects", async (t) => {
  const mutations = [
    ["missing-buffer", (r) => delete r.indirect.buffer],
    ["misaligned-offset", (r) => r.indirect.offset++],
    ["negative-offset", (r) => (r.indirect.offset = -4)],
    ["unsafe-offset", (r) => (r.indirect.offset = Number.MAX_SAFE_INTEGER + 1)],
    ["truncated-allocation", (r) => r.indirect.buffer.allocationBytes--],
    ["truncated-preserved-bytes", (r) => r.uploads[0].fullUploadBytes.pop()],
    ["missing-written-ranges", (r) => delete r.uploads[0].writtenRanges],
    ["unwritten-last-byte", (r) => r.uploads[0].writtenRanges[0][1]--],
    [
      "unwritten-middle",
      (r) =>
        (r.uploads[0].writtenRanges = [
          [20, 24],
          [28, 36],
        ]),
    ],
    ["invalid-byte", (r) => (r.uploads[0].fullUploadBytes[20] = 300)],
    ["sparse-byte", (r) => delete r.uploads[0].fullUploadBytes[20]],
    ["same-label-different-object", (r) => (r.uploads[0].id = 99)],
    ["ambiguous-object", (r) => r.uploads.push(clone(r.uploads[0]))],
    ["stale-submission", (r) => r.uploads[0].submissionSerial--],
    ["missing-version", (r) => delete r.uploads[0].contentVersion],
    ["zero-version", (r) => (r.uploads[0].contentVersion = 0)],
    ["destroyed-buffer", (r) => (r.uploads[0].destroyed = true)],
    ["no-upload", (r) => (r.uploads[0].writeCalls = 0)],
    ["missing-indirect-usage", (r) => (r.uploads[0].usage = 8)],
    ["gpu-storage-writable", (r) => (r.uploads[0].usage |= 128)],
    ["query-resolve-writable", (r) => (r.uploads[0].usage |= 512)],
    ["unproven-copy-clear", (r) => (r.uploads[0].uncertainRanges = [[20, 36]])],
    ["missing-uncertainty-record", (r) => delete r.uploads[0].uncertainRanges],
    [
      "first-instance-feature-absent",
      (r) => (r.uploads[0].indirectFirstInstanceSupported = false),
    ],
    ["unsubmitted-command", (r) => r.commandBufferId++],
    ["wrong-encoder", (r) => r.commandEncoderId++],
    ["orphan-submission", (r) => r.submissionSerial++],
    ["fabricated-direct-count", (r) => (r.count = 99)],
    ["fabricated-direct-instance-count", (r) => (r.instances = 3)],
  ];
  for (const [name, mutate] of mutations)
    await t.test(name, () => {
      const r = record();
      mutate(r);
      assert.throws(() => decodeSubmittedDraw(r, commands));
    });
  const contiguous = record();
  contiguous.uploads[0].writtenRanges = [
    [20, 24],
    [24, 36],
  ];
  assert.equal(decodeSubmittedDraw(contiguous, commands).instances, 3);
});

async function simulation(run) {
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
    createView() {
      return {};
    }
    destroy() {}
  }
  class Base {
    setVertexBuffer() {}
    setIndexBuffer() {}
    setBindGroup() {}
    setPipeline() {}
    draw() {}
    drawIndexed() {}
    drawIndirect(buffer, offset) {
      calls.push({ method: "drawIndirect", buffer, offset });
    }
    drawIndexedIndirect(buffer, offset) {
      calls.push({ method: "drawIndexedIndirect", buffer, offset });
    }
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
    copyBufferToBuffer() {}
    clearBuffer() {}
    copyTextureToBuffer() {}
    resolveQuerySet() {}
    copyBufferToTexture() {}
    copyTextureToTexture() {}
  }
  class Queue {
    writeBuffer() {}
    writeTexture() {}
    copyExternalImageToTexture() {}
    submit() {
      if (this.fail) throw Error("native submit failed");
    }
  }
  class Device {
    queue = new Queue();
    features = new Set(["indirect-first-instance"]);
    createBuffer(d) {
      return {
        ...d,
        getMappedRange: () => new ArrayBuffer(d.size),
        unmap() {},
        destroy() {},
      };
    }
    createShaderModule() {
      return {};
    }
    createRenderPipeline() {
      return {};
    }
    createBindGroup() {
      return {};
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
      pipeline = device.createRenderPipeline({
        vertex: { module: device.createShaderModule({ code: "test" }) },
      });
    const buffer = (usage = 264) =>
      device.createBuffer({ label: "same-label", size: 60, usage });
    const encode = (args, offset = 20, indexed = false, bundle = false) => {
      const c = new Command(),
        p = c.beginRenderPass({ colorAttachments: [] }),
        draw = bundle ? new Bundle() : p;
      draw.setPipeline(pipeline);
      draw[indexed ? "drawIndexedIndirect" : "drawIndirect"](args, offset);
      if (bundle) p.executeBundles([draw.finish()]);
      p.end();
      return c;
    };
    const submit = (list) => {
      const scope = observer.begin(1);
      let captured;
      try {
        device.queue.submit(list);
      } finally {
        captured = observer.end(scope);
      }
      return expandNativeScope(captured);
    };
    await run({ observer, device, buffer, encode, submit, Command, calls });
  } finally {
    for (const [k, v] of old)
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
  }
}
test("actual indirect call buffer/offset and submit-time versions survive bundles, rewrites and later writes", async () => {
  await simulation(({ observer, device, buffer, encode, calls }) => {
    const b = buffer(),
      bytes = argumentsBytes(),
      c = encode(b, 20, false, true);
    device.queue.writeBuffer(b, 0, bytes);
    // Encoding never snapshots argument intent. The latest queued upload at submit wins.
    const changed = bytes.slice();
    new DataView(changed.buffer).setUint32(24, 8, true);
    device.queue.writeBuffer(b, 0, changed);
    const scope = observer.begin(1);
    device.queue.submit([c.finish()]);
    device.queue.writeBuffer(b, 0, bytes);
    device.queue.submit([encode(b).finish()]);
    const compact = observer.end(scope),
      result = expandNativeScope(compact),
      first = decodeSubmittedDraw(result.draws[0], result.commands),
      second = decodeSubmittedDraw(result.draws[1], result.commands);
    assert.equal(first.instances, 8);
    assert.equal(second.instances, 3);
    assert.equal(first.method, "drawIndirect");
    assert.equal(first.viaBundle, true);
    assert.equal(first.argumentEvidence.contentVersion, 2);
    assert.equal(second.argumentEvidence.contentVersion, 3);
    assert.equal(first.indirect.buffer.id, second.indirect.buffer.id);
    assert.equal(first.indirect.offset, 20);
    assert.notEqual(first.submissionSerial, second.submissionSerial);
    assert.equal(Object.keys(compact.bufferSnapshots).length, 2);
    assert.equal(calls[0].buffer, b);
    assert.equal(calls[0].offset, 20);
    assert.equal(result.draws[0].count, undefined);
  });
});
test("observer captures indexed signed arguments and refuses same-label substitution, unsubmitted and failed submission", async () => {
  await simulation(({ observer, device, buffer, encode }) => {
    const a = buffer(),
      b = buffer();
    device.queue.writeBuffer(a, 0, argumentsBytes(true));
    const scope = observer.begin(1);
    encode(a, 20, true).finish(); // Never submitted.
    device.queue.fail = true;
    assert.throws(
      () => device.queue.submit([encode(a, 20, true).finish()]),
      /native submit failed/,
    );
    device.queue.fail = false;
    device.queue.submit([
      encode(a, 20, true).finish(),
      encode(b, 20, true).finish(),
    ]);
    const result = expandNativeScope(observer.end(scope));
    assert.equal(result.draws.length, 2);
    assert.equal(result.submissions, 1);
    assert.equal(
      decodeSubmittedDraw(result.draws[0], result.commands).baseVertex,
      -17,
    );
    assert.throws(
      () => decodeSubmittedDraw(result.draws[1], result.commands),
      /version/,
    );
    const swapped = clone(result.draws[0]);
    swapped.uploads = result.draws[1].uploads;
    assert.throws(
      () => decodeSubmittedDraw(swapped, result.commands),
      /exact indirect buffer/,
    );
  });
});
test("encoded copy/clear/texture/query mutations fail closed only after submission and CPU overwrites reestablish exact ranges", async (t) => {
  for (const method of [
    "copyBufferToBuffer",
    "clearBuffer",
    "copyTextureToBuffer",
    "resolveQuerySet",
  ])
    await t.test(method, () =>
      simulation(({ device, buffer, encode, submit, Command }) => {
        const b = buffer(),
          source = buffer(),
          bytes = argumentsBytes();
        device.queue.writeBuffer(b, 0, bytes);
        const mutate = () => {
          const c = new Command();
          if (method === "copyBufferToBuffer") c[method](source, 0, b, 20, 16);
          else if (method === "clearBuffer") c[method](b, 20, 16);
          else if (method === "copyTextureToBuffer")
            c[method]({}, { buffer: b }, {});
          else c[method]({}, 0, 2, b, 20);
          return c.finish();
        };
        mutate(); // Unsubmitted mutation does not poison a valid snapshot.
        let report = submit([encode(b).finish()]);
        assert.equal(
          decodeSubmittedDraw(report.draws[0], report.commands).instances,
          3,
        );
        report = submit([encode(b).finish(), mutate()]); // Conservative same-batch rejection.
        assert.equal(report.bufferMutations.length, 1);
        assert.throws(
          () => decodeSubmittedDraw(report.draws[0], report.commands),
          /written|mutation/,
        );
        // A partial rewrite still leaves a hole.
        device.queue.writeBuffer(b, 20, bytes.slice(20, 24));
        report = submit([encode(b).finish()]);
        assert.throws(
          () => decodeSubmittedDraw(report.draws[0], report.commands),
          /written|mutation/,
        );
        device.queue.writeBuffer(b, 0, bytes);
        report = submit([encode(b).finish()]);
        assert.equal(
          decodeSubmittedDraw(report.draws[0], report.commands).instances,
          3,
        );
      }),
    );
});
test("GPU-writable arguments remain unproven even after complete CPU upload", async () => {
  await simulation(({ device, buffer, encode, submit }) => {
    const b = buffer(264 | 128);
    device.queue.writeBuffer(b, 0, argumentsBytes());
    const report = submit([encode(b).finish()]);
    assert.throws(
      () => decodeSubmittedDraw(report.draws[0], report.commands),
      /unproven GPU writes/,
    );
  });
});
