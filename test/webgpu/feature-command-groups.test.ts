import { describe, expect, it } from "vitest";
import type { RenderSnapshot, RenderSortKey } from "@aperture-engine/render";
import {
  createWebGpuFeatureCommandGroupsFromCommands,
  createWebGpuFeatureRealizerRegistry,
  mergeSnapshotSortedRenderPassCommands,
  orderWebGpuFeatureCommandGroups,
  validateWebGpuFeatureCommandGroups,
  type WebGpuFeatureCommandGroup,
} from "../../packages/webgpu/src/app/feature-command-groups.js";
import type { RenderPassCommand } from "../../packages/webgpu/src/render/passes/render-pass-commands.js";

describe("WebGPU feature command groups", () => {
  it("groups commands by render id and attaches snapshot sort keys", () => {
    const groups = createWebGpuFeatureCommandGroupsFromCommands({
      featureId: "particles",
      phase: "transparent",
      snapshot: snapshotWithSortKeys([
        [10, sortKey({ order: 2, depth: 0.4 })],
        [20, sortKey({ order: 1, depth: 0.8 })],
      ]),
      commands: [draw(10), draw(10), draw(20)],
    });

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      featureId: "particles",
      phase: "transparent",
      ordinal: 0,
      commands: [{ renderId: 10 }, { renderId: 10 }],
      sortKey: expect.objectContaining({ order: 2 }),
    });
    expect(groups[1]).toMatchObject({
      ordinal: 1,
      commands: [{ renderId: 20 }],
      sortKey: expect.objectContaining({ order: 1 }),
    });
  });

  it("prefers an explicit sort-key lookup and skips snapshot derivation for empty commands", () => {
    const explicit = new Map([[10, sortKey({ order: 7, depth: 0.1 })]]);

    expect(
      createWebGpuFeatureCommandGroupsFromCommands({
        featureId: "custom",
        phase: "transparent",
        sortKeys: explicit,
        commands: [draw(10)],
      })[0]?.sortKey,
    ).toMatchObject({ order: 7 });
    expect(
      createWebGpuFeatureCommandGroupsFromCommands({
        featureId: "custom",
        phase: "transparent",
        snapshot: snapshotWithSortKeys([]),
        commands: [],
      }),
    ).toEqual([]);
  });

  it("flags scene-phase groups without sort keys", () => {
    const groups = createWebGpuFeatureCommandGroupsFromCommands({
      featureId: "particles",
      phase: "transparent",
      snapshot: snapshotWithSortKeys([]),
      commands: [draw(10)],
    });

    expect(validateWebGpuFeatureCommandGroups(groups)).toEqual([
      expect.objectContaining({
        code: "webGpuFeatureCommandGroup.missingSortKey",
        featureId: "particles",
        phase: "transparent",
      }),
    ]);
  });

  it("orders phases and transparent sort keys deterministically", () => {
    const groups: WebGpuFeatureCommandGroup[] = [
      group("overlay", 4, 4),
      group("transparent", 2, 2, sortKey({ order: 2, depth: 0.2 })),
      group("opaque", 0, 0, sortKey({ order: 0, depth: 0.1 })),
      group("alpha-test", 1, 1, sortKey({ order: 1, depth: 0.1 })),
      group("transparent", 5, 5, sortKey({ order: 1, depth: 0.2 })),
    ];

    expect(
      orderWebGpuFeatureCommandGroups(groups).map((next) => [
        next.phase,
        next.commands[0]?.renderId,
      ]),
    ).toEqual([
      ["opaque", 0],
      ["alpha-test", 1],
      ["transparent", 5],
      ["transparent", 2],
      ["overlay", 4],
    ]);
  });

  it("prepares registered realizers in order and splits scene and overlay output", async () => {
    const calls: string[] = [];
    const registry = createWebGpuFeatureRealizerRegistry<{
      readonly frame: number;
    }>();

    registry.register({
      id: "ui",
      packetFamilies: ["uiNodes"],
      prepareFrame(input) {
        calls.push(`ui:${input.frame}`);
        return {
          valid: true,
          commandGroups: [group("overlay", 20, 2_000)],
          report: { uiNodes: 1 },
        };
      },
    });
    registry.register({
      id: "particles",
      packetFamilies: ["particleEmitters"],
      prepareFrame(input) {
        calls.push(`particles:${input.frame}`);
        return {
          valid: true,
          commandGroups: [
            group("transparent", 10, 10, sortKey({ order: 1, depth: 0.2 })),
            group("overlay", 30, 1_000),
          ],
        };
      },
    });

    const frame = await registry.prepareFrame({ frame: 7 });

    expect(calls).toEqual(["ui:7", "particles:7"]);
    expect(frame.valid).toBe(true);
    expect(frame.diagnostics).toEqual([]);
    expect(frame.sceneGroups.map((next) => next.phase)).toEqual([
      "transparent",
    ]);
    // Overlay commands flatten by ascending ordinal, not registration order.
    expect(frame.overlayCommands.map((next) => next.renderId)).toEqual([
      30, 20,
    ]);
    expect(frame.reports.get("ui")).toEqual({ uiNodes: 1 });
    expect(frame.reports.has("particles")).toBe(false);
  });

  it("treats empty command groups and advisory diagnostics as non-fatal", async () => {
    const registry = createWebGpuFeatureRealizerRegistry();

    registry.register({
      id: "debug-lines",
      packetFamilies: ["debugLines"],
      prepareFrame() {
        return {
          valid: true,
          commandGroups: [
            {
              featureId: "debug-lines",
              phase: "overlay",
              ordinal: 0,
              commands: [],
            },
          ],
          diagnostics: [{ code: "debugLines.idleFrame", message: "no lines" }],
        };
      },
    });

    const frame = await registry.prepareFrame({});

    expect(frame.valid).toBe(true);
    expect(frame.sceneGroups).toEqual([]);
    expect(frame.overlayCommands).toEqual([]);
    expect(frame.diagnostics).toEqual([
      expect.objectContaining({ code: "debugLines.idleFrame" }),
    ]);
  });

  it("propagates realizer exceptions instead of swallowing them", async () => {
    const registry = createWebGpuFeatureRealizerRegistry();

    registry.register({
      id: "particles",
      packetFamilies: ["particleEmitters"],
      prepareFrame() {
        throw new Error("particle buffers failed");
      },
    });

    await expect(registry.prepareFrame({})).rejects.toThrow(
      "particle buffers failed",
    );
  });

  it("keeps invalid realizer results invalid even without diagnostics", async () => {
    const registry = createWebGpuFeatureRealizerRegistry();

    registry.register({
      id: "ui",
      packetFamilies: ["uiNodes"],
      prepareFrame() {
        return {
          valid: false,
          commandGroups: [group("overlay", 20, 20)],
        };
      },
    });

    const frame = await registry.prepareFrame({});

    expect(frame.valid).toBe(false);
    expect(frame.overlayCommands).toHaveLength(1);
  });

  it("rejects duplicate realizer ids at registration time", () => {
    const registry = createWebGpuFeatureRealizerRegistry();

    registry.register(realizer("particles", () => undefined));

    expect(() =>
      registry.register(realizer("particles", () => undefined)),
    ).toThrow("WebGPU feature realizer 'particles' is already registered.");
  });

  it("unregisters a realizer and invokes its disposer once", async () => {
    const disposed: string[] = [];
    const registry = createWebGpuFeatureRealizerRegistry();
    const unregister = registry.register({
      id: "ui",
      packetFamilies: ["uiNodes"],
      prepareFrame() {
        return {
          valid: true,
          commandGroups: [group("overlay", 20, 20)],
        };
      },
      dispose() {
        disposed.push("ui");
      },
    });

    expect(registry.list().map((realizer) => realizer.id)).toEqual(["ui"]);

    await unregister();
    await unregister();

    expect(registry.list()).toEqual([]);
    expect(disposed).toEqual(["ui"]);
  });

  it("disposes registered realizers in reverse order", async () => {
    const disposed: string[] = [];
    const registry = createWebGpuFeatureRealizerRegistry();

    registry.register(realizer("ui", () => disposed.push("ui")));
    registry.register(realizer("particles", () => disposed.push("particles")));
    registry.register(realizer("debug", () => disposed.push("debug")));

    await registry.dispose();

    expect(disposed).toEqual(["debug", "particles", "ui"]);
    expect(registry.list()).toEqual([]);
  });
});

