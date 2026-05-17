import { describe, expect, it } from "vitest";

import {
  createGltfLoaderOrchestrationReport,
  type GltfAssetMappingReport,
  type GltfEcsAuthoringCommandPlan,
  type GltfEcsCommandReplayReport,
  type GltfMeshAssetConstructionReport,
  type GltfMeshSourceAssetRegistrationReport,
  type GltfPrimitiveMaterialResolutionReport,
  type GltfRootValidationReport,
  type GltfSceneTraversalReport,
  type GltfSourceAssetRegistrationReport,
} from "@aperture-engine/core";

describe("glTF loader orchestration report", () => {
  it("summarizes a provided happy-path stage set", () => {
    const report = createGltfLoaderOrchestrationReport({
      root: validReport() as GltfRootValidationReport,
      assetMapping: validReport() as unknown as GltfAssetMappingReport,
      sourceRegistration: sourceRegistrationReport(2),
      meshConstruction:
        validReport() as unknown as GltfMeshAssetConstructionReport,
      meshRegistration: meshRegistrationReport(1),
      sceneTraversal: validReport() as unknown as GltfSceneTraversalReport,
      primitiveMaterialResolution:
        validReport() as unknown as GltfPrimitiveMaterialResolutionReport,
      ecsCommandPlan: commandPlanReport(3),
      ecsReplay: replayReport(3),
    });

    expect(report.valid).toBe(true);
    expect(report.diagnostics).toEqual([]);
    expect(report.stages).toMatchObject([
      { stage: "root", status: "provided", sideEffect: "none" },
      { stage: "assetMapping", status: "provided", sideEffect: "none" },
      {
        stage: "sourceRegistration",
        status: "provided",
        sideEffect: "asset-registry",
        writtenCount: 2,
      },
      { stage: "meshConstruction", status: "provided" },
      {
        stage: "meshRegistration",
        status: "provided",
        sideEffect: "asset-registry",
        writtenCount: 1,
      },
      { stage: "sceneTraversal", status: "provided" },
      { stage: "primitiveMaterialResolution", status: "provided" },
      { stage: "ecsCommandPlan", status: "provided", createdCount: 3 },
      { stage: "ecsReplay", status: "provided", createdCount: 3 },
    ]);
  });

  it("reports partial paths and failed prerequisites", () => {
    const report = createGltfLoaderOrchestrationReport({
      sourceRegistration: {
        valid: false,
        written: [],
        skipped: [],
        diagnostics: [
          {
            code: "gltfRegistration.rootInvalid",
            severity: "error",
            message: "Root invalid.",
          },
        ],
      } as GltfSourceAssetRegistrationReport,
      ecsReplay: replayReport(1),
    });

    expect(report.valid).toBe(false);
    expect(report.stages).toContainEqual({
      stage: "sourceRegistration",
      status: "failed",
      sideEffect: "asset-registry",
      valid: false,
      writtenCount: 0,
      diagnosticCount: 1,
    });
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfLoader.failedStage",
        stage: "sourceRegistration",
      },
      {
        code: "gltfLoader.sideEffectWithoutPrerequisite",
        stage: "sourceRegistration",
        requiredStage: "root",
      },
      {
        code: "gltfLoader.sideEffectWithoutPrerequisite",
        stage: "sourceRegistration",
        requiredStage: "assetMapping",
      },
      {
        code: "gltfLoader.sideEffectWithoutPrerequisite",
        stage: "ecsReplay",
        requiredStage: "ecsCommandPlan",
      },
    ]);
  });

  it("reports mesh registration without mesh construction", () => {
    const report = createGltfLoaderOrchestrationReport({
      meshRegistration: meshRegistrationReport(1),
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfLoader.sideEffectWithoutPrerequisite",
        stage: "meshRegistration",
        requiredStage: "meshConstruction",
      },
    ]);
  });

  it("reports command planning without required source reports", () => {
    const report = createGltfLoaderOrchestrationReport({
      ecsCommandPlan: commandPlanReport(1),
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfLoader.sideEffectWithoutPrerequisite",
        stage: "ecsCommandPlan",
        requiredStage: "sceneTraversal",
      },
      {
        code: "gltfLoader.sideEffectWithoutPrerequisite",
        stage: "ecsCommandPlan",
        requiredStage: "meshRegistration",
      },
      {
        code: "gltfLoader.sideEffectWithoutPrerequisite",
        stage: "ecsCommandPlan",
        requiredStage: "primitiveMaterialResolution",
      },
    ]);
  });

  it("reports side-effect stages after failed pure report stages", () => {
    const report = createGltfLoaderOrchestrationReport({
      root: {
        valid: false,
        diagnostics: [
          {
            code: "gltfRoot.invalidAsset",
            severity: "error",
            message: "Invalid asset.",
          },
        ],
      },
      sourceRegistration: sourceRegistrationReport(1),
    });

    expect(report.valid).toBe(false);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "gltfLoader.failedStage",
          stage: "root",
        }),
        expect.objectContaining({
          code: "gltfLoader.invalidStageOrder",
          stage: "sourceRegistration",
          requiredStage: "root",
        }),
      ]),
    );
  });

  it("counts only written registration entries and created entity commands", () => {
    const report = createGltfLoaderOrchestrationReport({
      sourceRegistration: {
        ...sourceRegistrationReport(2),
        skipped: [
          {
            kind: "material",
            plannedHandleKey: "material:gltf:material:9",
            registeredHandleKey: "material:gltf:material:9",
            materialIndex: 9,
            reason: "gltfRegistration.invalidPlannedAsset",
            diagnostics: [],
          },
        ],
      },
      meshRegistration: meshRegistrationReport(3),
      ecsCommandPlan: {
        ...commandPlanReport(2),
        commands: [
          ...commandPlanReport(2).commands,
          {
            type: "addComponent",
            entityKey: "gltf:entity:0",
            component: "Name",
            value: { value: "Entity0" },
          },
        ],
      },
      ecsReplay: replayReport(4),
    });

    expect(report.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "sourceRegistration",
          writtenCount: 2,
        }),
        expect.objectContaining({
          stage: "meshRegistration",
          writtenCount: 3,
        }),
        expect.objectContaining({
          stage: "ecsCommandPlan",
          createdCount: 2,
        }),
        expect.objectContaining({
          stage: "ecsReplay",
          createdCount: 4,
        }),
      ]),
    );
  });

  it("omits count fields for missing stages", () => {
    const report = createGltfLoaderOrchestrationReport({});
    const sourceRegistration = report.stages.find(
      (stage) => stage.stage === "sourceRegistration",
    );
    const replay = report.stages.find((stage) => stage.stage === "ecsReplay");

    expect(sourceRegistration).toEqual({
      stage: "sourceRegistration",
      status: "missing",
      sideEffect: "asset-registry",
    });
    expect(replay).toEqual({
      stage: "ecsReplay",
      status: "missing",
      sideEffect: "ecs-world",
    });
  });
});

