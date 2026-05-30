import { describe, expect, it } from "vitest";

import {
  compileFrameGraph,
  createFrameGraph,
  executeFrameGraph,
  type ComputePassCommand,
  type FrameGraphResources,
  type RenderPassCommand,
} from "@aperture-engine/webgpu/test-support";

function drawCommand(renderId: number): RenderPassCommand {
  return {
    kind: "draw",
    renderId,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}

function computeCommands(): ComputePassCommand[] {
  return [
    { kind: "setComputePipeline", pipelineKey: "histogram", pipeline: {} },
    {
      kind: "setComputeBindGroup",
      index: 0,
      resourceKey: "bg0",
      bindGroup: {},
    },
    {
      kind: "dispatchWorkgroups",
      workgroupCountX: 4,
      workgroupCountY: 4,
      workgroupCountZ: 1,
    },
  ];
}

function recordingDevice(events: string[]) {
  return {
    createCommandEncoder: () => {
      events.push("createCommandEncoder");
      return {
        beginRenderPass: () => {
          events.push("beginRenderPass");
          return {
            setPipeline: () => {},
            setBindGroup: () => {},
            setVertexBuffer: () => {},
            setIndexBuffer: () => {},
            draw: () => events.push("draw"),
            drawIndexed: () => events.push("draw"),
            end: () => events.push("end"),
          };
        },
        beginComputePass: () => {
          events.push("beginComputePass");
          return {
            setPipeline: () => {},
            setBindGroup: () => {},
            dispatchWorkgroups: () => events.push("dispatchWorkgroups"),
            dispatchWorkgroupsIndirect: () => events.push("dispatchWorkgroups"),
            end: () => events.push("end"),
          };
        },
        finish: () => {
          events.push("finish");
          return { label: "command-buffer" };
        },
      };
    },
  };
}

const colorResources: FrameGraphResources = {
  resolveAttachment: (handleId) => ({
    kind: "color",
    view: { label: handleId },
  }),
};

function sceneComputeBloomCompositeGraph() {
  const graph = createFrameGraph();
  const colorDesc = {
    kind: "color-texture" as const,
    width: 8,
    height: 8,
    format: "rgba16float",
    sampleCount: 1,
  };
  graph.declareTransient("scene-color", colorDesc);
  graph.declareTransient("bloom", colorDesc);
  graph.declareResource({
    id: "histogram",
    descriptor: { kind: "buffer", lifetime: "transient" },
  });
  graph.importSwapchain();

  graph.addRenderPass({
    name: "scene",
    reads: [],
    writes: [{ handle: "scene-color", attachment: "clear" }],
    commands: [drawCommand(1)],
  });
  graph.addComputePass({
    name: "histogram",
    reads: ["scene-color"],
    writes: [{ handle: "histogram", attachment: "clear" }],
    commands: computeCommands(),
  });
  graph.addRenderPass({
    name: "bloom",
    reads: ["scene-color"],
    writes: [{ handle: "bloom", attachment: "clear" }],
    commands: [drawCommand(2)],
  });
  graph.addRenderPass({
    name: "composite",
    reads: ["scene-color", "bloom"],
    writes: [{ handle: "swapchain", attachment: "clear" }],
    commands: [drawCommand(3)],
  });
  return graph;
}

describe("frame graph execute (M3-T2)", () => {
  it("folds 3 render nodes + 1 compute node into ONE encoder / finish / submit", () => {
    const events: string[] = [];
    const compiled = compileFrameGraph(sceneComputeBloomCompositeGraph());
    expect(compiled.report.order).toEqual([
      "scene",
      "histogram",
      "bloom",
      "composite",
    ]);

    const report = executeFrameGraph({
      device: recordingDevice(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      compiled,
      resources: colorResources,
      label: "test-frame",
    });

    // exactly one encoder, one finish, one submit
    expect(events.filter((e) => e === "createCommandEncoder")).toHaveLength(1);
    expect(events.filter((e) => e === "finish")).toHaveLength(1);
    expect(events.filter((e) => e.startsWith("submit:"))).toEqual(["submit:1"]);

    // all passes' begin/draw/dispatch/end interleaved in compiled order, in ONE encoder
    expect(events).toEqual([
      "createCommandEncoder",
      "beginRenderPass",
      "draw",
      "end",
      "beginComputePass",
      "dispatchWorkgroups",
      "end",
      "beginRenderPass",
      "draw",
      "end",
      "beginRenderPass",
      "draw",
      "end",
      "finish",
      "submit:1",
    ]);

    expect(report.valid).toBe(true);
  });

  it("reports a single command buffer with summed draw/executed counts", () => {
    const events: string[] = [];
    const report = executeFrameGraph({
      device: recordingDevice(events),
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      compiled: compileFrameGraph(sceneComputeBloomCompositeGraph()),
      resources: colorResources,
      label: "test-frame",
    });

    expect(report.metrics.counts.commandBuffers).toBe(1);
    expect(report.metrics.counts.submittedCommandBuffers).toBe(1);
    // 3 render draws across nodes
    expect(report.metrics.counts.drawCalls).toBe(3);
    // 3 draws + 3 compute commands (pipeline + bindgroup + dispatch)
    expect(report.metrics.counts.executedCommands).toBe(6);
  });

  it("executes the compute node's dispatch inside the same encoder", () => {
    const events: string[] = [];
    const report = executeFrameGraph({
      device: recordingDevice(events),
      queue: { submit: () => {} },
      compiled: compileFrameGraph(sceneComputeBloomCompositeGraph()),
      resources: colorResources,
    });

    const compute = report.nodes.find((node) => node.name === "histogram");
    expect(compute?.kind).toBe("compute");
    expect(compute?.valid).toBe(true);
    if (compute?.kind === "compute") {
      expect(compute.execution?.dispatchCount).toBe(1);
      expect(compute.execution?.executedCommands).toBe(3);
    }
    // dispatch happened between beginComputePass and the next end, in-encoder
    const begin = events.indexOf("beginComputePass");
    const dispatch = events.indexOf("dispatchWorkgroups");
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(dispatch).toBe(begin + 1);
  });

  it("refuses to execute a graph that failed to compile (cycle) without creating an encoder", () => {
    const events: string[] = [];
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
      commands: [drawCommand(1)],
    });
    graph.addRenderPass({
      name: "y",
      reads: ["a"],
      writes: [{ handle: "b", attachment: "clear" }],
      commands: [drawCommand(2)],
    });

    const report = executeFrameGraph({
      device: recordingDevice(events),
      queue: { submit: () => {} },
      compiled: compileFrameGraph(graph),
      resources: colorResources,
    });

    expect(report.valid).toBe(false);
    expect(events).toEqual([]);
    expect(
      report.diagnostics.some(
        (diagnostic) => diagnostic.code === "frameGraphExecute.compileNotOk",
      ),
    ).toBe(true);
  });
});
