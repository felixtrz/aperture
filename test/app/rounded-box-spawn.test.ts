import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createApertureSystemContext,
  material,
  mesh,
  type RoundedBoxMeshDescriptorOptions,
} from "@aperture-engine/app/systems";
import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
  createWorld,
} from "@aperture-engine/simulation";
import {
  Material,
  Mesh,
  type MeshAsset,
  type RoundedBoxMeshOptions,
} from "@aperture-engine/render";
import { createApertureEntityHierarchy } from "@aperture-engine/app/entity-lookup";

describe("rounded-box app authoring", () => {
  it("exposes the render options and diagnoses invalid values at descriptor creation", () => {
    expectTypeOf<RoundedBoxMeshDescriptorOptions>().toEqualTypeOf<RoundedBoxMeshOptions>();
    const descriptor = mesh.roundedBox({
      halfExtents: [2, 1, 0.5],
      radius: 0.2,
    });
    expect(descriptor.kind).toBe("rounded-box");
    expect(Object.isFrozen(descriptor)).toBe(true);
    for (const options of [
      { radius: -1 },
      { radius: 0.6 },
      { bevelSegments: 33 },
    ]) {
      expect(() => mesh.roundedBox(options)).toThrowError(
        expect.objectContaining({
          code: "aperture.spawn.invalidRoundedBoxMesh",
          suggestedFix: expect.stringContaining("halfExtents"),
          cause: expect.objectContaining({ name: "RoundedBoxMeshError" }),
        }),
      );
    }
  });

  it("publishes through ECS and reuses the actual ready mesh/material handles", () => {
    const world = createWorld();
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world,
      assetsRegistry: registry,
    });
    const first = context.spawn.mesh({
      key: "rounded.part",
      mesh: mesh.roundedBox({ halfExtents: [1, 0.5, 0.25], radius: 0.1 }),
      material: material.standard({ baseColor: "#808080" }),
      castShadow: true,
    });
    const geometry = createMeshHandle("rounded.part.mesh");
    const surface = createMaterialHandle("rounded.part.material");
    const entry = registry.get<"mesh", MeshAsset>(geometry)!;
    expect(entry.status).toBe("ready");
    expect(entry.asset!.vertexStreams[0]!.vertexCount).toBe(384);
    const markReady = vi.spyOn(registry, "markReady");
    try {
      const second = context.spawn.mesh({
        key: "rounded.reuse",
        mesh: geometry,
        material: surface,
        transform: { translation: [2, 0, 0] },
      });
      expect(second.getValue(Mesh, "meshId")).toBe(
        first.getValue(Mesh, "meshId"),
      );
      expect(second.getValue(Material, "materialId")).toBe(
        first.getValue(Material, "materialId"),
      );
      expect(registry.get(geometry)).toBe(entry);
      expect(markReady).not.toHaveBeenCalled();
      expect(createApertureEntityHierarchy(world).total).toBe(2);
    } finally {
      markReady.mockRestore();
    }
  });

  it("rejects unrepresentable geometry before publishing assets or an entity, then permits retry", () => {
    const world = createWorld();
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world,
      assetsRegistry: registry,
    });
    expect(() =>
      context.spawn.mesh({
        key: "rounded.retry",
        mesh: mesh.roundedBox({
          halfExtents: [100_000_000, 100_000_000, 100_000_000],
          radius: 0.1,
        }),
        material: material.standard(),
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "aperture.spawn.invalidRoundedBoxMesh",
        detail: { path: "halfExtents/radius/bevelSegments" },
      }),
    );
    expect(registry.has(createMeshHandle("rounded.retry.mesh"))).toBe(false);
    expect(registry.has(createMaterialHandle("rounded.retry.material"))).toBe(
      false,
    );
    expect(createApertureEntityHierarchy(world).total).toBe(0);
    expect(
      context.spawn.mesh({
        key: "rounded.retry",
        mesh: mesh.roundedBox(),
        material: material.standard(),
      }).active,
    ).toBe(true);
  });
});
