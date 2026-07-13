import { describe, expect, it } from "vitest";

import {
  compileFrameGraph,
  createBufferBackedInstanceAttributeResource,
  createFrameGraph,
  createInstanceAttributeVertexBufferLayout,
} from "@aperture-engine/webgpu/test-support";

// C1 (three.js parity plan): compute→draw plumbing. A compute pass declares a
// WRITABLE buffer as a write; the scene draw declares a READ on the same buffer
// id; the frame graph's read-after-write edge orders compute-before-draw. A
// mutual read/write between the compute and draw is rejected as a cycle.

const FLOCK_BUFFER = "boids.positions";

describe("compute→draw ordering (C1)", () => {
  it("orders a compute writer before the scene draw that reads the buffer", () => {
    const graph = createFrameGraph();
    // The realizer owns the writable buffer; the graph declares it as a resource
    // so both the compute write and the scene read reference the same handle.
    graph.declareResource({
      id: FLOCK_BUFFER,
      descriptor: { kind: "buffer", lifetime: "persistent" },
    });
    graph.importSwapchain();

    // Compute pass writes the flock buffer.
    graph.addComputePass({
      name: "boids-sim",
      reads: [],
      writes: [{ handle: FLOCK_BUFFER, attachment: "clear" }],
      commands: [],
    });
    // Scene draw reads the flock buffer (storage binding + instance stream).
    graph.addRenderPass({
      name: "boids-scene",
      reads: [FLOCK_BUFFER],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [],
    });

    const compiled = compileFrameGraph(graph);
    expect(compiled.ok).toBe(true);
    expect(compiled.report.order.indexOf("boids-sim")).toBeLessThan(
      compiled.report.order.indexOf("boids-scene"),
    );
  });

  it("orders compute-before-draw even when the compute is inserted AFTER the draw", () => {
    // Insertion order alone (the topo tiebreak) would place the draw first; the
    // read-after-write edge must still force compute first.
    const graph = createFrameGraph();
    graph.declareResource({
      id: FLOCK_BUFFER,
      descriptor: { kind: "buffer", lifetime: "persistent" },
    });
    graph.importSwapchain();

    graph.addRenderPass({
      name: "boids-scene",
      reads: [FLOCK_BUFFER],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [],
    });
    graph.addComputePass({
      name: "boids-sim",
      reads: [],
      writes: [{ handle: FLOCK_BUFFER, attachment: "clear" }],
      commands: [],
    });

    const compiled = compileFrameGraph(graph);
    expect(compiled.ok).toBe(true);
    expect(compiled.report.order.indexOf("boids-sim")).toBeLessThan(
      compiled.report.order.indexOf("boids-scene"),
    );
  });

  it("rejects a compute↔draw cycle with frameGraph.cyclicDependency", () => {
    const graph = createFrameGraph();
    graph.declareResource({
      id: FLOCK_BUFFER,
      descriptor: { kind: "buffer", lifetime: "persistent" },
    });
    graph.declareResource({
      id: "feedback",
      descriptor: { kind: "buffer", lifetime: "persistent" },
    });

    // compute writes FLOCK and reads feedback; draw writes feedback and reads
    // FLOCK — a mutual dependency.
    graph.addComputePass({
      name: "boids-sim",
      reads: ["feedback"],
      writes: [{ handle: FLOCK_BUFFER, attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "boids-scene",
      reads: [FLOCK_BUFFER],
      writes: [{ handle: "feedback", attachment: "clear" }],
      commands: [],
    });

    const compiled = compileFrameGraph(graph);
    expect(compiled.ok).toBe(false);
    expect(
      compiled.report.diagnostics.some(
        (diagnostic) => diagnostic.code === "frameGraph.cyclicDependency",
      ),
    ).toBe(true);
  });
});

describe("buffer-backed instance stream layout (C1)", () => {
  const layout = {
    attributes: [
      {
        name: "instanceState",
        format: "float32x4" as const,
        shaderLocation: 6,
        offset: 0,
        floatOffset: 0,
        components: 4,
      },
    ],
    stride: 16,
    strideFloats: 4,
    layoutKey: "abc123",
  };

  it("emits a slot-1 instance-step vertex layout at @location(6)", () => {
    const vertexLayout = createInstanceAttributeVertexBufferLayout(layout);
    expect(vertexLayout).toMatchObject({
      arrayStride: 16,
      stepMode: "instance",
    });
    expect(vertexLayout.attributes[0]).toMatchObject({
      shaderLocation: 6,
      offset: 0,
      format: "float32x4",
    });
  });

  it("wraps a realized buffer as a zero-copy instance stream (bufferBacked)", () => {
    const gpuBuffer = { label: "flock" };
    const resource = createBufferBackedInstanceAttributeResource({
      resourceKey: "instance-buffer:buffer:boids.positions@0",
      buffer: gpuBuffer,
      layout,
      instanceCount: 160,
    });

    expect(resource).toMatchObject({
      streamId: "instanceAttributes",
      resourceKey: "instance-buffer:buffer:boids.positions@0",
      buffer: gpuBuffer,
      vertexCount: 160,
      bufferBacked: true,
    });
    // No CPU-packed offsets — the buffer is consumed as-is, indexed by
    // firstInstance + instanceIndex.
    expect(resource.offsets).toEqual([]);
    expect(resource.layout).toBe(layout);
  });
});
