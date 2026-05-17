import { describe, expect, it } from "vitest";

import {
  createGltfLoaderOrchestrationReport,
  gltfLoaderOrchestrationReportToJson,
  gltfLoaderOrchestrationReportToJsonValue,
  type GltfEcsCommandReplayReport,
  type GltfSourceAssetRegistrationReport,
} from "@aperture-engine/core";

describe("glTF loader orchestration report JSON", () => {
  it("serializes stage summaries and diagnostics without nested raw state", () => {
    const report = createGltfLoaderOrchestrationReport({
      sourceRegistration: failedSourceRegistration(),
      ecsReplay: replayReport(),
    });
    const json = gltfLoaderOrchestrationReportToJsonValue(report);
    const serialized = JSON.stringify(json);

    expect(json.valid).toBe(false);
    expect(json.stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: "root", status: "missing" }),
        expect.objectContaining({ stage: "assetMapping", status: "missing" }),
        {
          stage: "sourceRegistration",
          status: "failed",
          sideEffect: "asset-registry",
          valid: false,
          writtenCount: 0,
          diagnosticCount: 1,
        },
      ]),
    );
    expect(json.diagnostics).toMatchObject([
      { code: "gltfLoader.failedStage", stage: "sourceRegistration" },
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
    expect(JSON.parse(gltfLoaderOrchestrationReportToJson(report))).toEqual(
      json,
    );
    expect(serialized).not.toContain("vertexStreams");
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("AssetRegistry");
    expect(serialized).not.toContain("RenderPacket");
    expect(serialized).not.toContain("GPU");
  });
});

function failedSourceRegistration(): GltfSourceAssetRegistrationReport {
  return {
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
  };
}

function replayReport(): GltfEcsCommandReplayReport {
  return {
    valid: true,
    entitiesByKey: new Map(),
    created: [
      {
        entityKey: "gltf:scene:0",
        label: "Scene0",
        entityIndex: 0,
        entityGeneration: 0,
      },
    ],
    appliedComponents: [],
    skipped: [],
    diagnostics: [],
  };
}
