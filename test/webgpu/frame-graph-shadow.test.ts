import { describe, expect, it } from "vitest";
import { createFrameGraph } from "../../packages/webgpu/src/render/graph/frame-graph.js";
import { compileFrameGraph } from "../../packages/webgpu/src/render/graph/frame-graph-compile.js";
import {
  buildShadowCasterDepthAttachmentPlan,
  createShadowCasterGraphPasses,
  type ShadowCasterGraphPass,
} from "../../packages/webgpu/src/app/shadow-caster-graph-pass.js";
import type { RenderPassCommand } from "../../packages/webgpu/src/render/passes/render-pass-commands.js";
import {
  executeFrameGraph,
  type FrameGraphResources,
} from "../../packages/webgpu/src/render/graph/frame-graph-execute.js";
import { createRenderPassAttachmentPlan } from "../../packages/webgpu/src/render/passes/render-pass-attachments.js";
import { createShadowMapDescriptorReport } from "../../packages/webgpu/src/shadows/shadow-map-descriptor.js";
import { createShadowTextureResourceReport } from "../../packages/webgpu/src/shadows/shadow-texture-resource.js";
import { createShadowPassPlanReport } from "../../packages/webgpu/src/shadows/shadow-pass-plan.js";

// M3-T5: the shadow caster passes fold into the single frame encoder as DEPTH-ONLY
// graph nodes the forward (opaque) node READS. These pure-compile tests prove the
// architectural invariant: the read/write dependency edge — NOT imperative call
// order — drives shadow-before-opaque ordering and the store-on-no-clear inference
// that keeps a shadow depth map alive for the receiver to sample.

const drawCommand: RenderPassCommand = {
  kind: "draw",
  renderId: 1,
  vertexCount: 3,
  instanceCount: 1,
  firstVertex: 0,
  firstInstance: 0,
};

function addShadowNode(
  graph: ReturnType<typeof createFrameGraph>,
  name: string,
  handle: string,
): void {
  graph.declareTransient(handle, {
    kind: "depth-texture",
    width: 1024,
    height: 1024,
    format: "depth24plus",
    sampleCount: 1,
  });
  graph.addRenderPass({
    name,
    reads: [],
    writes: [{ handle, attachment: "clear", clearDepth: 1 }],
    commands: [drawCommand],
  });
}

