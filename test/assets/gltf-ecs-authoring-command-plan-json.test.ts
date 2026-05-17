import { describe, expect, it } from "vitest";

import {
  createGltfEcsAuthoringCommandPlan,
  createGltfSceneTraversalReport,
  gltfEcsAuthoringCommandPlanToJson,
  gltfEcsAuthoringCommandPlanToJsonValue,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
} from "@aperture-engine/core";

describe("glTF ECS authoring command plan JSON", () => {
  it("serializes commands and dependencies without embedding runtime state", () => {
    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport: traversalWithMeshNode(),
      meshRegistrationReport: meshRegistrationReport([
        "mesh:gltf:mesh:0:primitive:0",
      ]),
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
    const json = gltfEcsAuthoringCommandPlanToJsonValue(plan);
    const serialized = JSON.stringify(json);

    expect(json).toMatchObject({
      valid: true,
      sceneIndex: 0,
      rootEntityKeys: ["gltf:scene:0"],
      dependencies: [
        "mesh:gltf:mesh:0:primitive:0",
        "material:gltf:material:0",
      ],
      skipped: [],
      diagnostics: [],
    });
    expect(json.commands).toContainEqual({
      type: "addComponent",
      entityKey: "gltf:node:0:mesh:0:primitive:0",
      component: "Mesh",
      value: {
        meshId: "gltf:mesh:0:primitive:0",
        handleKey: "mesh:gltf:mesh:0:primitive:0",
      },
    });
    expect(JSON.parse(gltfEcsAuthoringCommandPlanToJson(plan))).toEqual(json);
    expect(serialized).not.toContain("AssetRegistry");
    expect(serialized).not.toContain("EcsWorld");
    expect(serialized).not.toContain("vertexStreams");
    expect(serialized).not.toContain("sourceData");
    expect(serialized).not.toContain("GPU");
  });

  it("serializes skipped entries and diagnostics", () => {
    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport: traversalWithMeshNode(),
      meshRegistrationReport: meshRegistrationReport([
        "mesh:gltf:mesh:0:primitive:0",
      ]),
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
    const json = gltfEcsAuthoringCommandPlanToJsonValue(plan);

    expect(json).toMatchObject({
      valid: false,
      skipped: [
        {
          entityKey: "gltf:node:0:mesh:0:primitive:0",
          reason: "gltfEcsAuthoring.unresolvedPrimitiveMaterial",
          diagnostics: [
            {
              code: "gltfEcsAuthoring.unresolvedPrimitiveMaterial",
              meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
              materialHandleKey: "material:gltf:material:0",
              sourceReason: "gltfPrimitiveMaterial.unregisteredMaterial",
            },
          ],
        },
      ],
      diagnostics: [
        {
          code: "gltfEcsAuthoring.unresolvedPrimitiveMaterial",
          meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
          materialHandleKey: "material:gltf:material:0",
          sourceReason: "gltfPrimitiveMaterial.unregisteredMaterial",
        },
      ],
    });
    expect(JSON.parse(gltfEcsAuthoringCommandPlanToJson(plan))).toEqual(json);
  });
});

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
