import { describe, expect, it } from "vitest";
import {
  createDebugNormalMaterialAsset,
  createMatcapMaterialAsset,
  createStandardMaterialAsset,
  createUnlitMaterialAsset,
  type MaterialAsset,
  type MaterialQueueItem,
} from "@aperture-engine/render";
import {
  createBuiltInMaterialQueueRouteAdapterRegistry,
  queuedMaterialAdapterRegistryToJsonValue,
  type BuiltInMaterialQueueRouteAdapter,
} from "@aperture-engine/webgpu/test-support";

describe("built-in material queue route adapter factory", () => {
  it("registers route-only adapters for built-in material families", () => {
    const registry = createBuiltInMaterialQueueRouteAdapterRegistry();

    expect(registry.adapters.map((adapter) => adapter.kind)).toEqual([
      "unlit",
      "matcap",
      "standard",
      "debug-normal",
    ]);
    expect(registry.diagnostics).toEqual([]);
    expect(registry.get("unlit")?.kind).toBe("unlit");
    expect(registry.get("matcap")?.kind).toBe("matcap");
    expect(registry.get("standard")?.kind).toBe("standard");
    expect(registry.get("debug-normal")?.kind).toBe("debug-normal");
  });

  it("keeps material asset type guards scoped to each built-in family", () => {
    const registry = createBuiltInMaterialQueueRouteAdapterRegistry();
    const materials: readonly MaterialAsset[] = [
      createUnlitMaterialAsset(),
      createMatcapMaterialAsset(),
      createStandardMaterialAsset(),
      createDebugNormalMaterialAsset(),
    ];

    expect(
      materials.map((material) =>
        adapter(registry, "unlit").isMaterialAsset(material),
      ),
    ).toEqual([true, false, false, false]);
    expect(
      materials.map((material) =>
        adapter(registry, "matcap").isMaterialAsset(material),
      ),
    ).toEqual([false, true, false, false]);
    expect(
      materials.map((material) =>
        adapter(registry, "standard").isMaterialAsset(material),
      ),
    ).toEqual([false, false, true, false]);
    expect(
      materials.map((material) =>
        adapter(registry, "debug-normal").isMaterialAsset(material),
      ),
    ).toEqual([false, false, false, true]);
  });

  it("preserves duplicate-family diagnostics when factory input is duplicated", () => {
    const base = createBuiltInMaterialQueueRouteAdapterRegistry();
    const duplicate = adapter(base, "standard");
    const registry = createBuiltInMaterialQueueRouteAdapterRegistry([
      ...base.adapters,
      duplicate,
    ]);

    expect(registry.get("standard")).toBe(duplicate);
    expect(queuedMaterialAdapterRegistryToJsonValue(registry)).toEqual({
      adapterCount: 5,
      families: ["unlit", "matcap", "standard", "debug-normal", "standard"],
      diagnostics: [
        {
          code: "queuedMaterialAdapter.duplicateFamily",
          severity: "warning",
          family: "standard",
          firstIndex: 2,
          duplicateIndex: 4,
          message:
            "Material adapter family 'standard' is registered more than once; the first adapter at index 2 will be used.",
        },
      ],
    });
  });

  it("validates supported phases and blend presets through route adapters", () => {
    const registry = createBuiltInMaterialQueueRouteAdapterRegistry();

    expect(
      adapter(registry, "unlit").validateQueueItem(
        queueItem("unlit", "opaque"),
      ),
    ).toBeNull();
    expect(
      adapter(registry, "standard").validateQueueItem(
        queueItem("standard", "alpha-test"),
      ),
    ).toBeNull();
    expect(
      adapter(registry, "standard").validateQueueItem(
        queueItem("standard", "transparent", "standard|blend|back|less|alpha"),
      ),
    ).toBeNull();
    expect(
      adapter(registry, "matcap").validateQueueItem(
        queueItem("matcap", "transparent"),
      ),
    ).toMatchObject({
      code: "webGpuApp.unsupportedMaterialQueueTransparentFamily",
      renderPhase: "transparent",
      materialFamily: "matcap",
    });
    expect(
      adapter(registry, "standard").validateQueueItem(
        queueItem(
          "standard",
          "transparent",
          "standard|blend|back|less|additive",
        ),
      ),
    ).toMatchObject({
      code: "webGpuApp.unsupportedMaterialQueueBlendPreset",
      renderPhase: "transparent",
      materialFamily: "standard",
      blendPreset: "additive",
    });
  });
});

function adapter(
  registry: ReturnType<typeof createBuiltInMaterialQueueRouteAdapterRegistry>,
  kind: "unlit" | "matcap" | "standard" | "debug-normal",
): BuiltInMaterialQueueRouteAdapter {
  const routeAdapter = registry.get(kind);

  if (routeAdapter === null) {
    throw new Error(`Missing built-in route adapter '${kind}'.`);
  }

  return routeAdapter;
}

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
