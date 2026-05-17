import { describe, expect, it } from "vitest";

import {
  createGltfEcsAuthoringCommandPlan,
  createGltfSceneTraversalReport,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
} from "@aperture-engine/core";

describe("glTF ECS authoring command plan", () => {
  it("plans scene root and TRS node commands with serializable parent keys", () => {
    const traversalReport = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [
          {
            name: "Root",
            translation: [1, 2, 3],
            rotation: [0, 0, 0, 1],
            scale: [2, 2, 2],
            children: [1],
          },
          {
            name: "Child",
            translation: [0, 1, 0],
          },
        ],
      },
    });
    const plan = createGltfEcsAuthoringCommandPlan({ traversalReport });

    expect(traversalReport.valid).toBe(true);
    expect(plan.valid).toBe(true);
    expect(plan.rootEntityKeys).toEqual(["gltf:scene:0"]);
    expect(plan.dependencies).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(createEntityCommands(plan.commands)).toEqual([
      { type: "createEntity", entityKey: "gltf:scene:0", label: "Scene0" },
      { type: "createEntity", entityKey: "gltf:node:0", label: "Root" },
      { type: "createEntity", entityKey: "gltf:node:1", label: "Child" },
    ]);
    expect(componentValue(plan.commands, "gltf:scene:0", "Parent")).toEqual({
      parentEntityKey: null,
    });
    expect(componentValue(plan.commands, "gltf:node:0", "Parent")).toEqual({
      parentEntityKey: "gltf:scene:0",
    });
    expect(componentValue(plan.commands, "gltf:node:1", "Parent")).toEqual({
      parentEntityKey: "gltf:node:0",
    });
    expect(
      componentValue(plan.commands, "gltf:node:0", "LocalTransform"),
    ).toEqual({
      translation: [1, 2, 3],
      rotation: [0, 0, 0, 1],
      scale: [2, 2, 2],
    });
    expect(
      Object.keys(componentValue(plan.commands, "gltf:node:0", "Parent") ?? {}),
    ).not.toContain("entity");
  });

  it("skips matrix nodes and descendants instead of authoring identity transforms", () => {
    const traversalReport = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [
          {
            name: "MatrixRoot",
            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1],
            children: [1],
          },
          { name: "Child" },
        ],
      },
    });
    const plan = createGltfEcsAuthoringCommandPlan({ traversalReport });

    expect(traversalReport.valid).toBe(true);
    expect(plan.valid).toBe(false);
    expect(createEntityCommands(plan.commands)).toEqual([
      { type: "createEntity", entityKey: "gltf:scene:0", label: "Scene0" },
    ]);
    expect(plan.skipped).toMatchObject([
      {
        entityKey: "gltf:node:0",
        reason: "gltfEcsAuthoring.matrixTransformDeferred",
      },
      {
        entityKey: "gltf:node:1",
        reason: "gltfEcsAuthoring.nodeSkippedByAncestor",
      },
    ]);
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "gltfEcsAuthoring.matrixTransformDeferred",
      "gltfEcsAuthoring.nodeSkippedByAncestor",
    ]);
  });

  it("does not plan commands for invalid traversal reports", () => {
    const traversalReport = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        nodes: [{ name: "NoScene" }],
      },
    });
    const plan = createGltfEcsAuthoringCommandPlan({ traversalReport });

    expect(traversalReport.valid).toBe(false);
    expect(plan.valid).toBe(false);
    expect(plan.commands).toEqual([]);
    expect(plan.rootEntityKeys).toEqual([]);
    expect(plan.diagnostics).toMatchObject([
      { code: "gltfEcsAuthoring.invalidTraversalReport" },
    ]);
  });

  it("plans primitive renderable commands from ready mesh and material reports", () => {
    const traversalReport = traversalWithMeshNode();
    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport,
      meshRegistrationReport: meshRegistrationReport({
        written: ["mesh:gltf:mesh:0:primitive:0"],
      }),
      primitiveMaterialReport: primitiveMaterialReport({
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
      }),
    });
    const primitiveKey = "gltf:node:0:mesh:0:primitive:0";

    expect(plan.valid).toBe(true);
    expect(createEntityCommands(plan.commands)).toContainEqual({
      type: "createEntity",
      entityKey: primitiveKey,
      label: "MeshNode.Primitive0",
    });
    expect(componentValue(plan.commands, primitiveKey, "Parent")).toEqual({
      parentEntityKey: "gltf:node:0",
    });
    expect(componentValue(plan.commands, primitiveKey, "Mesh")).toEqual({
      meshId: "gltf:mesh:0:primitive:0",
      handleKey: "mesh:gltf:mesh:0:primitive:0",
    });
    expect(componentValue(plan.commands, primitiveKey, "Material")).toEqual({
      materialId: "gltf:material:0",
      handleKey: "material:gltf:material:0",
    });
    expect(plan.dependencies).toEqual([
      "mesh:gltf:mesh:0:primitive:0",
      "material:gltf:material:0",
    ]);
  });

  it("skips primitive commands when mesh registration is missing", () => {
    const traversalReport = traversalWithMeshNode();
    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport,
      meshRegistrationReport: meshRegistrationReport({}),
      primitiveMaterialReport: primitiveMaterialReport({
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
      }),
    });

    expect(plan.valid).toBe(false);
    expect(createEntityCommands(plan.commands)).not.toContainEqual(
      expect.objectContaining({
        entityKey: "gltf:node:0:mesh:0:primitive:0",
      }),
    );
    expect(plan.skipped).toMatchObject([
      {
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        reason: "gltfEcsAuthoring.missingMeshRegistration",
      },
    ]);
  });

  it("skips primitive commands when material resolution is unresolved", () => {
    const traversalReport = traversalWithMeshNode();
    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport,
      meshRegistrationReport: meshRegistrationReport({
        written: ["mesh:gltf:mesh:0:primitive:0"],
      }),
      primitiveMaterialReport: primitiveMaterialReport({
        unresolved: [
          {
            meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
            meshIndex: 0,
            primitiveIndex: 0,
            materialIndex: 0,
            materialHandleKey: "material:gltf:material:0",
            reason: "gltfPrimitiveMaterial.unregisteredMaterial",
            diagnostics: [],
          },
        ],
      }),
    });

    expect(plan.valid).toBe(false);
    expect(plan.skipped).toMatchObject([
      {
        entityKey: "gltf:node:0:mesh:0:primitive:0",
        reason: "gltfEcsAuthoring.unresolvedPrimitiveMaterial",
      },
    ]);
    expect(plan.dependencies).toEqual([]);
  });

  it("uses node-scoped primitive entity keys for repeated mesh references", () => {
    const traversalReport = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0, 1] }],
        nodes: [
          { name: "MeshNodeA", mesh: 0 },
          { name: "MeshNodeB", mesh: 0 },
        ],
      },
    });
    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport,
      meshRegistrationReport: meshRegistrationReport({
        written: ["mesh:gltf:mesh:0:primitive:0"],
      }),
      primitiveMaterialReport: primitiveMaterialReport({
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
      }),
    });
    const keyA = "gltf:node:0:mesh:0:primitive:0";
    const keyB = "gltf:node:1:mesh:0:primitive:0";

    expect(plan.valid).toBe(true);
    expect(createEntityCommands(plan.commands)).toContainEqual({
      type: "createEntity",
      entityKey: keyA,
      label: "MeshNodeA.Primitive0",
    });
    expect(createEntityCommands(plan.commands)).toContainEqual({
      type: "createEntity",
      entityKey: keyB,
      label: "MeshNodeB.Primitive0",
    });
    expect(componentValue(plan.commands, keyA, "Mesh")).toEqual(
      componentValue(plan.commands, keyB, "Mesh"),
    );
    expect(componentValue(plan.commands, keyA, "Material")).toEqual(
      componentValue(plan.commands, keyB, "Material"),
    );
    expect(componentValue(plan.commands, keyA, "Parent")).toEqual({
      parentEntityKey: "gltf:node:0",
    });
    expect(componentValue(plan.commands, keyB, "Parent")).toEqual({
      parentEntityKey: "gltf:node:1",
    });
  });

  it("reports duplicate primitive entity keys if source reports collide", () => {
    const traversalReport = traversalWithMeshNode();
    const duplicatedMaterial = {
      meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
      meshIndex: 0,
      primitiveIndex: 0,
      materialIndex: 0,
      materialHandleKey: "material:gltf:material:0",
      source: "registered" as const,
    };
    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport,
      meshRegistrationReport: meshRegistrationReport({
        written: ["mesh:gltf:mesh:0:primitive:0"],
      }),
      primitiveMaterialReport: primitiveMaterialReport({
        resolved: [duplicatedMaterial, duplicatedMaterial],
      }),
    });

    expect(plan.valid).toBe(false);
    expect(
      createEntityCommands(plan.commands).filter(
        (command) => command.entityKey === "gltf:node:0:mesh:0:primitive:0",
      ),
    ).toHaveLength(1);
    expect(plan.diagnostics).toMatchObject([
      {
        code: "gltfEcsAuthoring.duplicateEntityKey",
        entityKey: "gltf:node:0:mesh:0:primitive:0",
      },
    ]);
  });
});

