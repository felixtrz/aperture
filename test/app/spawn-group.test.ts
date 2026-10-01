import path from "node:path";
import { describe, expect, it } from "vitest";
import { createApertureApp, defineApertureConfig } from "@aperture-engine/app";
import { asset } from "@aperture-engine/app/config";
import { createApertureSessionSnapshot } from "@aperture-engine/app/headless";
import {
  createApertureEntityHierarchy,
  getApertureEntitySummary,
} from "@aperture-engine/app/entity-lookup";
import {
  AppEntityKey,
  AppEntityTags,
  createSystem,
  material,
  mesh,
  type SpawnGroupOptions,
} from "@aperture-engine/app/systems";
import { Camera, Light, Material, Mesh } from "@aperture-engine/render";
import {
  Enabled,
  LocalTransform,
  Name,
  Parent,
  WorldTransform,
  createRootTransform,
  resolveWorldTransforms,
  type Entity,
} from "@aperture-engine/simulation";
import { createHeadlessSessionController } from "../../packages/cli/src/headless/session-controller.js";

async function emptyApp() {
  return createApertureApp({
    config: defineApertureConfig({
      mode: "headless",
      render: {
        defaultCamera: false,
        defaultLight: false,
        defaultEnvironment: false,
      },
    }),
    systems: [],
  });
}
function ref(entity: Entity) {
  return { index: entity.index, generation: entity.generation };
}
function translation(entity: Entity): number[] {
  return [...entity.getVectorView(WorldTransform, "col3")].slice(0, 3);
}
function activeCount(app: Awaited<ReturnType<typeof emptyApp>>): number {
  return createApertureEntityHierarchy(app.lowLevel.world).total;
}

// The previous public low-level construction recipe, retained as a structural
// baseline. The new helper must produce the same ordinary ECS state.
function manualGroup(
  app: Awaited<ReturnType<typeof emptyApp>>,
  options: SpawnGroupOptions,
): Entity {
  const entity = app.lowLevel.world.createEntity();
  const transform = createRootTransform(options.transform);
  entity.addComponent(Enabled, { value: true });
  entity.addComponent(Name, { value: options.name ?? "group" });
  if (options.key !== undefined)
    entity.addComponent(AppEntityKey, { value: options.key });
  if (options.tags !== undefined)
    entity.addComponent(AppEntityTags, {
      valuesJson: JSON.stringify(options.tags),
    });
  entity.addComponent(LocalTransform, transform.local);
  entity.addComponent(Parent, { entity: options.transform?.parent ?? null });
  entity.addComponent(WorldTransform, transform.world);
  return entity;
}

