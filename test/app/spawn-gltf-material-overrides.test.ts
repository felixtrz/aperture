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
import {
  MATERIAL_APPEARANCE_PRESETS,
  createMaterialAppearancePreset,
} from "../../packages/app/src/systems/spawn/material-presets.js";

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

  it("applies deterministic, inspectable named presets without mutating source", () => {
    const registry = new AssetRegistry();
    const source = createMaterialHandle("prop.source");
    const sourceAsset = createStandardMaterialAsset({
      baseColorFactor: new Float32Array([0.2, 0.4, 0.8, 1]),
      metallicFactor: 1,
      roughnessFactor: 0.2,
    });
    registry.register<"material", SourceMaterialAsset>(source);
    registry.markReady<"material", SourceMaterialAsset>(source, sourceAsset);
    const world = createWorld({ entityCapacity: 4 });
    world.registerComponent(Material);
    const first = world.createEntity();
    const second = world.createEntity();
    first.addComponent(Material, { materialId: assetHandleKey(source) });
    second.addComponent(Material, { materialId: assetHandleKey(source) });

    applyGltfMaterialOverrides({
      registry,
      diagnostics: noopDiagnostics(),
      scene: { assetId: "prop" } as SystemGltfLoadedScene,
      replay: {
        entitiesByKey: new Map([
          ["node:0:mesh:0:primitive:0", first],
          ["node:1:mesh:0:primitive:0", second],
        ]),
      } as unknown as GltfEcsCommandReplayReport,
      overrides: createMaterialAppearancePreset("painted-stylized", {
        roughnessFactor: 0.8,
      }),
    });

    const replacementKey = String(first.getValue(Material, "materialId"));
    expect(second.getValue(Material, "materialId")).toBe(replacementKey);
    const replacement = registry.get<"material", StandardMaterialAsset>(
      createMaterialHandle(replacementKey.replace(/^material:/u, "")),
    )?.asset;

    expect(MATERIAL_APPEARANCE_PRESETS["painted-stylized"]).toEqual({
      metallicFactor: 0.12,
      roughnessFactor: 0.72,
    });
    expect(replacement).toMatchObject({
      metallicFactor: 0.12,
      roughnessFactor: 0.8,
    });
    expect(Array.from(replacement?.baseColorFactor ?? [])).toEqual(
      Array.from(sourceAsset.baseColorFactor),
    );
    expect(registry.get(source)?.asset).toBe(sourceAsset);
    expect(sourceAsset.metallicFactor).toBe(1);
    expect(sourceAsset.roughnessFactor).toBe(0.2);
  });

  it("treats the source preset as an exact no-op", () => {
    const registry = new AssetRegistry();
    const source = createMaterialHandle("source-only");
    const sourceAsset = createStandardMaterialAsset({ metallicFactor: 0.7 });
    registry.register<"material", SourceMaterialAsset>(source);
    registry.markReady<"material", SourceMaterialAsset>(source, sourceAsset);
    const world = createWorld({ entityCapacity: 2 });
    world.registerComponent(Material);
    const entity = world.createEntity();
    entity.addComponent(Material, { materialId: assetHandleKey(source) });

    applyGltfMaterialOverrides({
      registry,
      diagnostics: noopDiagnostics(),
      scene: { assetId: "source-only" } as SystemGltfLoadedScene,
      replay: {
        entitiesByKey: new Map([["node:0:mesh:0:primitive:0", entity]]),
      } as unknown as GltfEcsCommandReplayReport,
      overrides: createMaterialAppearancePreset("source"),
    });

    expect(entity.getValue(Material, "materialId")).toBe(
      assetHandleKey(source),
    );
    expect(registry.get(source)?.asset).toBe(sourceAsset);
    expect(registry.list({ kind: "material" })).toHaveLength(1);
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
