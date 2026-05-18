import { describe, expect, it } from "vitest";

import {
  createQueuedBuiltInResourceSetSummary,
  createQueuedMaterialFrameResourceSetSummary,
  type QueuedBuiltInResourceSetSummaryItem,
  type QueuedMaterialFrameResourceSetSummaryItem,
} from "@aperture-engine/webgpu";

describe("queued material frame resource set summary", () => {
  it("summarizes generic material families and pipeline keys", () => {
    const summary = createQueuedMaterialFrameResourceSetSummary([
      genericItem("standard", "standard|base-color"),
      genericItem("custom-preview", "custom|preview"),
      genericItem("standard", "standard|base-color"),
    ]);

    expect(summary).toEqual({
      itemCount: 3,
      byFamily: [
        { family: "custom-preview", itemCount: 1 },
        { family: "standard", itemCount: 2 },
      ],
      byPipeline: [
        { pipelineKey: "custom|preview", itemCount: 1 },
        { pipelineKey: "standard|base-color", itemCount: 2 },
      ],
      byFamilyAndPipeline: [
        {
          family: "custom-preview",
          pipelineKey: "custom|preview",
          itemCount: 1,
        },
        {
          family: "standard",
          pipelineKey: "standard|base-color",
          itemCount: 2,
        },
      ],
    });
  });
});

describe("queued built-in resource set summary", () => {
  it("summarizes empty resource sets", () => {
    expect(createQueuedBuiltInResourceSetSummary([])).toEqual({
      itemCount: 0,
      byFamily: [],
      byPipeline: [],
      byFamilyAndPipeline: [],
    });
  });

  it("summarizes mixed built-in material families and pipeline keys", () => {
    const items = [
      item("standard", "standard|alpha:opaque|textures:none"),
      item("unlit", "unlit|texture:none"),
      item("matcap", "matcap|texture:matcap-a"),
      item("standard", "standard|alpha:opaque|textures:base-color"),
      item("unlit", "unlit|texture:none"),
      item("standard", "standard|alpha:opaque|textures:none"),
    ];
    const summary = createQueuedBuiltInResourceSetSummary(items);

    expect(summary).toEqual({
      itemCount: 6,
      byFamily: [
        { family: "matcap", itemCount: 1 },
        { family: "standard", itemCount: 3 },
        { family: "unlit", itemCount: 2 },
      ],
      byPipeline: [
        { pipelineKey: "matcap|texture:matcap-a", itemCount: 1 },
        {
          pipelineKey: "standard|alpha:opaque|textures:base-color",
          itemCount: 1,
        },
        { pipelineKey: "standard|alpha:opaque|textures:none", itemCount: 2 },
        { pipelineKey: "unlit|texture:none", itemCount: 2 },
      ],
      byFamilyAndPipeline: [
        {
          family: "matcap",
          pipelineKey: "matcap|texture:matcap-a",
          itemCount: 1,
        },
        {
          family: "standard",
          pipelineKey: "standard|alpha:opaque|textures:base-color",
          itemCount: 1,
        },
        {
          family: "standard",
          pipelineKey: "standard|alpha:opaque|textures:none",
          itemCount: 2,
        },
        {
          family: "unlit",
          pipelineKey: "unlit|texture:none",
          itemCount: 2,
        },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain("gpu-buffer-handle");
    expect(JSON.stringify(summary)).not.toContain("sourceMesh");
    expect(JSON.stringify(summary)).not.toContain("bindGroup");
  });
});

function item(
  materialFamily: QueuedBuiltInResourceSetSummaryItem["materialFamily"],
  pipelineKey: string,
): QueuedBuiltInResourceSetSummaryItem {
  return {
    materialFamily,
    pipelineKey,
    renderPhase: "opaque",
  };
}

function genericItem(
  materialFamily: string,
  pipelineKey: string,
): QueuedMaterialFrameResourceSetSummaryItem {
  return {
    materialFamily,
    pipelineKey,
    renderPhase: "opaque",
  };
}
