import { describe, expect, it } from "vitest";

import { createWorld } from "@aperture-engine/simulation";
import {
  Mesh,
  Skin,
  createGltfEcsAuthoringCommandPlan,
  createGltfSceneTraversalReport,
  importGltfSkins,
  replayGltfEcsAuthoringCommands,
  validateGltfRootForAssetMapping,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
  type SkinSkeleton,
} from "@aperture-engine/render";

/** Build a binary buffer holding two MAT4 inverse-bind matrices. */
function inverseBindBinary(): ArrayBuffer {
  const matrices = new Float32Array(32);
  // Joint 0: identity.
  matrices[0] = 1;
  matrices[5] = 1;
  matrices[10] = 1;
  matrices[15] = 1;
  // Joint 1: identity with translation (column-major col3 = -2,-3,-4).
  matrices[16] = 1;
  matrices[21] = 1;
  matrices[26] = 1;
  matrices[28] = -2;
  matrices[29] = -3;
  matrices[30] = -4;
  matrices[31] = 1;
  return matrices.buffer;
}

function skinnedRoot() {
  return {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0, 1, 2] }],
    nodes: [
      { name: "SkinnedMesh", mesh: 0, skin: 0 },
      { name: "Joint0" },
      { name: "Joint1" },
    ],
    skins: [{ joints: [1, 2], skeleton: 1, inverseBindMatrices: 0 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 2, type: "MAT4" }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 128 }],
    buffers: [{ byteLength: 128 }],
  };
}

function meshRegistrationReport(): GltfMeshSourceAssetRegistrationReport {
  return {
    valid: true,
    written: [
      {
        kind: "mesh",
        plannedHandleKey: "gltf:mesh:0:primitive:0",
        registeredHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        diagnostics: [],
      },
    ],
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

describe("glTF skin import", () => {
  it("parses joints, skeleton root, and inverse-bind matrices from the accessor", () => {
    const binary = inverseBindBinary();
    const report = importGltfSkins({
      root: skinnedRoot(),
      resolveBufferBytes: (bufferIndex) => (bufferIndex === 0 ? binary : null),
    });

    expect(report.valid).toBe(true);
    expect(report.skins).toHaveLength(1);
    const skin = report.skins[0]!;
    expect(skin.jointCount).toBe(2);
    expect(skin.jointNodeIndices).toEqual([1, 2]);
    expect(skin.skeletonNodeIndex).toBe(1);
    expect(skin.inverseBindMatrices).toHaveLength(32);
    // Joint 0 identity.
    expect(Array.from(skin.inverseBindMatrices.subarray(0, 16))).toEqual([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]);
    // Joint 1 translation column matches the accessor bytes.
    expect(skin.inverseBindMatrices[28]).toBe(-2);
    expect(skin.inverseBindMatrices[29]).toBe(-3);
    expect(skin.inverseBindMatrices[30]).toBe(-4);
  });

  it("defaults to identity inverse-bind matrices when the accessor is absent", () => {
    const report = importGltfSkins({
      root: {
        asset: { version: "2.0" },
        skins: [{ joints: [1, 2] }],
      },
      resolveBufferBytes: () => null,
    });
    expect(report.valid).toBe(true);
    const skin = report.skins[0]!;
    expect(skin.jointCount).toBe(2);
    expect(skin.inverseBindMatrices[0]).toBe(1);
    expect(skin.inverseBindMatrices[16]).toBe(1); // joint 1 identity diagonal
  });

  it("emits a Skin command that replays into a resolvable skeleton component", () => {
    const root = skinnedRoot();
    const binary = inverseBindBinary();
    const traversalReport = createGltfSceneTraversalReport({ root });
    const skinReport = importGltfSkins({
      root,
      resolveBufferBytes: () => binary,
    });

    const plan = createGltfEcsAuthoringCommandPlan({
      traversalReport,
      meshRegistrationReport: meshRegistrationReport(),
      primitiveMaterialReport: primitiveMaterialReport(),
      skinReport,
    });

    const skinCommand = plan.commands.find(
      (command) =>
        command.type === "addComponent" && command.component === "Skin",
    );
    expect(skinCommand).toBeDefined();
    expect(plan.valid).toBe(true);

    const world = createWorld();
    const replay = replayGltfEcsAuthoringCommands({ world, plan });
    expect(replay.valid).toBe(true);

    const meshEntity = replay.entitiesByKey.get(
      "gltf:node:0:mesh:0:primitive:0",
    );
    const joint0 = replay.entitiesByKey.get("gltf:node:1");
    const joint1 = replay.entitiesByKey.get("gltf:node:2");
    expect(meshEntity).toBeDefined();
    expect(joint0).toBeDefined();
    expect(joint1).toBeDefined();

    expect(meshEntity!.hasComponent(Skin)).toBe(true);
    expect(meshEntity!.getValue(Skin, "jointCount")).toBe(2);
    const skeleton = meshEntity!.getValue(Skin, "skeleton") as SkinSkeleton;
    expect(skeleton.joints[0]).toBe(joint0);
    expect(skeleton.joints[1]).toBe(joint1);
    expect(skeleton.inverseBindMatrices).toHaveLength(32);
    expect(skeleton.inverseBindMatrices[28]).toBe(-2);

    // The skinned mesh entity is still a normal renderable mesh entity.
    expect(meshEntity!.hasComponent(Mesh)).toBe(true);
  });

  it("recognizes skins as a core root array without an unsupported-extension hard-fail", () => {
    const ok = validateGltfRootForAssetMapping({
      asset: { version: "2.0" },
      skins: [{ joints: [0, 1] }],
    });
    expect(ok.valid).toBe(true);
    expect(
      ok.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "gltfRoot.unsupportedRequiredExtension",
      ),
    ).toBe(false);

    const malformed = validateGltfRootForAssetMapping({
      asset: { version: "2.0" },
      skins: { joints: [0] },
    });
    expect(malformed.valid).toBe(false);
    expect(
      malformed.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "gltfRoot.malformedArray" &&
          diagnostic.field === "skins",
      ),
    ).toBe(true);
  });
});
