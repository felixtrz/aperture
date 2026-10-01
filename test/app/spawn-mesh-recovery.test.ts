import { describe, expect, it } from "vitest";
import {
  AppEntityKey,
  createApertureSystemContext,
  material,
  mesh,
  type SpawnMeshOptions,
} from "@aperture-engine/app/systems";
import { createApertureEntityHierarchy } from "@aperture-engine/app/entity-lookup";
import {
  AssetRegistry,
  createMaterialHandle,
  createMeshHandle,
  createTextureHandle,
  createWorld,
} from "@aperture-engine/simulation";
import {
  Material,
  Mesh,
  createBoxMeshAsset,
  createStandardMaterialAsset,
  type MeshAsset,
} from "@aperture-engine/render";

const valid = (): SpawnMeshOptions => ({
  key: "retry",
  mesh: mesh.box({ size: 4 }),
  material: material.standard(),
});

const invalidInputs: readonly {
  readonly name: string;
  readonly input: SpawnMeshOptions;
  readonly error: RegExp;
}[] = [
  {
    name: "noniterable metadata tags",
    input: { ...valid(), tags: {} as never },
    error: /iterable/,
  },
  {
    name: "short box size",
    input: { ...valid(), mesh: mesh.box({ size: [1] as never }) },
    error: /Expected numeric value at index 1/,
  },
  {
    name: "unpaired line-list positions",
    input: { ...valid(), mesh: mesh.lineList({ positions: [[0, 0, 0]] }) },
    error: /even number of entries/,
  },
  {
    name: "malformed triangle-list",
    input: {
      ...valid(),
      mesh: mesh.triangleList({
        positions: [
          [0, 0, 0],
          [1, 0, 0],
        ],
      }),
    },
    error: /triangle/i,
  },
  {
    name: "short material color",
    input: {
      ...valid(),
      material: material.unlit({ baseColor: [1] as never }),
    },
    error: /Expected numeric value at index 1/,
  },
  {
    name: "short transform rotation",
    input: {
      ...valid(),
      transform: { rotationEulerDegrees: [0] as never },
    },
    error: /Expected numeric value at index 1/,
  },
  {
    name: "short physics velocity",
    input: {
      ...valid(),
      physics: { rigidBody: true, velocity: { linear: [0] as never } },
    },
    error: /Expected numeric value at index 1/,
  },
];

function setup() {
  const world = createWorld();
  const registry = new AssetRegistry();
  const context = createApertureSystemContext({
    world,
    assetsRegistry: registry,
  });
  return { world, registry, context };
}

function seedRegistry(registry: AssetRegistry): void {
  const texture = createTextureHandle("preserved.texture");
  registry.register(texture, { label: "Unready dependency" });
  const geometry = createMeshHandle("retry.mesh");
  registry.register(geometry, { label: "Existing geometry" });
  registry.markReady(geometry, createBoxMeshAsset({ width: 2 }));
  registry.markReady(geometry, createBoxMeshAsset());
  const appearance = createMaterialHandle("retry.material");
  registry.register(appearance, {
    label: "Existing appearance",
    dependencies: [texture],
  });
  registry.markReady(
    appearance,
    createStandardMaterialAsset(),
    [
      {
        code: "existing",
        message: "Keep this diagnostic",
        severity: "warning",
      },
    ],
    "placeholder",
  );
}

