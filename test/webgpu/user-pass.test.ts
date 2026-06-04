import { describe, expect, it } from "vitest";

import {
  buildUserPassNode,
  buildUserPassNodes,
  compileFrameGraph,
  createFrameGraph,
  createWebGpuAppUserPassRegistry,
  executeFrameGraph,
  type FrameGraphResources,
  type WebGpuAppPassResolvers,
} from "@aperture-engine/webgpu/test-support";

// M3-T7 (foundation) — the public addRenderPass/addComputePass/removePass node
// shape (signed-off D1: declarative node + encode(ctx) callback, string-named
// handles, edges drive order). The registry + buildUserPassNode mechanism turns
// a user descriptor into a graph-ready PassNode by invoking encode(ctx) with a
// command recorder, and compileFrameGraph orders it by its declared reads/writes
// edges. Done-when #3 (ordering after the depth producer + removePass) is proven
// here at the mechanism level; the live app wiring + example + E2E follow.

const colorDesc = {
  kind: "color-texture" as const,
  width: 8,
  height: 8,
  format: "rgba8unorm",
  sampleCount: 1,
};

function fakeResolvers(): WebGpuAppPassResolvers {
  return {
    view: (handle) => ({ view: handle }),
    buffer: (handle) => ({ buffer: handle }),
    createBindGroup: (entries) => ({ bindGroup: entries }),
  };
}

// A frame skeleton: opaque writes scene-color + depth, then the user passes.
function compileWithUserPasses(
  nodes: ReturnType<typeof buildUserPassNodes>,
): ReturnType<typeof compileFrameGraph> {
  const graph = createFrameGraph();
  graph.importSwapchain();
  graph.declareTransient("scene-color", colorDesc);
  graph.importDepth("depth", {
    width: 8,
    height: 8,
    format: "depth24plus",
    sampleCount: 1,
  });
  graph.declareResource({
    id: "histogram-buffer",
    descriptor: { kind: "buffer", lifetime: "transient" },
  });
  graph.addRenderPass({
    name: "opaque",
    reads: [],
    writes: [
      { handle: "scene-color", attachment: "clear" },
      { handle: "depth", attachment: "clear", clearDepth: 1 },
    ],
    commands: [],
  });
  for (const node of nodes) {
    if (node.kind === "compute") {
      graph.addComputePass(node);
    } else {
      graph.addRenderPass(node);
    }
  }
  return compileFrameGraph(graph);
}