describe("M3-T5 shadow caster graph nodes", () => {
  it("orders shadow caster nodes strictly before the opaque node that reads them", () => {
    // Insert the opaque node FIRST, then the shadow node — proving ORDER comes
    // from the read edge, not insertion order. The opaque node declares the
    // shadow depth handle as a read, so the compiler must run shadow first.
    const graph = createFrameGraph();
    graph.importSwapchain("swapchain");
    graph.addRenderPass({
      name: "opaque",
      reads: ["shadow:dir:0"],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [drawCommand],
    });
    addShadowNode(graph, "shadow:dir:0", "shadow:dir:0");

    const compiled = compileFrameGraph(graph);
    expect(compiled.ok).toBe(true);

    const order = compiled.orderedNodes.map((node) => node.name);
    expect(order.indexOf("shadow:dir:0")).toBeLessThan(order.indexOf("opaque"));
  });

  it("orders every cascade/face node before the opaque node (multi-pass shadow)", () => {
    const graph = createFrameGraph();
    graph.importSwapchain("swapchain");
    const shadowKeys = [
      "shadow:dir:cascade:0",
      "shadow:dir:cascade:1",
      "shadow:dir:cascade:2",
      "shadow:point:face:0",
    ];
    graph.addRenderPass({
      name: "opaque",
      reads: shadowKeys,
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [drawCommand],
    });
    for (const key of shadowKeys) {
      addShadowNode(graph, key, key);
    }

    const compiled = compileFrameGraph(graph);
    expect(compiled.ok).toBe(true);
    const order = compiled.orderedNodes.map((node) => node.name);
    const opaqueIndex = order.indexOf("opaque");
    for (const key of shadowKeys) {
      expect(order.indexOf(key)).toBeLessThan(opaqueIndex);
    }
  });

  it("keeps depthStoreOp='store' for a shadow node the opaque node reads", () => {
    // The shadow depth must be stored so the receiver bind group can sample it in
    // the same encoder. (Depth writes store conservatively; the read edge is what
    // GUARANTEES it even if the compiler's discard heuristics ever tighten.)
    const graph = createFrameGraph();
    graph.importSwapchain("swapchain");
    addShadowNode(graph, "shadow:dir:0", "shadow:dir:0");
    graph.addRenderPass({
      name: "opaque",
      reads: ["shadow:dir:0"],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [drawCommand],
    });
    const compiled = compileFrameGraph(graph);
    expect(compiled.ok).toBe(true);
    expect(
      compiled.perNodeLoadStoreOps.get("shadow:dir:0")?.writeStoreOps[0],
    ).toBe("store");
  });

  it("lets the read edge — not insertion order — decide shadow-before-opaque", () => {
    // Insert the shadow node AFTER the opaque node. WITH the read edge the
    // compiler still runs shadow first; WITHOUT it insertion order stands and the
    // opaque node runs first — proving the dependency edge drives ordering.
    const withRead = createFrameGraph();
    withRead.importSwapchain("swapchain");
    withRead.addRenderPass({
      name: "opaque",
      reads: ["shadow:dir:0"],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [drawCommand],
    });
    addShadowNode(withRead, "shadow:dir:0", "shadow:dir:0");
    const withOrder = compileFrameGraph(withRead).orderedNodes.map(
      (node) => node.name,
    );
    expect(withOrder.indexOf("shadow:dir:0")).toBeLessThan(
      withOrder.indexOf("opaque"),
    );

    const noRead = createFrameGraph();
    noRead.importSwapchain("swapchain");
    noRead.addRenderPass({
      name: "opaque",
      reads: [],
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [drawCommand],
    });
    addShadowNode(noRead, "shadow:dir:0", "shadow:dir:0");
    const noOrder = compileFrameGraph(noRead).orderedNodes.map(
      (node) => node.name,
    );
    expect(noOrder.indexOf("opaque")).toBeLessThan(
      noOrder.indexOf("shadow:dir:0"),
    );
  });
});

describe("createShadowCasterGraphPasses", () => {
  const depthView = { __view: "cascade-0" };
  const passAttachments = {
    ready: true,
    status: "ready" as const,
    passCount: 2,
    attachmentCount: 2,
    sections: {
      passPlans: true,
      depthTextureResources: true,
      depthAttachments: true,
      commandEncoder: false as const,
      passSubmission: false as const,
      shaderSampling: false as const,
    },
    attachments: [
      {
        passKey: "pass-0",
        shadowId: 7,
        lightId: 11,
        textureKey: "tex",
        viewKey: "view-0",
        width: 1024,
        height: 1024,
        depthFormat: "depth24plus" as const,
        depthLoadOp: "clear" as const,
        depthStoreOp: "store" as const,
        depthClearValue: 1 as const,
      },
      {
        passKey: "pass-missing-view",
        shadowId: 7,
        lightId: 12,
        textureKey: "tex",
        viewKey: "view-missing",
        width: 1024,
        height: 1024,
        depthFormat: "depth24plus" as const,
        depthLoadOp: "clear" as const,
        depthStoreOp: "store" as const,
        depthClearValue: 1 as const,
      },
    ],
    diagnostics: [],
  };
  const depthTextureResources = {
    ready: true,
    status: "ready" as const,
    textureDescriptorCount: 1,
    textureDescriptorsAvailable: true,
    createdTextureCount: 1,
    reusedTextureCount: 0,
    resources: [
      {
        shadowId: 7,
        lightId: 11,
        textureKey: "tex",
        allocation: { resource: { texture: {} } },
        attachmentViews: [{ viewKey: "view-0", view: depthView }],
      },
    ],
    diagnostics: [],
  } as unknown as Parameters<
    typeof createShadowCasterGraphPasses
  >[0]["depthTextureResources"];

  it("pairs each planned attachment with its commands and resolved depth view", () => {
    const passes = createShadowCasterGraphPasses({
      passAttachments,
      depthTextureResources,
      commandRecords: [
        { passKey: "pass-0", commands: [drawCommand] },
        { passKey: "pass-missing-view", commands: [drawCommand] },
      ],
    });

    // pass-0 resolves; pass-missing-view has no live depth view and is dropped.
    expect(passes).toHaveLength(1);
    const pass = passes[0] as ShadowCasterGraphPass;
    expect(pass.key).toBe("pass-0");
    expect(pass.depthView).toBe(depthView);
    expect(pass.depthLoadOp).toBe("clear");
    expect(pass.depthStoreOp).toBe("store");
    expect(pass.commands).toHaveLength(1);
  });

  it("drops passes that have no caster commands", () => {
    const passes = createShadowCasterGraphPasses({
      passAttachments,
      depthTextureResources,
      commandRecords: [],
    });
    expect(passes).toHaveLength(0);
  });

  it("builds a depth-only attachment plan (no color targets)", () => {
    const plan = buildShadowCasterDepthAttachmentPlan({
      key: "pass-0",
      depthView,
      depthLoadOp: "clear",
      depthStoreOp: "store",
      depthClearValue: 1,
      width: 1024,
      height: 1024,
      depthFormat: "depth24plus",
      commands: [drawCommand],
    });
    expect(plan.valid).toBe(true);
    expect(plan.plan?.colorAttachments).toHaveLength(0);
    expect(plan.plan?.depthStencilAttachment?.view).toBe(depthView);
    expect(plan.plan?.depthStencilAttachment?.depthStoreOp).toBe("store");
  });
});

