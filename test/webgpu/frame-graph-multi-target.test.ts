import { describe, expect, it } from "vitest";

import {
  compileFrameGraph,
  createFrameGraph,
  type FrameGraphLoadOp,
} from "@aperture-engine/webgpu/test-support";

// M3-T4 regression keystone (Done-when #3): the FrameGraph compiler's global
// renderTargetMap load/store inference must reproduce the legacy multi-target
// loadExistingTarget behavior (frame-boundaries.ts submittedTargetCounts): the
// FIRST submission to a render target clears, every SUBSEQUENT submission to the
// same target loads (so a second camera onto the same target does not wipe the
// first camera's pixels), and a producing target stores when a later submission
// loads it.

// Independent reimplementation of the legacy submittedTargetCounts logic
// (frame-boundaries.ts:261-274): loadExistingTarget = previousTargetSubmissions > 0.
function legacyLoadOps(targetKeys: readonly string[]): FrameGraphLoadOp[] {
  const seen = new Map<string, number>();
  return targetKeys.map((key) => {
    const previous = seen.get(key) ?? 0;
    seen.set(key, previous + 1);
    return previous > 0 ? "load" : "clear";
  });
}

// Build the multi-target frame as the T4 builder will: one render node per
// target submission, writing its target handle with the per-submission intent
// derived the same way the legacy loop derives loadExistingTarget.
function buildMultiTargetGraph(targetKeys: readonly string[]) {
  const graph = createFrameGraph();
  const declared = new Set<string>();
  const seen = new Map<string, number>();
  const colorDesc = {
    kind: "color-texture" as const,
    width: 4,
    height: 4,
    format: "rgba8unorm",
    sampleCount: 1,
  };

  targetKeys.forEach((key, index) => {
    if (!declared.has(key)) {
      declared.add(key);
      if (key === "swapchain") {
        graph.importSwapchain();
      } else {
        graph.declareTransient(key, colorDesc);
      }
    }
    const previous = seen.get(key) ?? 0;
    seen.set(key, previous + 1);
    const attachment = previous > 0 ? ("load" as const) : ("clear" as const);
    // each target carries its own depth; the legacy loadExistingTarget drives
    // BOTH color and depth load ops (frame-boundaries.ts depthLoadOp), so the
    // per-target depth handle takes the same intent.
    const depthHandle = `depth:${key}`;
    if (!declared.has(depthHandle)) {
      declared.add(depthHandle);
      graph.declareTransient(depthHandle, {
        kind: "depth-texture",
        width: 4,
        height: 4,
        format: "depth24plus",
        sampleCount: 1,
      });
    }
    graph.addRenderPass({
      name: `target:${index}:${key}`,
      reads: [],
      writes: [
        { handle: key, attachment },
        { handle: depthHandle, attachment },
      ],
      commands: [],
    });
  });

  return graph;
}

describe("frame graph multi-target load/store (M3-T4)", () => {
  it("reproduces the legacy submittedTargetCounts clear-then-load sequence", () => {
    // two offscreen submissions sharing a handle + one swapchain, interleaved.
    const targetKeys = ["rt:A", "swapchain", "rt:A"];
    const compiled = compileFrameGraph(buildMultiTargetGraph(targetKeys));

    expect(compiled.ok).toBe(true);
    // submission order preserved (write-after-write on rt:A keeps insertion order)
    expect(compiled.report.order).toEqual([
      "target:0:rt:A",
      "target:1:swapchain",
      "target:2:rt:A",
    ]);

    const colorLoadOps = compiled.report.passes.map((pass) => pass.colorLoadOp);
    // the compiler's per-target colorLoadOp sequence equals the legacy logic's
    expect(colorLoadOps).toEqual(legacyLoadOps(targetKeys));
    expect(colorLoadOps).toEqual(["clear", "clear", "load"]);

    // depth follows the same loadExistingTarget sequence
    const depthLoadOps = compiled.report.passes.map((pass) => pass.depthLoadOp);
    expect(depthLoadOps).toEqual(legacyLoadOps(targetKeys));
  });

  it("stores a target that a later submission loads (store-on-no-clear)", () => {
    const compiled = compileFrameGraph(
      buildMultiTargetGraph(["rt:A", "swapchain", "rt:A"]),
    );
    const passes = new Map(
      compiled.report.passes.map((pass) => [pass.name, pass]),
    );

    // writes are [color, depth] per node. rt:A's first submission stores BOTH
    // color + depth because the third submission loads them (store-on-no-clear).
    expect(passes.get("target:0:rt:A")?.storeOps).toEqual(["store", "store"]);
    // swapchain (imported) stores its presented color; its depth is transient,
    // written once, never reloaded ⇒ discard.
    expect(passes.get("target:1:swapchain")?.storeOps).toEqual([
      "store",
      "discard",
    ]);
    // rt:A's last submission has no later reader (transient color + depth) ⇒ discard
    expect(passes.get("target:2:rt:A")?.storeOps).toEqual([
      "discard",
      "discard",
    ]);
  });

  it("matches the legacy sequence for a four-target grid (no shared targets)", () => {
    // four distinct viewports onto the swapchain (camera-viewport-grid): each is
    // a fresh submission to the SAME swapchain target, so clear-then-load x3.
    const targetKeys = ["swapchain", "swapchain", "swapchain", "swapchain"];
    const compiled = compileFrameGraph(buildMultiTargetGraph(targetKeys));

    expect(compiled.report.passes.map((pass) => pass.colorLoadOp)).toEqual(
      legacyLoadOps(targetKeys),
    );
    expect(compiled.report.passes.map((pass) => pass.colorLoadOp)).toEqual([
      "clear",
      "load",
      "load",
      "load",
    ]);
  });
});