describe("user pass registry + node building (M3-T7)", () => {
  it("records render commands via the encode(ctx) sink and resolves declared reads", () => {
    const views: string[] = [];
    const node = buildUserPassNode(
      {
        name: "wireframe-overlay",
        kind: "render",
        after: "opaque",
        reads: ["depth"],
        writes: [{ handle: "swapchain", attachment: "load" }],
        encode(ctx) {
          ctx.setPipeline({ id: "wireframe" });
          ctx.setBindGroup(0, ctx.bindings({ depth: ctx.view("depth") }));
          ctx.draw(3, 1);
        },
      },
      {
        ...fakeResolvers(),
        view: (handle) => {
          views.push(handle);
          return { view: handle };
        },
      },
    );

    expect(node.kind).toBe("render");
    expect(node.reads).toEqual(["depth"]);
    expect(node.writes).toEqual([{ handle: "swapchain", attachment: "load" }]);
    // encode recorded setPipeline + setBindGroup + draw, in order
    expect(node.commands.map((command) => command.kind)).toEqual([
      "setPipeline",
      "setBindGroup",
      "draw",
    ]);
    // the declared read was resolved through ctx.view()
    expect(views).toEqual(["depth"]);
  });

  it("records compute commands and rejects render methods inside a compute pass", () => {
    const node = buildUserPassNode(
      {
        name: "luminance-histogram",
        kind: "compute",
        reads: ["scene-color"],
        writes: [{ handle: "histogram-buffer" }],
        encode(ctx) {
          ctx.setComputePipeline({ id: "histogram" });
          ctx.setBindGroup(
            0,
            ctx.bindings({
              src: ctx.view("scene-color"),
              dst: ctx.buffer("histogram-buffer"),
            }),
          );
          ctx.dispatchWorkgroups(2, 2, 1);
        },
      },
      fakeResolvers(),
    );

    expect(node.kind).toBe("compute");
    expect(node.commands.map((command) => command.kind)).toEqual([
      "setComputePipeline",
      "setComputeBindGroup",
      "dispatchWorkgroups",
    ]);

    // a render method inside a compute pass throws (authoring-mistake guard)
    expect(() =>
      buildUserPassNode(
        {
          name: "bad-compute",
          kind: "compute",
          encode(ctx) {
            ctx.draw(3);
          },
        },
        fakeResolvers(),
      ),
    ).toThrow(/render method/);
  });

  it("compileFrameGraph orders a reads:['depth'] render pass AFTER the depth-producing opaque node (Done-when #3)", () => {
    const registry = createWebGpuAppUserPassRegistry();
    registry.addRenderPass({
      name: "wireframe-overlay",
      after: "opaque",
      reads: ["depth"],
      writes: [{ handle: "swapchain", attachment: "load" }],
      encode(ctx) {
        ctx.setPipeline({});
        ctx.draw(3);
      },
    });
    registry.addComputePass({
      name: "luminance-histogram",
      reads: ["scene-color"],
      writes: [{ handle: "histogram-buffer" }],
      encode(ctx) {
        ctx.setComputePipeline({});
        ctx.dispatchWorkgroups(1, 1, 1);
      },
    });

    const compiled = compileWithUserPasses(
      buildUserPassNodes(registry, fakeResolvers()),
    );
    expect(compiled.ok).toBe(true);
    const order = compiled.orderedNodes.map((node) => node.name);
    // the overlay reads 'depth' (which opaque writes) → ordered after opaque
    expect(order.indexOf("wireframe-overlay")).toBeGreaterThan(
      order.indexOf("opaque"),
    );
    // the compute histogram reads 'scene-color' (opaque writes) → after opaque
    expect(order.indexOf("luminance-histogram")).toBeGreaterThan(
      order.indexOf("opaque"),
    );
  });

  it("executes user render + compute nodes in ONE encoder, including the compute dispatch (Done-when #2 mechanism)", () => {
    const registry = createWebGpuAppUserPassRegistry();
    registry.addRenderPass({
      name: "wireframe-overlay",
      after: "opaque",
      reads: ["depth"],
      writes: [{ handle: "swapchain", attachment: "load" }],
      encode(ctx) {
        ctx.setPipeline({ id: "wireframe" });
        ctx.draw(6);
      },
    });
    registry.addComputePass({
      name: "luminance-histogram",
      reads: ["scene-color"],
      writes: [{ handle: "histogram-buffer" }],
      encode(ctx) {
        ctx.setComputePipeline({ id: "histogram" });
        ctx.setBindGroup(0, ctx.bindings({ src: ctx.view("scene-color") }));
        ctx.dispatchWorkgroups(4, 4, 1);
      },
    });

    const events: string[] = [];
    const renderPass = () => ({
      setPipeline: () => {},
      setBindGroup: () => {},
      setVertexBuffer: () => {},
      setIndexBuffer: () => {},
      setViewport: () => {},
      setScissorRect: () => {},
      draw: () => events.push("draw"),
      drawIndexed: () => events.push("draw"),
      end: () => {},
    });
    const computePass = () => ({
      setPipeline: () => {},
      setBindGroup: () => {},
      dispatchWorkgroups: () => events.push("dispatch"),
      end: () => {},
    });
    const device = {
      createCommandEncoder: () => {
        events.push("createCommandEncoder");
        return {
          beginRenderPass: renderPass,
          beginComputePass: computePass,
          finish: () => {
            events.push("finish");
            return { label: "command-buffer" };
          },
        };
      },
    };

    const graph = createFrameGraph();
    graph.importSwapchain();
    graph.declareTransient("scene-color", colorDesc);
    graph.importDepth("depth", {
      width: 8,
      height: 8,
      format: "depth24plus",
      sampleCount: 1,
    });
    graph.declareResource({
      id: "histogram-buffer",
      descriptor: { kind: "buffer", lifetime: "transient" },
    });
    // opaque produces scene-color + depth (so the overlay/compute read edges
    // order them after it); it does NOT write the swapchain (the overlay does).
    graph.addRenderPass({
      name: "opaque",
      reads: [],
      writes: [
        { handle: "scene-color", attachment: "clear" },
        { handle: "depth", attachment: "clear", clearDepth: 1 },
      ],
      commands: [],
    });
    for (const node of buildUserPassNodes(registry, fakeResolvers())) {
      if (node.kind === "compute") {
        graph.addComputePass(node);
      } else {
        graph.addRenderPass(node);
      }
    }

    const resources: FrameGraphResources = {
      // resolve every write handle to a fake attachment (depth routed to depth)
      resolveAttachment: (handle) =>
        handle === "depth"
          ? { kind: "depth", view: { view: handle } }
          : { kind: "color", view: { view: handle } },
      resolveRenderBoundary: () => null,
    };
    const exec = executeFrameGraph({
      device: device as Parameters<typeof executeFrameGraph>[0]["device"],
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      compiled: compileFrameGraph(graph),
      resources,
      label: "user-passes",
    });

    // the whole frame (opaque + user render + user compute) folds into ONE
    // command buffer / submit
    expect(
      events.filter((event) => event === "createCommandEncoder"),
    ).toHaveLength(1);
    expect(events.filter((event) => event.startsWith("submit:"))).toEqual([
      "submit:1",
    ]);
    expect(exec.metrics.counts.commandBuffers).toBe(1);
    expect(exec.metrics.counts.submittedCommandBuffers).toBe(1);
    // the user compute node ran its dispatch in-frame
    expect(events).toContain("dispatch");
    const computeNode = exec.nodes.find(
      (node) => node.name === "luminance-histogram",
    );
    expect(computeNode?.kind).toBe("compute");
    expect(
      computeNode?.kind === "compute"
        ? computeNode.execution?.dispatchCount
        : 0,
    ).toBeGreaterThan(0);
  });

  it("removePass removes the pass from the next compiled frame (Done-when #3)", () => {
    const registry = createWebGpuAppUserPassRegistry();
    registry.addRenderPass({
      name: "wireframe-overlay",
      after: "opaque",
      reads: ["depth"],
      writes: [{ handle: "swapchain", attachment: "load" }],
      encode(ctx) {
        ctx.setPipeline({});
        ctx.draw(3);
      },
    });
    expect(registry.has("wireframe-overlay")).toBe(true);
    expect(
      compileWithUserPasses(
        buildUserPassNodes(registry, fakeResolvers()),
      ).orderedNodes.map((node) => node.name),
    ).toContain("wireframe-overlay");

    expect(registry.removePass("wireframe-overlay")).toBe(true);
    expect(registry.has("wireframe-overlay")).toBe(false);
    expect(registry.size).toBe(0);
    expect(
      compileWithUserPasses(
        buildUserPassNodes(registry, fakeResolvers()),
      ).orderedNodes.map((node) => node.name),
    ).not.toContain("wireframe-overlay");
  });
});