describe("mergeSnapshotSortedRenderPassCommands", () => {
  it("returns base commands untouched when there is no overlay or feature work", () => {
    const base = [draw(11)];
    const merged = mergeSnapshotSortedRenderPassCommands({
      snapshot: snapshotWithSortKeys([]),
      baseCommands: base,
      overlayCommands: [],
    });

    expect(merged.commands).toBe(base);
    expect(merged.diagnostics).toEqual([]);
  });

  it("never touches the snapshot on frames without feature or overlay work", () => {
    // A trapped snapshot proves the whole-snapshot sort-key map is not built
    // (no meshDraws/spriteDraws/... scan) when there is nothing to merge.
    const trappedSnapshot = new Proxy(
      {},
      {
        get(_target, property) {
          throw new Error(`unexpected snapshot access: ${String(property)}`);
        },
      },
    ) as RenderSnapshot;
    const base = [draw(11)];

    expect(
      mergeSnapshotSortedRenderPassCommands({
        snapshot: trappedSnapshot,
        baseCommands: base,
        overlayCommands: [],
        featureGroups: [],
      }).commands,
    ).toBe(base);
    expect(
      createWebGpuFeatureCommandGroupsFromCommands({
        featureId: "particles",
        phase: "transparent",
        snapshot: trappedSnapshot,
        commands: [],
      }),
    ).toEqual([]);
  });

  it("honors feature-group sort keys when interleaving with snapshot commands", () => {
    const snapshot = snapshotWithSortKeys([
      [11, sortKey({ order: 5, depth: 0.5 })],
    ]);
    const merged = mergeSnapshotSortedRenderPassCommands({
      snapshot,
      baseCommands: [draw(11)],
      overlayCommands: [],
      featureGroups: [
        // Synthetic renderId unknown to the snapshot; the explicit sortKey
        // must be honored instead of falling back.
        group("transparent", 900, 0, sortKey({ order: 1, depth: 0.5 })),
        group("transparent", 901, 1, sortKey({ order: 9, depth: 0.5 })),
      ],
    });

    expect(merged.diagnostics).toEqual([]);
    expect(merged.commands.map((next) => next.renderId)).toEqual([
      900, 11, 901,
    ]);
  });

  it("degrades only keyless groups to the end and reports them", () => {
    const snapshot = snapshotWithSortKeys([
      [11, sortKey({ order: 2, depth: 0.5 })],
      [12, sortKey({ order: 1, depth: 0.5 })],
    ]);
    const merged = mergeSnapshotSortedRenderPassCommands({
      snapshot,
      baseCommands: [draw(11)],
      overlayCommands: [draw(12)],
      featureGroups: [group("transparent", 900, 0)],
    });

    // Keyed commands keep exact snapshot-sorted interleaving; the keyless
    // group degrades to the end instead of unsorting the whole frame.
    expect(merged.commands.map((next) => next.renderId)).toEqual([12, 11, 900]);
    expect(merged.diagnostics).toEqual([
      expect.objectContaining({
        code: "webGpuFeatureCommandGroup.missingSortKey",
        featureId: "feature",
      }),
    ]);
  });

  it("derives missing feature-group keys from the snapshot before degrading", () => {
    const snapshot = snapshotWithSortKeys([
      [11, sortKey({ order: 2, depth: 0.5 })],
      [900, sortKey({ order: 1, depth: 0.5 })],
    ]);
    const merged = mergeSnapshotSortedRenderPassCommands({
      snapshot,
      baseCommands: [draw(11)],
      overlayCommands: [],
      featureGroups: [group("transparent", 900, 0)],
    });

    expect(merged.diagnostics).toEqual([]);
    expect(merged.commands.map((next) => next.renderId)).toEqual([900, 11]);
  });
});

