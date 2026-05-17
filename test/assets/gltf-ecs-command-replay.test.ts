import { describe, expect, it } from "vitest";

import {
  LocalTransform,
  Material,
  Mesh,
  Name,
  Parent,
  Visibility,
  WorldTransform,
  createGltfEcsAuthoringCommandPlan,
  createGltfSceneTraversalReport,
  createWorld,
  replayGltfEcsAuthoringCommands,
  type GltfEcsAuthoringCommandPlan,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
} from "@aperture-engine/core";

describe("glTF ECS command replay", () => {
  it("replays scene, node, and primitive commands into an ECS world", () => {
    const world = createWorld();
    const plan = createPlan();
    const replay = replayGltfEcsAuthoringCommands({ world, plan });
    const scene = replay.entitiesByKey.get("gltf:scene:0");
    const node = replay.entitiesByKey.get("gltf:node:0");
    const primitive = replay.entitiesByKey.get(
      "gltf:node:0:mesh:0:primitive:0",
    );

    expect(replay.valid).toBe(true);
    expect(replay.created.map((entry) => entry.entityKey)).toEqual([
      "gltf:scene:0",
      "gltf:node:0",
      "gltf:node:0:mesh:0:primitive:0",
    ]);
    expect(scene?.getValue(Name, "value")).toBe("Scene0");
    expect(scene?.getValue(Parent, "entity")).toBeNull();
    expect(node?.getValue(Name, "value")).toBe("MeshNode");
    expect(node?.getValue(Parent, "entity")).toBe(scene);
    expect(
      Array.from(node?.getVectorView(LocalTransform, "translation") ?? []),
    ).toEqual([1, 2, 3]);
    expect(
      Array.from(node?.getVectorView(WorldTransform, "col0") ?? []),
    ).toEqual([1, 0, 0, 0]);
    expect(primitive?.getValue(Parent, "entity")).toBe(node);
    expect(primitive?.getValue(Visibility, "visible")).toBe(true);
    expect(primitive?.getValue(Mesh, "meshId")).toBe("gltf:mesh:0:primitive:0");
    expect(primitive?.getValue(Material, "materialId")).toBe("gltf:material:0");
  });

  it("reports invalid plans without mutating the world", () => {
    const world = createWorld();
    const plan = {
      ...createPlan(),
      valid: false,
    };
    const replay = replayGltfEcsAuthoringCommands({ world, plan });

    expect(replay.valid).toBe(false);
    expect(replay.created).toEqual([]);
    expect(replay.entitiesByKey.size).toBe(0);
    expect(replay.diagnostics).toMatchObject([
      { code: "gltfEcsReplay.invalidPlan" },
    ]);
  });

  it("reports duplicate createEntity keys and keeps the first mapping", () => {
    const replay = replayGltfEcsAuthoringCommands({
      world: createWorld(),
      plan: {
        ...createPlan(),
        commands: [
          { type: "createEntity", entityKey: "gltf:node:0", label: "First" },
          { type: "createEntity", entityKey: "gltf:node:0", label: "Second" },
        ],
      },
    });

    expect(replay.valid).toBe(false);
    expect(replay.created).toMatchObject([
      { entityKey: "gltf:node:0", label: "First" },
    ]);
    expect(replay.entitiesByKey.get("gltf:node:0")).toBeDefined();
    expect(replay.skipped).toMatchObject([
      {
        commandIndex: 1,
        entityKey: "gltf:node:0",
        reason: "gltfEcsReplay.duplicateEntityKey",
      },
    ]);
  });

  it("reports addComponent commands for unknown entity keys", () => {
    const replay = replayGltfEcsAuthoringCommands({
      world: createWorld(),
      plan: {
        ...createPlan(),
        commands: [
          {
            type: "addComponent",
            entityKey: "gltf:missing",
            component: "Name",
            value: { value: "Missing" },
          },
        ],
      },
    });

    expect(replay.valid).toBe(false);
    expect(replay.created).toEqual([]);
    expect(replay.appliedComponents).toEqual([]);
    expect(replay.skipped).toMatchObject([
      {
        commandIndex: 0,
        entityKey: "gltf:missing",
        component: "Name",
        reason: "gltfEcsReplay.missingEntityKey",
      },
    ]);
  });

  it("reports missing parent keys without attaching a partial Parent component", () => {
    const replay = replayGltfEcsAuthoringCommands({
      world: createWorld(),
      plan: {
        ...createPlan(),
        commands: [
          { type: "createEntity", entityKey: "gltf:node:0", label: "Node0" },
          {
            type: "addComponent",
            entityKey: "gltf:node:0",
            component: "Parent",
            value: { parentEntityKey: "gltf:missing" },
          },
        ],
      },
    });
    const entity = replay.entitiesByKey.get("gltf:node:0");

    expect(replay.valid).toBe(false);
    expect(entity?.hasComponent(Parent)).toBe(false);
    expect(replay.skipped).toMatchObject([
      {
        commandIndex: 1,
        entityKey: "gltf:node:0",
        component: "Parent",
        reason: "gltfEcsReplay.missingParentEntityKey",
      },
    ]);
  });

  it("reports unsupported component names without attaching components", () => {
    const replay = replayGltfEcsAuthoringCommands({
      world: createWorld(),
      plan: planWithCommands([
        { type: "createEntity", entityKey: "gltf:node:0", label: "Node0" },
        {
          type: "addComponent",
          entityKey: "gltf:node:0",
          component: "UnsupportedComponent",
          value: {},
        },
      ]),
    });

    expect(replay.valid).toBe(false);
    expect(replay.appliedComponents).toEqual([]);
    expect(replay.skipped).toMatchObject([
      {
        commandIndex: 1,
        entityKey: "gltf:node:0",
        component: "UnsupportedComponent",
        reason: "gltfEcsReplay.unknownComponent",
      },
    ]);
  });

  it("reports malformed component values without partial attachment", () => {
    const replay = replayGltfEcsAuthoringCommands({
      world: createWorld(),
      plan: planWithCommands([
        { type: "createEntity", entityKey: "gltf:node:0", label: "Node0" },
        {
          type: "addComponent",
          entityKey: "gltf:node:0",
          component: "Name",
          value: {},
        },
        {
          type: "addComponent",
          entityKey: "gltf:node:0",
          component: "Parent",
          value: { parentEntityKey: 7 },
        },
        {
          type: "addComponent",
          entityKey: "gltf:node:0",
          component: "LocalTransform",
          value: {
            translation: [0, 0],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
        },
      ]),
    });
    const entity = replay.entitiesByKey.get("gltf:node:0");

    expect(replay.valid).toBe(false);
    expect(entity?.hasComponent(Name)).toBe(false);
    expect(entity?.hasComponent(Parent)).toBe(false);
    expect(entity?.hasComponent(LocalTransform)).toBe(false);
    expect(replay.skipped).toMatchObject([
      {
        commandIndex: 1,
        component: "Name",
        reason: "gltfEcsReplay.invalidComponentValue",
      },
      {
        commandIndex: 2,
        component: "Parent",
        reason: "gltfEcsReplay.invalidComponentValue",
      },
      {
        commandIndex: 3,
        component: "LocalTransform",
        reason: "gltfEcsReplay.invalidComponentValue",
      },
    ]);
  });
});

function createPlan() {
  return createGltfEcsAuthoringCommandPlan({
    traversalReport: createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "MeshNode", translation: [1, 2, 3], mesh: 0 }],
      },
    }),
    meshRegistrationReport: meshRegistrationReport([
      "mesh:gltf:mesh:0:primitive:0",
    ]),
    primitiveMaterialReport: primitiveMaterialReport(),
  });
}

function planWithCommands(
  commands: readonly unknown[],
): GltfEcsAuthoringCommandPlan {
  return {
    valid: true,
    sceneIndex: 0,
    rootEntityKeys: ["gltf:node:0"],
    commands: commands as GltfEcsAuthoringCommandPlan["commands"],
    dependencies: [],
    skipped: [],
    diagnostics: [],
  };
}

function meshRegistrationReport(
  written: readonly string[],
): GltfMeshSourceAssetRegistrationReport {
  return {
    valid: true,
    written: written.map((key) => ({
      kind: "mesh",
      plannedHandleKey: key.replace(/^mesh:/, ""),
      registeredHandleKey: key,
      meshIndex: 0,
      primitiveIndex: 0,
      diagnostics: [],
    })),
    skipped: [],
    diagnostics: [],
  };
}

function primitiveMaterialReport(): GltfPrimitiveMaterialResolutionReport {
  return {
    valid: true,
    resolved: [
      {
        meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        materialIndex: 0,
        materialHandleKey: "material:gltf:material:0",
        source: "registered",
      },
    ],
    unresolved: [],
    diagnostics: [],
  };
}