describe("failed mesh spawn recovery", () => {
  describe.each([false, true])("with existing assets = %s", (seeded) => {
    it.each(invalidInputs)(
      "leaves no entity or asset changes for $name and accepts the corrected key",
      ({ input, error }) => {
        const { world, registry, context } = setup();
        const previous = context.spawn.group({ key: "keep" });
        if (seeded) seedRegistry(registry);
        const entries = registry.list();
        const manifest = registry.createManifestReport();

        expect(() => context.spawn.mesh(input)).toThrow(error);
        expect(createApertureEntityHierarchy(world).total).toBe(1);
        expect(previous.active).toBe(true);
        expect(registry.list()).toEqual(entries);
        for (const entry of entries)
          expect(registry.get(entry.handle)).toBe(entry);
        expect(registry.createManifestReport()).toEqual(manifest);

        const retried = context.spawn.mesh(valid());
        expect(retried.active).toBe(true);
        expect(retried.getValue(AppEntityKey, "value")).toBe("retry");
        expect(retried.getValue(Mesh, "meshId")).toBe("mesh:retry.mesh");
        expect(retried.getValue(Material, "materialId")).toBe(
          "material:retry.material",
        );
        expect(createApertureEntityHierarchy(world).total).toBe(2);
        expect(registry.list()).toHaveLength(seeded ? 3 : 2);
      },
    );
  });

  it.each([false, true])(
    "has ready, current assets when mesh/material queries qualify (existing assets = %s)",
    (seeded) => {
      const { world, registry, context } = setup();
      if (seeded) seedRegistry(registry);
      const observed: unknown[] = [];
      const unsubscribe = world.queryManager
        .registerQuery({ required: [Mesh, Material] })
        .subscribe("qualify", (entity) => {
          observed.push({
            meshId: entity.getValue(Mesh, "meshId"),
            materialId: entity.getValue(Material, "materialId"),
            mesh: registry.get<"mesh", MeshAsset>(
              createMeshHandle("retry.mesh"),
            ),
            material: registry.get(createMaterialHandle("retry.material")),
          });
        });
      try {
        context.spawn.mesh(valid());
        expect(observed).toEqual([
          {
            meshId: "mesh:retry.mesh",
            materialId: "material:retry.material",
            mesh: expect.objectContaining({
              status: "ready",
              version: seeded ? 3 : 1,
              asset: expect.objectContaining({
                localAabb: { min: [-2, -2, -2], max: [2, 2, 2] },
              }),
            }),
            material: expect.objectContaining({
              status: "ready",
              version: seeded ? 2 : 1,
            }),
          },
        ]);
      } finally {
        unsubscribe();
      }
    },
  );

  it("rejects duplicate keys without leaking entities or replacing existing assets", () => {
    const { world, registry, context } = setup();
    const original = context.spawn.mesh(valid());
    const entries = registry.list();
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(() => context.spawn.mesh(valid())).toThrow(
        expect.objectContaining({ code: "aperture.entityKey.duplicate" }),
      );
      expect(createApertureEntityHierarchy(world).total).toBe(1);
      expect(registry.list()).toEqual(entries);
    }
    expect(original.active).toBe(true);
    original.destroy();
    const replacement = context.spawn.mesh(valid());
    expect(replacement.getValue(AppEntityKey, "value")).toBe("retry");
    expect(createApertureEntityHierarchy(world).total).toBe(1);
  });

  it("preserves a live named mesh when material conversion fails, then retains named replacement behavior", () => {
    const { world, registry, context } = setup();
    const named: SpawnMeshOptions = {
      name: "shared-name",
      mesh: mesh.box(),
      material: material.standard(),
    };
    const original = context.spawn.mesh(named);
    const entries = registry.list();
    expect(() =>
      context.spawn.mesh({
        ...named,
        mesh: mesh.box({ size: 4 }),
        material: material.unlit({ baseColor: [] as never }),
      }),
    ).toThrow(RangeError);
    expect(createApertureEntityHierarchy(world).total).toBe(1);
    expect(registry.list()).toEqual(entries);
    const replacement = context.spawn.mesh({
      ...named,
      mesh: mesh.box({ size: 4 }),
    });
    expect(replacement.getValue(Mesh, "meshId")).toBe(
      original.getValue(Mesh, "meshId"),
    );
    expect(registry.get(createMeshHandle("shared-name.mesh"))?.version).toBe(2);
    expect(
      registry.get(createMaterialHandle("shared-name.material"))?.version,
    ).toBe(2);
  });

  it("keeps prior anonymous assets intact after material failure and a corrected spawn", () => {
    const { world, registry, context } = setup();
    const original = context.spawn.mesh({
      mesh: mesh.box(),
      material: material.standard(),
    });
    const entries = registry.list();
    expect(() =>
      context.spawn.mesh({
        mesh: mesh.box({ size: 4 }),
        material: material.unlit({ baseColor: [] as never }),
      }),
    ).toThrow(RangeError);
    expect(registry.list()).toEqual(entries);
    expect(createApertureEntityHierarchy(world).total).toBe(1);
    const corrected = context.spawn.mesh({
      mesh: mesh.box({ size: 4 }),
      material: material.standard(),
    });
    expect(corrected.getValue(Mesh, "meshId")).not.toBe(
      original.getValue(Mesh, "meshId"),
    );
    expect(registry.list()).toHaveLength(4);
    for (const entry of entries) expect(registry.get(entry.handle)).toBe(entry);
  });
});
