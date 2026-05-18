import { describe, expect, it } from "vitest";

import {
  createMatcapMaterialAsset,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  type MaterialQueueItem,
} from "@aperture-engine/core";
import {
  createBuiltInMaterialQueueRouteAdapterRegistry,
  routeQueuedMaterialPrepare,
} from "@aperture-engine/webgpu";

describe("queued material prepare route contract", () => {
  it("routes valid built-in material queue items through JSON-safe prepared key shells", () => {
    const result = routeQueuedMaterialPrepare(
      createBuiltInMaterialQueueRouteAdapterRegistry(),
      {
        queueItem: queueItem("standard", "opaque"),
        material: createStandardMaterialAsset(),
        sourceVersion: 4,
        frame: 12,
      },
    );

    expect(result).toEqual({
      valid: true,
      status: "prepared",
      family: "standard",
      materialKey: "material:standard",
      meshResourceKey: "gpu-mesh:mesh:cube",
      materialResourceKey: "gpu-material:material:standard",
      pipelineKey: "standard|opaque|back|less|none",
      sourceVersion: 4,
      frame: 12,
      diagnostics: [],
    });
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("skips queue families without a registered prepare route adapter", () => {
    const result = routeQueuedMaterialPrepare(
      createBuiltInMaterialQueueRouteAdapterRegistry(),
      {
        queueItem: queueItem(
          "toon-shaded",
          "opaque",
          "toon-shaded|opaque|back|less|none",
        ),
        material: createUnlitMaterialAsset(),
        sourceVersion: 1,
        frame: 2,
      },
    );

    expect(result).toMatchObject({
      valid: false,
      status: "skipped",
      family: "toon-shaded",
      materialKey: "material:toon-shaded",
      meshResourceKey: "gpu-mesh:mesh:cube",
      materialResourceKey: "gpu-material:material:toon-shaded",
      pipelineKey: "toon-shaded|opaque|back|less|none",
      diagnostics: [
        {
          code: "queuedMaterialPrepareRoute.missingAdapter",
          materialFamily: "toon-shaded",
          materialKind: "unlit",
          materialKey: "material:toon-shaded",
        },
      ],
    });
  });

  it("fails material assets that do not match the queued family", () => {
    const result = routeQueuedMaterialPrepare(
      createBuiltInMaterialQueueRouteAdapterRegistry(),
      {
        queueItem: queueItem("standard", "opaque"),
        material: createUnlitMaterialAsset(),
        sourceVersion: 1,
        frame: 2,
      },
    );

    expect(result).toMatchObject({
      valid: false,
      status: "failed",
      family: "standard",
      diagnostics: [
        {
          code: "queuedMaterialPrepareRoute.materialMismatch",
          materialFamily: "standard",
          materialKind: "unlit",
        },
      ],
    });
  });

  it("fails unsupported phases through the family route adapter", () => {
    const result = routeQueuedMaterialPrepare(
      createBuiltInMaterialQueueRouteAdapterRegistry(),
      {
        queueItem: queueItem("matcap", "shadow"),
        material: createMatcapMaterialAsset(),
        sourceVersion: 1,
        frame: 2,
      },
    );

    expect(result).toMatchObject({
      valid: false,
      status: "failed",
      family: "matcap",
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialQueuePhase",
          renderPhase: "shadow",
          materialFamily: "matcap",
        },
      ],
    });
  });

  it("fails unsupported transparent blend presets through the StandardMaterial route adapter", () => {
    const result = routeQueuedMaterialPrepare(
      createBuiltInMaterialQueueRouteAdapterRegistry(),
      {
        queueItem: queueItem(
          "standard",
          "transparent",
          "standard|blend|back|less|additive",
        ),
        material: createStandardMaterialAsset(),
        sourceVersion: 1,
        frame: 2,
      },
    );

    expect(result).toMatchObject({
      valid: false,
      status: "failed",
      family: "standard",
      diagnostics: [
        {
          code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
          renderPhase: "transparent",
          materialFamily: "standard",
          blendPreset: "additive",
        },
      ],
    });
  });
});

function queueItem(
  materialFamily: string,
  renderPhase: string,
  pipelineKey = `${materialFamily}|opaque|back|less|none`,
): MaterialQueueItem {
  return {
    renderId: 9,
    drawIndex: 2,
    entity: { index: 9, generation: 1 },
    renderPhase,
    materialFamily,
    pipelineKey,
    meshKey: "mesh:cube",
    materialKey: `material:${materialFamily}`,
    meshResourceKey: "gpu-mesh:mesh:cube",
    materialResourceKey: `gpu-material:material:${materialFamily}`,
    meshLayoutKey: "mesh-layout:position-normal-uv",
    topology: "triangle-list",
    depth: 1,
    sortKey: {
      renderPhase,
      viewId: 0,
      layer: 0,
      order: 0,
      pipelineKey,
      materialResourceKey: `gpu-material:material:${materialFamily}`,
      meshResourceKey: "gpu-mesh:mesh:cube",
      depth: 1,
      stableId: 9,
      drawIndex: 2,
    },
  } as MaterialQueueItem;
}
