/** Simulated API objects test transparent observation only; never native proof. */
import test from "node:test";
import assert from "node:assert/strict";
import { installTopologyDrawObserver } from "./topology-observer.mjs";
test("draw observer joins only submitted command buffers, executed bundles, actual binding ranges and exact calls", () => {
  const keys = [
      "GPUCommandEncoder",
      "GPURenderPassEncoder",
      "GPURenderBundleEncoder",
      "GPUQueue",
    ],
    old = keys.map((k) => [k, globalThis[k]]),
    calls = [];
  class Base {
    setVertexBuffer(...args) {
      calls.push(["setVertexBuffer", ...args]);
    }
    setIndexBuffer(...args) {
      calls.push(["setIndexBuffer", ...args]);
    }
    draw(...args) {
      calls.push(["draw", ...args]);
      if (args[0] < 0) throw Error("native rejection");
    }
    drawIndexed(...args) {
      calls.push(["drawIndexed", ...args]);
    }
    drawIndirect() {}
    drawIndexedIndirect() {}
  }
  class Pass extends Base {
    executeBundles(...args) {
      calls.push(["executeBundles", ...args]);
    }
    end() {
      calls.push(["end"]);
    }
  }
  class Bundle extends Base {
    finish(...args) {
      calls.push(["bundle.finish", ...args]);
      return {};
    }
  }
  class Command {
    beginRenderPass(...args) {
      calls.push(["beginRenderPass", ...args]);
      return new Pass();
    }
    finish(...args) {
      calls.push(["finish", ...args]);
      return {};
    }
  }
  class Queue {
    submit(...args) {
      calls.push(["submit", ...args]);
    }
  }
  try {
    Object.assign(globalThis, {
      GPUCommandEncoder: Command,
      GPURenderPassEncoder: Pass,
      GPURenderBundleEncoder: Bundle,
      GPUQueue: Queue,
    });
    const observer = installTopologyDrawObserver(),
      vertex = { label: "pipe", size: 2048 },
      index = { label: "indices", size: 1024 },
      queue = new Queue();
    const bundle = new Bundle();
    bundle.setVertexBuffer(0, vertex, 16, 512);
    bundle.setIndexBuffer(index, "uint32", 0, 192);
    bundle.drawIndexed(48, 1, 0, 0, 0);
    const finishedBundle = bundle.finish();
    const scope = observer.begin(7),
      orphan = new Command(),
      orphanPass = orphan.beginRenderPass({});
    orphanPass.setVertexBuffer(0, vertex);
    orphanPass.draw(999);
    orphanPass.end();
    orphan.finish();
    const encoder = new Command(),
      pass = encoder.beginRenderPass({ label: "main" });
    pass.executeBundles([finishedBundle]);
    pass.setVertexBuffer(0, vertex, 0, 1024);
    pass.draw(72, 1, 3, 0);
    assert.throws(() => pass.draw(-1), /native rejection/);
    pass.end();
    const command = encoder.finish({ label: "submitted" });
    queue.submit([command]);
    const report = observer.end(scope);
    assert.equal(report.frame, 7);
    assert.equal(report.submissions, 1);
    assert.equal(report.draws.length, 2);
    assert.equal(report.draws[0].method, "drawIndexed");
    assert.equal(report.draws[0].count, 48);
    assert.equal(report.draws[0].viaBundle, true);
    assert.equal(report.draws[0].vertices[0].offset, 16);
    assert.equal(report.draws[0].vertices[0].size, 512);
    assert.equal(report.draws[0].vertices[0].allocationBytes, 2048);
    assert.equal(report.draws[1].count, 72);
    assert.equal(report.draws[1].start, 3);
    assert.equal(report.draws[1].vertices[0].id, observer.idFor(vertex));
    assert.equal(report.draws[0].index.id, observer.idFor(index));
    assert(
      calls.some(
        (c) => c[0] === "draw" && c[1] === 72 && c[2] === 1 && c[3] === 3,
      ),
    );
    const orphanScope = observer.begin(80),
      unsubmitted = new Command(),
      unsubmittedPass = unsubmitted.beginRenderPass({});
    unsubmittedPass.setVertexBuffer(0, vertex);
    unsubmittedPass.draw(12);
    unsubmittedPass.end();
    unsubmitted.finish();
    const unrelated = new Command();
    queue.submit([unrelated.finish()]);
    assert.equal(observer.end(orphanScope).draws.length, 0);
    const replayScope = observer.begin(81),
      replayEncoder = new Command(),
      replayPass = replayEncoder.beginRenderPass({});
    replayPass.setVertexBuffer(0, { label: "stale-before-bundle", size: 32 });
    replayPass.setIndexBuffer({ label: "stale-index", size: 16 }, "uint32");
    replayPass.executeBundles([finishedBundle]);
    replayPass.draw(3);
    replayPass.end();
    queue.submit([replayEncoder.finish()]);
    const replay = observer.end(replayScope);
    assert.deepEqual(replay.draws[0], report.draws[0]);
    assert.deepEqual(replay.draws[1].vertices, []);
    assert.equal(replay.draws[1].index, null);
    const next = observer.begin(8);
    assert.throws(() => observer.begin(9), /Overlapping/);
    assert.throws(() => observer.end({}), /Wrong/);
    queue.submit([]);
    assert.equal(observer.end(next).draws.length, 0);
  } finally {
    for (const [k, v] of old)
      if (v === undefined) delete globalThis[k];
      else globalThis[k] = v;
  }
});
