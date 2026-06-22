import { describe, expect, it } from "vitest";
import {
  AssetRegistry,
  assetHandleKey,
  createMaterialHandle,
  createWorld,
} from "@aperture-engine/simulation";
import {
  Material,
  createStandardMaterialAsset,
  type GltfEcsCommandReplayReport,
  type SourceMaterialAsset,
  type StandardMaterialAsset,
} from "@aperture-engine/render";
import type { SystemGltfLoadedScene } from "../../packages/app/src/systems/assets.js";
import type { SystemDiagnostics } from "../../packages/app/src/systems/diagnostics.js";
import { applyGltfMaterialOverrides } from "../../packages/app/src/systems/spawn/gltf.js";

describe("spawn.gltf material overrides", () => {
  it("clones imported materials with uniform and render-state patches", () => {
    const registry = new AssetRegistry();
    const source = createMaterialHandle("building.source");
    registry.register<"material", SourceMaterialAsset>(source);
    registry.markReady<"material", SourceMaterialAsset>(
      source,
      createStandardMaterialAsset({
        baseColorFactor: new Float32Array([1, 1, 1, 1]),
        roughnessFactor: 0.25,
      }),
    );

    const world = createWorld({ entityCapacity: 4 });
    world.registerComponent(Material);
    const meshEntity = world.createEntity();
    meshEntity.addComponent(Material, { materialId: assetHandleKey(source) });

    applyGltfMaterialOverrides({
      registry,
      diagnostics: noopDiagnostics(),
      scene: { assetId: "building" } as SystemGltfLoadedScene,
      replay: {
        entitiesByKey: new Map([["node:0:mesh:0:primitive:0", meshEntity]]),
      } as unknown as GltfEcsCommandReplayReport,
      overrides: {
        baseColorFactor: [0.25, 0.9, 1, 0.38],
        roughnessFactor: 0.85,
        renderState: {
          alphaMode: "blend",
          depth: { test: true, write: false, compare: "less" },
          blend: { preset: "alpha" },
        },
      },
    });

    const replacementKey = meshEntity.getValue(Material, "materialId");
    expect(replacementKey).not.toBe(assetHandleKey(source));
    expect(typeof replacementKey).toBe("string");

    const replacement = registry.get<"material", SourceMaterialAsset>(
      createMaterialHandle(String(replacementKey).replace(/^material:/u, "")),
    )?.asset as StandardMaterialAsset | null | undefined;

    expect(replacement?.kind).toBe("standard");
    expect(Array.from(replacement?.baseColorFactor ?? [])).toHaveLength(4);
    expect(replacement?.baseColorFactor[0]).toBeCloseTo(0.25);
    expect(replacement?.baseColorFactor[1]).toBeCloseTo(0.9);
    expect(replacement?.baseColorFactor[2]).toBeCloseTo(1);
    expect(replacement?.baseColorFactor[3]).toBeCloseTo(0.38);
    expect(replacement?.roughnessFactor).toBe(0.85);
    expect(replacement?.renderState.alphaMode).toBe("blend");
    expect(replacement?.renderState.depth.write).toBe(false);
    expect(replacement?.renderState.blend.preset).toBe("alpha");

    const original = registry.get<"material", SourceMaterialAsset>(source)
      ?.asset as StandardMaterialAsset | null | undefined;
    expect(Array.from(original?.baseColorFactor ?? [])).toEqual([1, 1, 1, 1]);
    expect(original?.roughnessFactor).toBe(0.25);
    expect(original?.renderState.alphaMode).toBe("opaque");
  });
});

function noopDiagnostics(): SystemDiagnostics {
  return {
    info() {},
    warn() {},
    error() {},
    list() {
      return [];
    },
  };
}
