import { describe, expect, it } from "vitest";

import {
  createGltfMeshPrimitiveMappingReport,
  createGltfPrimitiveMaterialResolutionReport,
  type GltfSourceAssetRegistrationReport,
} from "@aperture-engine/core";

describe("glTF primitive material resolution", () => {
  it("resolves primitive material indices from written registration entries", () => {
    const primitiveReport = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}, {}],
        meshes: [
          {
            primitives: [
              { attributes: { POSITION: 0 }, indices: 1, material: 0 },
            ],
          },
        ],
      },
    });
    const report = createGltfPrimitiveMaterialResolutionReport({
      primitiveReport,
      registrationReport: registrationFixture({
        writtenMaterialKeys: ["material:gltf:material:0"],
      }),
    });

    expect(report.valid).toBe(true);
    expect(report.unresolved).toEqual([]);
    expect(report.resolved).toEqual([
      {
        meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
        meshIndex: 0,
        primitiveIndex: 0,
        materialIndex: 0,
        materialHandleKey: "material:gltf:material:0",
        source: "registered",
      },
    ]);
  });

  it("requires caller-owned default materials for primitives without a material index", () => {
    const primitiveReport = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      },
    });
    const report = createGltfPrimitiveMaterialResolutionReport({
      primitiveReport,
      registrationReport: registrationFixture({}),
    });

    expect(report.valid).toBe(false);
    expect(report.resolved).toEqual([]);
    expect(report.unresolved).toMatchObject([
      {
        meshHandleKey: "mesh:gltf:mesh:0:primitive:0",
        materialIndex: null,
        reason: "gltfPrimitiveMaterial.defaultMaterialRequired",
      },
    ]);
  });

  it("reports skipped materials and preserves dependency context", () => {
    const primitiveReport = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}],
        meshes: [
          {
            primitives: [{ attributes: { POSITION: 0 }, material: 2 }],
          },
        ],
      },
    });
    const report = createGltfPrimitiveMaterialResolutionReport({
      primitiveReport,
      registrationReport: registrationFixture({
        skippedMaterialKey: "material:gltf:material:2",
        skippedReason: "gltfRegistration.missingDependency",
        dependencyKey: "texture:gltf:texture:9:baseColorTexture",
      }),
    });

    expect(report.valid).toBe(false);
    expect(report.unresolved).toMatchObject([
      {
        materialHandleKey: "material:gltf:material:2",
        reason: "gltfPrimitiveMaterial.failedMaterialDependency",
        diagnostics: [
          {
            registrationReason: "gltfRegistration.missingDependency",
            dependencyKey: "texture:gltf:texture:9:baseColorTexture",
          },
        ],
      },
    ]);
  });

  it("resolves duplicate material keys only when the caller marks them available", () => {
    const primitiveReport = createGltfMeshPrimitiveMappingReport({
      root: {
        asset: { version: "2.0" },
        accessors: [{}],
        meshes: [
          {
            primitives: [{ attributes: { POSITION: 0 }, material: 1 }],
          },
        ],
      },
    });
    const report = createGltfPrimitiveMaterialResolutionReport({
      primitiveReport,
      registrationReport: registrationFixture({
        skippedMaterialKey: "material:gltf:material:1",
        skippedReason: "gltfRegistration.duplicateAssetKey",
      }),
      availableMaterialHandleKeys: ["material:gltf:material:1"],
    });

    expect(report.valid).toBe(true);
    expect(report.resolved).toMatchObject([
      {
        materialHandleKey: "material:gltf:material:1",
        source: "available",
      },
    ]);
  });
});

function registrationFixture(input: {
  readonly writtenMaterialKeys?: readonly string[];
  readonly skippedMaterialKey?: string;
  readonly skippedReason?: GltfSourceAssetRegistrationReport["skipped"][number]["reason"];
  readonly dependencyKey?: string;
}): GltfSourceAssetRegistrationReport {
  const written = (input.writtenMaterialKeys ?? []).map((key, index) => ({
    kind: "material" as const,
    plannedHandleKey: key,
    registeredHandleKey: key,
    materialIndex: index,
    diagnostics: [],
  }));
  const skipped =
    input.skippedMaterialKey === undefined
      ? []
      : [
          {
            kind: "material" as const,
            plannedHandleKey: input.skippedMaterialKey,
            registeredHandleKey: input.skippedMaterialKey,
            materialIndex: Number(input.skippedMaterialKey.split(":").at(-1)),
            reason:
              input.skippedReason ?? "gltfRegistration.invalidPlannedAsset",
            diagnostics: [
              {
                code:
                  input.skippedReason ?? "gltfRegistration.invalidPlannedAsset",
                severity: "error" as const,
                message: "Skipped material fixture.",
                kind: "material" as const,
                plannedHandleKey: input.skippedMaterialKey,
                registeredHandleKey: input.skippedMaterialKey,
                ...(input.dependencyKey === undefined
                  ? {}
                  : { dependencyKey: input.dependencyKey }),
              },
            ],
          },
        ];

  return {
    valid: skipped.length === 0,
    written,
    skipped,
    diagnostics: skipped.flatMap((entry) => entry.diagnostics),
  };
}