function recordingDevice(events: string[]) {
  return {
    createCommandEncoder: () => {
      events.push("createCommandEncoder");
      return {
        beginRenderPass: (descriptor: {
          readonly colorAttachments: readonly unknown[];
          readonly depthStencilAttachment?: unknown;
        }) => {
          const depthOnly =
            descriptor.colorAttachments.length === 0 &&
            descriptor.depthStencilAttachment !== undefined;
          events.push(depthOnly ? "beginDepthPass" : "beginColorPass");
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
        finish: () => {
          events.push("finish");
          return { label: "command-buffer" };
        },
      };
    },
  };
}

describe("M3-T5 shadow caster fold executes in ONE encoder / submit", () => {
  it("folds depth-only shadow nodes + the forward node into one encoder with one submit, shadows first", () => {
    // Done-when #2: a frame with shadow casters + opaque submits ONE command
    // buffer and does NOT invoke a separate shadow submit. Two depth-only shadow
    // nodes the forward node READS are encoded into the SAME encoder, before the
    // forward color pass, then finished + submitted exactly once.
    const events: string[] = [];
    const device = recordingDevice(events);

    const shadowKeys = ["shadow:dir:cascade:0", "shadow:dir:cascade:1"];
    const passesByName = new Map<string, ShadowCasterGraphPass>(
      shadowKeys.map((key) => [
        `${key}:fg`,
        {
          key,
          depthView: { __depth: key },
          depthLoadOp: "clear" as const,
          depthStoreOp: "store" as const,
          depthClearValue: 1,
          width: 1024,
          height: 1024,
          depthFormat: "depth24plus",
          commands: [drawCommand],
        },
      ]),
    );

    const graph = createFrameGraph();
    graph.importSwapchain("swapchain");
    for (const key of shadowKeys) {
      graph.declareTransient(`shadow:${key}`, {
        kind: "depth-texture",
        width: 1024,
        height: 1024,
        format: "depth24plus",
        sampleCount: 1,
      });
      graph.addRenderPass({
        name: `${key}:fg`,
        reads: [],
        writes: [
          { handle: `shadow:${key}`, attachment: "clear", clearDepth: 1 },
        ],
        commands: [drawCommand],
      });
    }
    graph.addRenderPass({
      name: "forward",
      reads: shadowKeys.map((key) => `shadow:${key}`),
      writes: [{ handle: "swapchain", attachment: "clear" }],
      commands: [drawCommand],
    });

    const resources: FrameGraphResources = {
      resolveAttachment: () => null,
      resolveRenderBoundary: (node) => {
        const shadowPass = passesByName.get(node.name);
        if (shadowPass !== undefined) {
          return {
            device,
            attachments: buildShadowCasterDepthAttachmentPlan(shadowPass),
            commands: node.commands as RenderPassCommand[],
            label: node.name,
            colorTargetSource: "offscreen-target",
          };
        }
        return {
          device,
          attachments: createRenderPassAttachmentPlan({
            colorTargets: [
              { view: { label: "swap" }, loadOp: "clear", storeOp: "store" },
            ],
          }),
          commands: node.commands as RenderPassCommand[],
          label: node.name,
          colorTargetSource: "offscreen-target",
        };
      },
    };

    const report = executeFrameGraph({
      device,
      queue: { submit: (buffers) => events.push(`submit:${buffers.length}`) },
      compiled: compileFrameGraph(graph),
      resources,
      label: "shadow-fold",
    });

    // depth-only shadow nodes ENCODE valid in the shared encoder (the gap that the
    // real-GPU fold exposed: a render pass with zero color attachments + a depth
    // attachment must encode valid).
    expect(report.valid).toBe(true);

    // ONE encoder, ONE finish, ONE submit of ONE command buffer (no separate
    // shadow submit).
    expect(events.filter((e) => e === "createCommandEncoder")).toHaveLength(1);
    expect(events.filter((e) => e === "finish")).toHaveLength(1);
    expect(events.filter((e) => e.startsWith("submit:"))).toEqual(["submit:1"]);
    expect(report.metrics.counts.commandBuffers).toBe(1);
    expect(report.metrics.counts.submittedCommandBuffers).toBe(1);

    // both shadow depth passes are encoded BEFORE the forward color pass.
    const depthCount = events.filter((e) => e === "beginDepthPass").length;
    expect(depthCount).toBe(2);
    const lastDepth = events.lastIndexOf("beginDepthPass");
    const forwardColor = events.indexOf("beginColorPass");
    expect(forwardColor).toBeGreaterThan(lastDepth);
  });
});

describe("M3-T5 shadow pass plan is 'ready' under the graph path (Done-when #4)", () => {
  // The folded graph path drives shadow casters with submission:"ready" — the engine
  // renders them as in-encoder nodes, NOT the legacy deferred separate submit. Prove
  // the ShadowPassPlanReport then reports status:"ready" + sections.passSubmission:true
  // (was "deferred"/false on the legacy unimplemented path). Inputs are built through
  // the SAME chain shadow-pass-plan.test.ts uses (descriptor -> textures -> plan).
  function shadowRequest(shadowId: number, lightId: number) {
    return {
      shadowId,
      lightId,
      lightKind: "directional" as const,
      casterLayerMask: 0xffffffff,
      receiverLayerMask: 0xffffffff,
      castsShadow: true,
      receivesShadow: true,
    };
  }
  function shadowTextures() {
    return createShadowTextureResourceReport({
      descriptors: createShadowMapDescriptorReport({
        shadowRequests: [shadowRequest(7, 11)],
        descriptors: [
          { shadowId: 7, lightId: 11, mapSize: 1024, depthBias: 0.001 },
        ],
      }),
    });
  }

  it("reports status:'ready' + sections.passSubmission:true for the graph path", () => {
    const report = createShadowPassPlanReport({
      shadowRequests: [shadowRequest(7, 11)],
      textures: shadowTextures(),
      submission: "ready",
    });
    expect(report.status).toBe("ready");
    expect(report.sections.passSubmission).toBe(true);
    expect(report.ready).toBe(true);
  });

  it("stays 'deferred' (passSubmission:false) on the legacy unimplemented path", () => {
    const report = createShadowPassPlanReport({
      shadowRequests: [shadowRequest(7, 11)],
      textures: shadowTextures(),
    });
    expect(report.status).toBe("deferred");
    expect(report.sections.passSubmission).toBe(false);
  });
});