function validReport() {
  return { valid: true, diagnostics: [] };
}

function sourceRegistrationReport(
  writtenCount: number,
): GltfSourceAssetRegistrationReport {
  return {
    valid: true,
    written: Array.from({ length: writtenCount }, (_, index) => ({
      kind: "material",
      plannedHandleKey: `material:gltf:material:${index}`,
      registeredHandleKey: `material:gltf:material:${index}`,
      materialIndex: index,
      diagnostics: [],
    })),
    skipped: [],
    diagnostics: [],
  };
}

function meshRegistrationReport(
  writtenCount: number,
): GltfMeshSourceAssetRegistrationReport {
  return {
    valid: true,
    written: Array.from({ length: writtenCount }, (_, index) => ({
      kind: "mesh",
      plannedHandleKey: `gltf:mesh:${index}:primitive:0`,
      registeredHandleKey: `mesh:gltf:mesh:${index}:primitive:0`,
      meshIndex: index,
      primitiveIndex: 0,
      diagnostics: [],
    })),
    skipped: [],
    diagnostics: [],
  };
}

function commandPlanReport(entityCount: number): GltfEcsAuthoringCommandPlan {
  return {
    valid: true,
    sceneIndex: 0,
    rootEntityKeys: ["gltf:scene:0"],
    commands: Array.from({ length: entityCount }, (_, index) => ({
      type: "createEntity",
      entityKey: `gltf:entity:${index}`,
      label: `Entity${index}`,
    })),
    dependencies: [],
    skipped: [],
    diagnostics: [],
  };
}

function replayReport(entityCount: number): GltfEcsCommandReplayReport {
  return {
    valid: true,
    entitiesByKey: new Map(),
    created: Array.from({ length: entityCount }, (_, index) => ({
      entityKey: `gltf:entity:${index}`,
      label: `Entity${index}`,
      entityIndex: index,
      entityGeneration: 0,
    })),
    appliedComponents: [],
    skipped: [],
    diagnostics: [],
  };
}