describe("spawn.group", () => {
  it("creates a metadata/transform-only entity without allocating render assets", async () => {
    const app = await emptyApp();
    try {
      const assetsBefore = app.lowLevel.assets.createManifestReport();
      const group = app.context.spawn.group();
      expect(group.active).toBe(true);
      expect(group.getValue(Name, "value")).toBe("group");
      expect(group.getValue(Enabled, "value")).toBe(true);
      expect(group.getValue(Parent, "entity")).toBeNull();
      expect([...group.getVectorView(LocalTransform, "translation")]).toEqual([
        0, 0, 0,
      ]);
      expect([...group.getVectorView(LocalTransform, "rotation")]).toEqual([
        0, 0, 0, 1,
      ]);
      expect([...group.getVectorView(LocalTransform, "scale")]).toEqual([
        1, 1, 1,
      ]);
      for (const component of [Camera, Light, Mesh, Material])
        expect(group.hasComponent(component)).toBe(false);
      expect(app.lowLevel.assets.createManifestReport()).toEqual(assetsBefore);
      expect(app.extract().meshDraws).toHaveLength(0);
      expect(app.extract().views).toHaveLength(0);
    } finally {
      await app.dispose();
    }
  });

  it("matches the previous explicit ECS recipe for a keyed, tagged transformed root", async () => {
    const before = await emptyApp();
    const after = await emptyApp();
    try {
      const options: SpawnGroupOptions = {
        name: "Assembly",
        key: "assembly",
        tags: ["procedural", "editable"],
        transform: {
          translation: [4, 2, -3],
          rotation: [0, Math.sin(Math.PI / 8), 0, Math.cos(Math.PI / 8)],
          scale: [-2, 3, 0.5],
        },
      };
      const manual = manualGroup(before, options);
      const group = after.context.spawn.group(options);
      resolveWorldTransforms(before.lowLevel.world);
      resolveWorldTransforms(after.lowLevel.world);
      expect(
        getApertureEntitySummary(after.lowLevel.world, ref(group)),
      ).toEqual(getApertureEntitySummary(before.lowLevel.world, ref(manual)));
      expect(
        group
          .getComponents()
          .map((component) => component.id)
          .sort(),
      ).toEqual(
        manual
          .getComponents()
          .map((component) => component.id)
          .sort(),
      );
    } finally {
      await before.dispose();
      await after.dispose();
    }
  });

  it("composes nested local transforms and exposes hierarchy from authoritative Parent relationships", async () => {
    const app = await emptyApp();
    try {
      const root = app.context.spawn.group({
        key: "assembly",
        tags: ["assembly"],
        transform: {
          translation: [10, 0, 0],
          rotationEulerDegrees: [0, 90, 0],
          scale: [2, 2, 2],
        },
      });
      const branch = app.context.spawn.group({
        key: "assembly.branch",
        transform: { parent: root, translation: [1, 0, 0] },
      });
      const child = app.context.spawn.mesh({
        key: "assembly.part",
        mesh: mesh.box({ size: 1 }),
        material: material.standard(),
        transform: { parent: branch, translation: [0, 0, 2] },
      });
      resolveWorldTransforms(app.lowLevel.world);
      expect(translation(branch)[0]).toBeCloseTo(10, 5);
      expect(translation(branch)[2]).toBeCloseTo(-2, 5);
      expect(translation(child)[0]).toBeCloseTo(14, 5);
      expect(translation(child)[2]).toBeCloseTo(-2, 5);
      expect([...child.getVectorView(LocalTransform, "translation")]).toEqual([
        0, 0, 2,
      ]);
      expect(child.getValue(Parent, "entity")).toBe(branch);
      expect(child.hasComponent(AppEntityTags)).toBe(false);
      expect(createApertureEntityHierarchy(app.lowLevel.world)).toMatchObject({
        roots: [
          {
            key: "assembly",
            children: [
              { key: "assembly.branch", children: [{ key: "assembly.part" }] },
            ],
          },
        ],
        total: 3,
      });
    } finally {
      await app.dispose();
    }
  });

  it("revises one assembly without changing its sibling or duplicating assets/entities", async () => {
    const app = await emptyApp();
    try {
      const a = app.context.spawn.group({
        key: "a",
        transform: { translation: [-3, 0, 0] },
      });
      const b = app.context.spawn.group({
        key: "b",
        transform: { translation: [3, 0, 0] },
      });
      const parts = [a, b].map((parent, index) =>
        app.context.spawn.mesh({
          key: `part.${index}`,
          mesh: mesh.box({ size: 1 }),
          material: material.standard(),
          transform: { parent, translation: [0, 1, 0] },
        }),
      );
      resolveWorldTransforms(app.lowLevel.world);
      const bBefore = getApertureEntitySummary(
        app.lowLevel.world,
        ref(parts[1]!),
      );
      const countBefore = activeCount(app);
      const assetsBefore = app.lowLevel.assets.createManifestReport();
      a.getVectorView(LocalTransform, "translation").set([-6, 2, 1]);
      a.getVectorView(LocalTransform, "scale").set([2, 2, 2]);
      resolveWorldTransforms(app.lowLevel.world);
      expect(translation(parts[0]!)).toEqual([-6, 4, 1]);
      expect(
        getApertureEntitySummary(app.lowLevel.world, ref(parts[1]!)),
      ).toEqual(bBefore);
      expect(activeCount(app)).toBe(countBefore);
      expect(app.lowLevel.assets.createManifestReport()).toEqual(assetsBefore);
    } finally {
      await app.dispose();
    }
  });

  it("distinguishes local spawn parenting from world-preserving reparenting", async () => {
    const app = await emptyApp();
    try {
      const left = app.context.spawn.group({
        key: "left",
        transform: { translation: [5, 0, 0] },
      });
      const right = app.context.spawn.group({
        key: "right",
        transform: { translation: [-5, 0, 0] },
      });
      const child = app.context.spawn.group({
        key: "child",
        transform: { parent: left, translation: [1, 0, 0] },
      });
      resolveWorldTransforms(app.lowLevel.world);
      expect(translation(child)).toEqual([6, 0, 0]);
      expect(app.context.hierarchy.setParent(ref(child), ref(right)).ok).toBe(
        true,
      );
      resolveWorldTransforms(app.lowLevel.world);
      expect(translation(child)).toEqual([6, 0, 0]);
      expect([...child.getVectorView(LocalTransform, "translation")]).toEqual([
        11, 0, 0,
      ]);
      expect(child.getValue(Parent, "entity")).toBe(right);
    } finally {
      await app.dispose();
    }
  });

  it("recursively despawns only the selected group subtree", async () => {
    const app = await emptyApp();
    try {
      const root = app.context.spawn.group({ key: "assembly" });
      const child = app.context.spawn.group({
        key: "branch",
        transform: { parent: root },
      });
      const part = app.context.spawn.mesh({
        mesh: mesh.box({ size: 1 }),
        material: material.standard(),
        transform: { parent: child },
      });
      const sibling = app.context.spawn.group({ key: "other" });
      expect(app.context.hierarchy.despawnRecursive(ref(root))).toMatchObject({
        ok: true,
        despawned: 3,
      });
      expect(root.active).toBe(false);
      expect(child.active).toBe(false);
      expect(part.active).toBe(false);
      expect(sibling.active).toBe(true);
      expect(activeCount(app)).toBe(1);
    } finally {
      await app.dispose();
    }
  });

  it("keeps an existing group intact and removes partial entities on construction failure", async () => {
    const app = await emptyApp();
    try {
      const group = app.context.spawn.group({
        key: "unique",
        name: "Original",
      });
      const count = activeCount(app);
      expect(() =>
        app.context.spawn.group({ key: "unique", name: "Duplicate" }),
      ).toThrow();
      expect(activeCount(app)).toBe(count);
      expect(group.getValue(Name, "value")).toBe("Original");
      expect(() =>
        app.context.spawn.group({
          key: "failure",
          get transform(): never {
            throw new Error("invalid transform getter");
          },
        }),
      ).toThrow("invalid transform getter");
      expect(activeCount(app)).toBe(count);
      expect(app.context.spawn.group({ key: "failure" }).active).toBe(true);
    } finally {
      await app.dispose();
    }
  });

  it("reports misplaced top-level options through existing spawn diagnostics", async () => {
    const app = await emptyApp();
    try {
      const parent = app.context.spawn.group({ key: "parent" });
      const invalid = { key: "child", parent } as unknown as SpawnGroupOptions;
      const child = app.context.spawn.group(invalid);
      expect(child.getValue(Parent, "entity")).toBeNull();
      expect(app.context.diagnostics.list()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "aperture.spawn.unknownOption",
            data: expect.objectContaining({
              spawnKind: "group",
              unknown: ["parent"],
            }),
          }),
        ]),
      );
    } finally {
      await app.dispose();
    }
  });

  it("preserves groups, imported children and edits through session snapshots", async () => {
    const session = await createHeadlessSessionController({
      config: defineApertureConfig({
        mode: "headless",
        render: {
          defaultCamera: false,
          defaultLight: false,
          defaultEnvironment: false,
        },
        assets: {
          model: asset.gltf("/assets/cube.glb", { preload: "blocking" }),
        },
      }),
      systems: [
        {
          default: class AssemblyScene extends createSystem() {
            override init(): void {
              const group = this.spawn.group({
                key: "assembly",
                name: "Imported assembly",
                tags: ["editable"],
                transform: { translation: [5, 2, 0], scale: [2, 2, 2] },
              });
              this.spawn.gltf(this.assets.gltf("model"), {
                key: "model",
                transform: { parent: group, translation: [1, 0, 0] },
              });
              this.spawn.mesh({
                key: "base",
                mesh: mesh.box({ size: [3, 0.3, 3] }),
                material: material.standard(),
                transform: { parent: group, translation: [0, -1, 0] },
              });
            }
          },
        },
      ],
      seed: 42,
      assetMode: "strict",
      root: path.resolve("examples/developer-api"),
      publicDir: "public",
      allowHttpAssets: false,
      determinism: "off",
    });
    try {
      const readModelPosition = () => {
        const response = session.callTool({
          name: "ecs_get_entity",
          arguments: { key: "model" },
        });
        expect(response.ok).toBe(true);
        const result = response.result as {
          summary: { worldTransform: { matrix: readonly number[] } };
        };
        return result.summary.worldTransform.matrix.slice(12, 15);
      };
      expect(readModelPosition()).toEqual([7, 2, 0]);
      expect(
        session.callTool({
          name: "ecs_set_component_field",
          arguments: {
            key: "assembly",
            component: LocalTransform.id,
            field: "translation",
            value: [8, 3, 1],
          },
        }).ok,
      ).toBe(true);
      session.step({ frames: 1 });
      expect(readModelPosition()).toEqual([10, 3, 1]);
      const groupBefore = session.callTool({
        name: "ecs_get_entity",
        arguments: { key: "assembly" },
      });
      const snapshot = createApertureSessionSnapshot(session.runner);
      await session.reset({ seed: 42 });
      expect(await session.restoreSessionSnapshot({ snapshot })).toMatchObject({
        ok: true,
      });
      expect(readModelPosition()).toEqual([10, 3, 1]);
      const groupAfter = session.callTool({
        name: "ecs_get_entity",
        arguments: { key: "assembly" },
      });
      expect(groupAfter).toMatchObject({
        result: {
          summary: {
            key: "assembly",
            name: "Imported assembly",
            tags: ["editable"],
            localTransform: { translation: [8, 3, 1], scale: [2, 2, 2] },
          },
        },
      });
      expect(groupBefore.ok).toBe(true);
      expect(session.callTool({ name: "ecs_get_hierarchy" })).toMatchObject({
        ok: true,
        result: {
          roots: expect.arrayContaining([
            expect.objectContaining({
              key: "assembly",
              children: expect.arrayContaining([
                expect.objectContaining({ key: "model" }),
                expect.objectContaining({ key: "base" }),
              ]),
            }),
          ]),
        },
      });
      expect(session.callTool({ name: "camera_create_agent" }).ok).toBe(true);
      expect(
        session.callTool({
          name: "camera_frame_entities",
          arguments: { subjects: [{ key: "assembly" }] },
        }),
      ).toMatchObject({
        ok: true,
        result: { framing: { meshes: expect.any(Array) } },
      });
      const extracted = session.extract().snapshot;
      expect(extracted.meshDraws).toHaveLength(2);
      expect(
        session.runner.app.lowLevel.assets.createManifestReport().placeholders
          .count,
      ).toBe(0);
    } finally {
      session.dispose();
    }
  }, 60_000);
});