type PlannedCommand = ReturnType<
  typeof createGltfEcsAuthoringCommandPlan
>["commands"][number];

function createEntityCommands(commands: readonly PlannedCommand[]) {
  return commands.filter((command) => command.type === "createEntity");
}

function componentValue(
  commands: readonly PlannedCommand[],
  entityKey: string,
  component: string,
) {
  const command = commands.find(
    (entry) =>
      entry.type === "addComponent" &&
      entry.entityKey === entityKey &&
      entry.component === component,
  );

  return command?.type === "addComponent" ? command.value : undefined;
}

function traversalWithMeshNode() {
  return createGltfSceneTraversalReport({
    root: {
      asset: { version: "2.0" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: "MeshNode", mesh: 0 }],
    },
  });
}

function meshRegistrationReport(input: {
  readonly written?: readonly string[];
  readonly skipped?: readonly {
    readonly key: string;
    readonly reason: GltfMeshSourceAssetRegistrationReport["skipped"][number]["reason"];
  }[];
}): GltfMeshSourceAssetRegistrationReport {
  return {
    valid: input.skipped === undefined || input.skipped.length === 0,
    written: (input.written ?? []).map((key) => ({
      kind: "mesh",
      plannedHandleKey: key.replace(/^mesh:/, ""),
      registeredHandleKey: key,
      meshIndex: 0,
      primitiveIndex: 0,
      diagnostics: [],
    })),
    skipped: (input.skipped ?? []).map((entry) => ({
      kind: "mesh",
      plannedHandleKey: entry.key.replace(/^mesh:/, ""),
      registeredHandleKey: entry.key,
      meshIndex: 0,
      primitiveIndex: 0,
      reason: entry.reason,
      diagnostics: [],
    })),
    diagnostics: [],
  };
}

function primitiveMaterialReport(input: {
  readonly resolved?: GltfPrimitiveMaterialResolutionReport["resolved"];
  readonly unresolved?: GltfPrimitiveMaterialResolutionReport["unresolved"];
}): GltfPrimitiveMaterialResolutionReport {
  const unresolved = input.unresolved ?? [];
  return {
    valid: unresolved.length === 0,
    resolved: input.resolved ?? [],
    unresolved,
    diagnostics: unresolved.flatMap((entry) => entry.diagnostics),
  };
}
