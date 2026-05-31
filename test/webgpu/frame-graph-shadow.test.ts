import { describe, expect, it } from "vitest";
import {
  compileFrameGraph,
  createFrameGraph,
} from "../../packages/webgpu/src/render/graph/frame-graph.js";
import {
  buildShadowCasterDepthAttachmentPlan,
  createShadowCasterGraphPasses,
  type ShadowCasterGraphPass,
} from "../../packages/webgpu/src/app/shadow-caster-graph-pass.js";
import type { RenderPassCommand } from "../../packages/webgpu/src/render/passes/render-pass-commands.js";

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
