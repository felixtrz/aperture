import { describe, expect, it } from "vitest";

import {
  compileFrameGraph,
  createFrameGraph,
  type FrameGraphCompileReportJsonValue,
} from "@aperture-engine/webgpu/test-support";

describe("frame graph compile (M3-T1)", () => {
  it("topologically orders nodes by declared read/write dependencies", () => {
    const graph = createFrameGraph();
    const colorDesc = {
      kind: "color-texture" as const,
      width: 8,
      height: 8,
      format: "rgba8unorm",
      sampleCount: 1,
    };
    graph.declareTransient("shadow-depth", {
      kind: "depth-texture",
      width: 8,
      height: 8,
      format: "depth32float",
      sampleCount: 1,
    });
    graph.declareTransient("depth", {
      kind: "depth-texture",
      width: 8,
      height: 8,
      format: "depth32float",
      sampleCount: 1,
    });
    graph.declareTransient("scene-color", colorDesc);
    graph.declareTransient("bloom-half", colorDesc);
    graph.declareTransient("bloom-full", colorDesc);
    graph.importSwapchain();

    // Declared in a deliberately non-linear order to prove edges (not insertion
    // order) drive the result: composite is added before its producers.
    graph.addRenderPass({
      name: "composite",
      reads: ["scene-color", "bloom-full"],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "bloom-up",
      reads: ["bloom-half"],
      writes: [{ handle: "bloom-full", attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "bloom-down",
      reads: ["scene-color"],
      writes: [{ handle: "bloom-half", attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "opaque",
      reads: ["shadow-depth"],
      writes: [
        { handle: "scene-color", attachment: "clear" },
        { handle: "depth", attachment: "clear" },
      ],
      commands: [],
    });
    graph.addRenderPass({
      name: "shadow",
      reads: [],
      writes: [{ handle: "shadow-depth", attachment: "clear" }],
      commands: [],
    });

    const compiled = compileFrameGraph(graph);

    expect(compiled.ok).toBe(true);
    expect(compiled.orderedNodes.map((node) => node.name)).toEqual([
      "shadow",
      "opaque",
      "bloom-down",
      "bloom-up",
      "composite",
    ]);
    expect(compiled.report.order).toEqual([
      "shadow",
      "opaque",
      "bloom-down",
      "bloom-up",
      "composite",
    ]);
  });

  it("infers load on a re-write and store on a producer consumed later (byte-for-byte report)", () => {
    const graph = createFrameGraph();
    graph.declareTransient("shared", {
      kind: "color-texture",
      width: 4,
      height: 4,
      format: "rgba8unorm",
      sampleCount: 1,
    });
    graph.importSwapchain();

    graph.addRenderPass({
      name: "first",
      reads: [],
      writes: [
        { handle: "shared", attachment: "clear", clearColor: [0, 0, 0, 1] },
      ],
      commands: [],
    });
    graph.addRenderPass({
      name: "second",
      reads: [],
      writes: [{ handle: "shared", attachment: "load" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "reader",
      reads: ["shared"],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [],
    });

    const compiled = compileFrameGraph(graph);

    const expected: FrameGraphCompileReportJsonValue = {
      ok: true,
      nodeCount: 3,
      edgeCount: 3,
      order: ["first", "second", "reader"],
      passes: [
        {
          name: "first",
          kind: "render",
          reads: [],
          writes: ["shared"],
          colorLoadOp: "clear",
          depthLoadOp: "none",
          storeOps: ["store"],
          aliasedFrom: null,
        },
        {
          name: "second",
          kind: "render",
          reads: [],
          writes: ["shared"],
          colorLoadOp: "load",
          depthLoadOp: "none",
          storeOps: ["store"],
          aliasedFrom: null,
        },
        {
          name: "reader",
          kind: "render",
          reads: ["shared"],
          writes: ["swapchain"],
          colorLoadOp: "clear",
          depthLoadOp: "none",
          storeOps: ["store"],
          aliasedFrom: null,
        },
      ],
      cycles: [],
      diagnostics: [],
    };

    expect(compiled.report).toEqual(expected);
  });

  it("reuses a transient slot for a non-overlapping handle with a matching descriptor", () => {
    const graph = createFrameGraph();
    const desc = {
      kind: "color-texture" as const,
      width: 16,
      height: 16,
      format: "rgba8unorm",
      sampleCount: 1,
    };
    graph.declareTransient("a", desc);
    graph.declareTransient("b", desc);
    graph.importSwapchain();

    // a is fully produced + consumed (p0..p1) and dead before b is first written
    // (p2). With a matching descriptor and non-overlapping lifetimes, b reuses
    // a's physical slot.
    graph.addRenderPass({
      name: "make-a",
      reads: [],
      writes: [{ handle: "a", attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "blit-a",
      reads: ["a"],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "make-b",
      reads: [],
      writes: [{ handle: "b", attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "blit-b",
      reads: ["b"],
      writes: [{ handle: "swapchain", attachment: "load" }],
      commands: [],
    });

    const compiled = compileFrameGraph(graph);
    const aliasB = compiled.aliasing.find((entry) => entry.handle === "b");
    expect(aliasB?.aliasedFrom).toBe("a");
  });

  it("reports a cyclic dependency without throwing and returns ok:false", () => {
    const graph = createFrameGraph();
    graph.declareTransient("a", {
      kind: "color-texture",
      width: 4,
      height: 4,
      format: "rgba8unorm",
      sampleCount: 1,
    });
    graph.declareTransient("b", {
      kind: "color-texture",
      width: 4,
      height: 4,
      format: "rgba8unorm",
      sampleCount: 1,
    });

    graph.addRenderPass({
      name: "x",
      reads: ["b"],
      writes: [{ handle: "a", attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "y",
      reads: ["a"],
      writes: [{ handle: "b", attachment: "clear" }],
      commands: [],
    });

    const compiled = compileFrameGraph(graph);

    expect(compiled.ok).toBe(false);
    expect(compiled.orderedNodes).toEqual([]);
    expect(compiled.report.order).toEqual([]);
    expect(compiled.report.cycles).toEqual([["x", "y"]]);
    expect(
      compiled.diagnostics.some(
        (diagnostic) => diagnostic.code === "frameGraph.cyclicDependency",
      ),
    ).toBe(true);
  });

  it("supports first-class compute nodes in the ordering and report", () => {
    const graph = createFrameGraph();
    graph.declareTransient("scene-color", {
      kind: "color-texture",
      width: 4,
      height: 4,
      format: "rgba16float",
      sampleCount: 1,
    });
    graph.declareResource({
      id: "histogram",
      descriptor: { kind: "buffer", lifetime: "transient" },
    });
    graph.importSwapchain();

    graph.addRenderPass({
      name: "scene",
      reads: [],
      writes: [{ handle: "scene-color", attachment: "clear" }],
      commands: [],
    });
    graph.addComputePass({
      name: "histogram",
      reads: ["scene-color"],
      writes: [{ handle: "histogram", attachment: "clear" }],
      commands: [],
    });
    graph.addRenderPass({
      name: "tonemap",
      reads: ["scene-color"],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [],
    });

    const compiled = compileFrameGraph(graph);
    expect(compiled.ok).toBe(true);
    // the compute node is ordered after the scene that produces what it reads
    expect(compiled.report.order.indexOf("histogram")).toBeGreaterThan(
      compiled.report.order.indexOf("scene"),
    );
    const histogramPass = compiled.report.passes.find(
      (pass) => pass.name === "histogram",
    );
    expect(histogramPass?.kind).toBe("compute");
  });

  it("produces a JSON-safe report and is a deterministic pure function", () => {
    const build = () => {
      const graph = createFrameGraph();
      graph.declareTransient("scene-color", {
        kind: "color-texture",
        width: 4,
        height: 4,
        format: "rgba8unorm",
        sampleCount: 1,
      });
      graph.importSwapchain();
      graph.addRenderPass({
        name: "scene",
        reads: [],
        writes: [{ handle: "scene-color", attachment: "clear" }],
        commands: [],
      });
      graph.addRenderPass({
        name: "blit",
        reads: ["scene-color"],
        writes: [{ handle: "swapchain", attachment: "clear" }],
        commands: [],
      });
      return graph;
    };

    const first = compileFrameGraph(build());
    const second = compileFrameGraph(build());

    // pure + deterministic: two independent compiles deep-equal
    expect(first.report).toEqual(second.report);

    // JSON-safe: no functions, no GPU handles — round-trips losslessly
    const roundTripped = JSON.parse(JSON.stringify(first.report));
    expect(roundTripped).toEqual(first.report);
  });
});
