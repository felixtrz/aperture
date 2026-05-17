import { describe, expect, it } from "vitest";

import {
  appendPipelineScopedBindGroups,
  createPipelineScopedBindGroupScratch,
  resetPipelineScopedBindGroupScratch,
  type PipelineScopedBindGroupResource,
} from "@aperture-engine/webgpu";

describe("pipeline-scoped bind group scratch", () => {
  it("reuses scoped wrapper records while preserving material group identity", () => {
    const scratch = createPipelineScopedBindGroupScratch();
    const firstOutput: PipelineScopedBindGroupResource[] = [];
    const secondOutput: PipelineScopedBindGroupResource[] = [];
    const bindGroups = [
      bindGroup(0, "view", ["view"]),
      bindGroup(1, "world", ["world"]),
      bindGroup(2, "material", ["material"]),
    ];

    appendPipelineScopedBindGroups(
      bindGroups,
      "unlit|opaque",
      firstOutput,
      scratch,
    );

    const firstView = firstOutput[0];
    const firstWorld = firstOutput[1];
    const firstMaterial = firstOutput[2];

    resetPipelineScopedBindGroupScratch(scratch);
    appendPipelineScopedBindGroups(
      bindGroups,
      "unlit|opaque",
      secondOutput,
      scratch,
    );

    expect(secondOutput[0]).toBe(firstView);
    expect(secondOutput[1]).toBe(firstWorld);
    expect(secondOutput[2]).toBe(firstMaterial);
    expect(secondOutput[2]).toBe(bindGroups[2]);
    expect(secondOutput.map((bindGroup) => bindGroup.resourceKey)).toEqual([
      "view|pipeline:unlit|opaque",
      "world|pipeline:unlit|opaque",
      "material",
    ]);
    expect(secondOutput[0]?.entryResourceKeys).toBe(
      firstOutput[0]?.entryResourceKeys,
    );
    expect(secondOutput[0]?.entryResourceKeys).toEqual([
      "view",
      "unlit|opaque",
    ]);
  });
});

function bindGroup(
  group: number,
  resourceKey: string,
  entryResourceKeys: readonly string[],
): PipelineScopedBindGroupResource {
  return {
    group,
    resourceKey,
    layoutKey: `layout:${group}`,
    bindGroup: { group },
    entryResourceKeys,
  };
}