function realizer(id: string, dispose: () => void) {
  return {
    id,
    packetFamilies: [id],
    prepareFrame() {
      return {
        valid: true,
        commandGroups: [],
      };
    },
    dispose,
  };
}

function group(
  phase: WebGpuFeatureCommandGroup["phase"],
  renderId: number,
  ordinal: number,
  sortKeyValue?: RenderSortKey,
): WebGpuFeatureCommandGroup {
  return {
    featureId: "feature",
    phase,
    ordinal,
    commands: [draw(renderId)],
    ...(sortKeyValue === undefined ? {} : { sortKey: sortKeyValue }),
  };
}

function draw(renderId: number): RenderPassCommand {
  return {
    kind: "draw",
    renderId,
    vertexCount: 3,
    instanceCount: 1,
    firstVertex: 0,
    firstInstance: 0,
  };
}

function snapshotWithSortKeys(
  entries: readonly (readonly [number, RenderSortKey])[],
): RenderSnapshot {
  return {
    meshDraws: entries.map(([renderId, sortKeyValue]) => ({
      renderId,
      sortKey: sortKeyValue,
    })),
    spriteDraws: [],
    quadBatches: [],
    particleEmitters: [],
  } as unknown as RenderSnapshot;
}

function sortKey(input: {
  readonly order: number;
  readonly depth: number;
}): RenderSortKey {
  return {
    queue: "transparent",
    viewId: 0,
    layer: 0,
    order: input.order,
    pipelineKey: "pipeline",
    materialKey: `material:${input.order}`,
    meshKey: "mesh",
    depth: input.depth,
    stableId: input.order,
  };
}
