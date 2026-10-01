import { describe, expect, it } from "vitest";
import {
  createApertureSystemContext,
  material,
  mesh,
} from "@aperture-engine/app/systems";
import {
  AssetRegistry,
  createWorld,
  createMeshHandle,
  createMaterialHandle,
} from "@aperture-engine/simulation";
import {
  Mesh,
  Material,
  type MeshAsset,
  type SourceMaterialAsset,
  createBoxMeshAsset,
  createStandardMaterialAsset,
} from "@aperture-engine/render";

describe("anonymous spawn asset ownership", () => {
  it("keeps differently sized anonymous primitives and materials independent", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });
    const first = context.spawn.mesh({
      mesh: mesh.box({ size: 1 }),
      material: material.standard({ baseColor: [1, 0, 0, 1] }),
    });
    const firstMesh = first.getValue(Mesh, "meshId");
    const firstMaterial = first.getValue(Material, "materialId");
    if (firstMesh === null || firstMaterial === null)
      throw new Error("Spawn must attach ready asset IDs");
    const second = context.spawn.mesh({
      mesh: mesh.box({ size: 4 }),
      material: material.standard({ baseColor: [0, 0, 1, 1] }),
    });
    expect(second.getValue(Mesh, "meshId")).not.toBe(firstMesh);
    expect(second.getValue(Material, "materialId")).not.toBe(firstMaterial);
    const meshEntry = registry.get<"mesh", MeshAsset>(
      createMeshHandle(firstMesh.slice("mesh:".length)),
    );
    const materialEntry = registry.get<"material", SourceMaterialAsset>(
      createMaterialHandle(firstMaterial.slice("material:".length)),
    );
    expect(meshEntry?.asset?.localAabb).toEqual({
      min: [-0.5, -0.5, -0.5],
      max: [0.5, 0.5, 0.5],
    });
    expect(materialEntry?.asset).toMatchObject({
      baseColorFactor: new Float32Array([1, 0, 0, 1]),
    });
  });

  it("preserves explicit key/name asset IDs", () => {
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: new AssetRegistry(),
    });
    for (const metadata of [
      { key: "piece", name: "label" },
      { name: "named" },
    ]) {
      const entity = context.spawn.mesh({
        ...metadata,
        mesh: mesh.box(),
        material: material.standard(),
      });
      const id = metadata.key ?? metadata.name;
      expect(entity.getValue(Mesh, "meshId")).toBe(`mesh:${id}.mesh`);
      expect(entity.getValue(Material, "materialId")).toBe(
        `material:${id}.material`,
      );
    }
  });

  it("retains intentional sharing through explicit handles without republishing", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });
    const geometry = createMeshHandle("shared.geometry");
    const appearance = createMaterialHandle("shared.appearance");
    registry.register(geometry);
    registry.markReady(geometry, createBoxMeshAsset());
    registry.register(appearance);
    registry.markReady(appearance, createStandardMaterialAsset());
    for (let i = 0; i < 3; i++) {
      const entity = context.spawn.mesh({
        mesh: geometry,
        material: appearance,
      });
      expect(entity.getValue(Mesh, "meshId")).toBe("mesh:shared.geometry");
      expect(entity.getValue(Material, "materialId")).toBe(
        "material:shared.appearance",
      );
    }
    expect(registry.get(geometry)?.version).toBe(1);
    expect(registry.get(appearance)?.version).toBe(1);
    expect(registry.createManifestReport().total).toBe(2);
  });

  it.each(["mesh", "material"] as const)(
    "shares only the supplied %s handle when paired with an anonymous descriptor",
    (sharedKind) => {
      const registry = new AssetRegistry();
      const context = createApertureSystemContext({
        world: createWorld(),
        assetsRegistry: registry,
      });
      const geometry = createMeshHandle("shared.geometry");
      const appearance = createMaterialHandle("shared.appearance");
      const sharedHandle = sharedKind === "mesh" ? geometry : appearance;
      const sharedAsset =
        sharedKind === "mesh"
          ? createBoxMeshAsset()
          : createStandardMaterialAsset();
      registry.register(sharedHandle);
      registry.markReady(sharedHandle, sharedAsset);

      const first = context.spawn.mesh({
        mesh: sharedKind === "mesh" ? geometry : mesh.box({ size: 1 }),
        material:
          sharedKind === "material"
            ? appearance
            : material.standard({ baseColor: [1, 0, 0, 1] }),
      });
      const second = context.spawn.mesh({
        mesh: sharedKind === "mesh" ? geometry : mesh.box({ size: 4 }),
        material:
          sharedKind === "material"
            ? appearance
            : material.standard({ baseColor: [0, 0, 1, 1] }),
      });

      if (sharedKind === "mesh") {
        expect(first.getValue(Mesh, "meshId")).toBe("mesh:shared.geometry");
        expect(second.getValue(Mesh, "meshId")).toBe("mesh:shared.geometry");
        const firstMaterialId = first.getValue(Material, "materialId");
        if (firstMaterialId === null)
          throw new Error("Spawn must attach a material asset ID");
        expect(second.getValue(Material, "materialId")).not.toBe(
          firstMaterialId,
        );
        expect(
          registry.get<"material", SourceMaterialAsset>(
            createMaterialHandle(firstMaterialId.slice("material:".length)),
          )?.asset,
        ).toMatchObject({
          baseColorFactor: new Float32Array([1, 0, 0, 1]),
        });
      } else {
        expect(first.getValue(Material, "materialId")).toBe(
          "material:shared.appearance",
        );
        expect(second.getValue(Material, "materialId")).toBe(
          "material:shared.appearance",
        );
        const firstMeshId = first.getValue(Mesh, "meshId");
        if (firstMeshId === null)
          throw new Error("Spawn must attach a mesh asset ID");
        expect(second.getValue(Mesh, "meshId")).not.toBe(firstMeshId);
        expect(
          registry.get<"mesh", MeshAsset>(
            createMeshHandle(firstMeshId.slice("mesh:".length)),
          )?.asset?.localAabb?.max[0],
        ).toBe(0.5);
      }
      expect(registry.get(sharedHandle)?.version).toBe(1);
      expect(registry.get(sharedHandle)?.asset).toBe(sharedAsset);
      expect(registry.createManifestReport().total).toBe(3);
    },
  );

  it("keeps asset IDs deterministic across identical fresh worlds", () => {
    const record = () => {
      const context = createApertureSystemContext({
        world: createWorld(),
        assetsRegistry: new AssetRegistry(),
      });
      return Array.from({ length: 3 }, () => {
        const entity = context.spawn.mesh({
          mesh: mesh.box(),
          material: material.standard(),
        });
        return [
          entity.getValue(Mesh, "meshId"),
          entity.getValue(Material, "materialId"),
        ];
      });
    };
    expect(record()).toEqual(record());
  });

  it("does not replace old assets after a destroyed entity slot is reused", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });
    const first = context.spawn.mesh({
      mesh: mesh.box({ size: 1 }),
      material: material.standard(),
    });
    const originalId = first.getValue(Mesh, "meshId");
    if (originalId === null)
      throw new Error("Spawn must attach a mesh asset ID");
    first.destroy();
    const second = context.spawn.mesh({
      mesh: mesh.box({ size: 3 }),
      material: material.standard(),
    });
    expect(second.getValue(Mesh, "meshId")).not.toBe(originalId);
    expect(
      registry.get<"mesh", MeshAsset>(createMeshHandle(originalId.slice(5)))
        ?.asset?.localAabb?.max[0],
    ).toBe(0.5);
  });

  it("preserves anonymous assets when a reused slot's 8-bit generation wraps", () => {
    const registry = new AssetRegistry();
    const context = createApertureSystemContext({
      world: createWorld(),
      assetsRegistry: registry,
    });
    let entity = context.spawn.mesh({
      mesh: mesh.box({ size: 1 }),
      material: material.standard({ baseColor: [1, 0, 0, 1] }),
    });
    const originalIndex = entity.index;
    const originalGeneration = entity.generation;
    const originalMeshId = entity.getValue(Mesh, "meshId");
    const originalMaterialId = entity.getValue(Material, "materialId");
    if (originalMeshId === null || originalMaterialId === null)
      throw new Error("Spawn must attach ready asset IDs");
    const meshIds = new Set([originalMeshId]);
    const materialIds = new Set([originalMaterialId]);

    for (let i = 0; i < 256; i++) {
      entity.destroy();
      entity = context.spawn.mesh({
        mesh: mesh.box({ size: 4 }),
        material: material.standard({ baseColor: [0, 0, 1, 1] }),
      });
      expect(entity.index).toBe(originalIndex);
      const meshId = entity.getValue(Mesh, "meshId");
      const materialId = entity.getValue(Material, "materialId");
      if (meshId === null || materialId === null)
        throw new Error("Spawn must attach ready asset IDs");
      meshIds.add(meshId);
      materialIds.add(materialId);
    }

    expect(entity.generation).toBe(originalGeneration);
    const prefix = `aperture.spawn.mesh.${originalIndex}.${originalGeneration}`;
    expect(entity.getValue(Mesh, "meshId")).toBe(`mesh:${prefix}.1.mesh`);
    expect(entity.getValue(Material, "materialId")).toBe(
      `material:${prefix}.1.material`,
    );
    expect(meshIds.size).toBe(257);
    expect(materialIds.size).toBe(257);
    expect(
      registry.get<"mesh", MeshAsset>(
        createMeshHandle(originalMeshId.slice("mesh:".length)),
      )?.asset?.localAabb?.max[0],
    ).toBe(0.5);
    expect(
      registry.get<"material", SourceMaterialAsset>(
        createMaterialHandle(originalMaterialId.slice("material:".length)),
      )?.asset,
    ).toMatchObject({
      baseColorFactor: new Float32Array([1, 0, 0, 1]),
    });
  });

  it("avoids collisions when separate worlds share an asset registry", () => {
    const registry = new AssetRegistry();
    const spawn = (size: number) =>
      createApertureSystemContext({
        world: createWorld(),
        assetsRegistry: registry,
      }).spawn.mesh({
        mesh: mesh.box({ size }),
        material: material.standard(),
      });
    const first = spawn(1);
    const firstMeshId = first.getValue(Mesh, "meshId");
    const firstMaterialId = first.getValue(Material, "materialId");
    const second = spawn(2);
    expect(second.index).toBe(first.index);
    expect(second.getValue(Mesh, "meshId")).not.toBe(firstMeshId);
    expect(second.getValue(Material, "materialId")).not.toBe(firstMaterialId);
  });

  it.each(["mesh", "material"] as const)(
    "preserves a preexisting %s-only fallback collision",
    (kind) => {
      const world = createWorld();
      const registry = new AssetRegistry();
      const probe = world.createEntity();
      const nextIndex = probe.index + 1;
      const prefix = `aperture.spawn.mesh.${nextIndex}.0`;
      const occupied =
        kind === "mesh"
          ? createMeshHandle(`${prefix}.mesh`)
          : createMaterialHandle(`${prefix}.material`);
      registry.register(occupied);
      const context = createApertureSystemContext({
        world,
        assetsRegistry: registry,
      });
      const entity = context.spawn.mesh({
        mesh: mesh.box(),
        material: material.standard(),
      });
      expect(entity.index).toBe(nextIndex);
      expect(entity.getValue(Mesh, "meshId")).toBe(`mesh:${prefix}.1.mesh`);
      expect(entity.getValue(Material, "materialId")).toBe(
        `material:${prefix}.1.material`,
      );
      expect(registry.get(occupied)?.status).not.toBe("ready");
    },
  );

  it("skips multiple occupied suffixes without changing their entries", () => {
    const registry = new AssetRegistry();
    const world = createWorld();
    const probe = world.createEntity();
    const nextIndex = probe.index + 1;
    const prefix = `aperture.spawn.mesh.${nextIndex}.0`;
    const occupied = Array.from({ length: 5 }, (_, suffix) => {
      const id = suffix === 0 ? prefix : `${prefix}.${suffix}`;
      const handle =
        suffix % 2 === 0
          ? createMeshHandle(`${id}.mesh`)
          : createMaterialHandle(`${id}.material`);
      registry.register(handle);
      return handle;
    });
    const context = createApertureSystemContext({
      world,
      assetsRegistry: registry,
    });
    const entity = context.spawn.mesh({
      mesh: mesh.box(),
      material: material.standard(),
    });

    expect(entity.index).toBe(nextIndex);
    expect(entity.getValue(Mesh, "meshId")).toBe(`mesh:${prefix}.5.mesh`);
    expect(entity.getValue(Material, "materialId")).toBe(
      `material:${prefix}.5.material`,
    );
    for (const handle of occupied) {
      expect(registry.get(handle)).toMatchObject({
        status: "registered",
        version: 0,
        asset: null,
      });
    }
    expect(registry.createManifestReport().total).toBe(7);
  });
});
