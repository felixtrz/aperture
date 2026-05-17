import { describe, expect, it } from "vitest";

import {
  createWorld,
  gltfEcsCommandReplayReportToJson,
  gltfEcsCommandReplayReportToJsonValue,
  replayGltfEcsAuthoringCommands,
  type GltfEcsAuthoringCommandPlan,
} from "@aperture-engine/core";

describe("glTF ECS command replay report JSON", () => {
  it("summarizes created entities without embedding raw ECS objects", () => {
    const replay = replayGltfEcsAuthoringCommands({
      world: createWorld(),
      plan: validPlan(),
    });
    const json = gltfEcsCommandReplayReportToJsonValue(replay);
    const serialized = JSON.stringify(json);

    expect(json).toMatchObject({
      valid: true,
      entityKeys: ["gltf:scene:0"],
      created: [
        {
          entityKey: "gltf:scene:0",
          label: "Scene0",
          entityIndex: 0,
          entityGeneration: 0,
        },
      ],
      diagnostics: [],
      skipped: [],
    });
    expect(JSON.parse(gltfEcsCommandReplayReportToJson(replay))).toEqual(json);
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("components");
    expect(serialized).not.toContain("AssetRegistry");
    expect(serialized).not.toContain("RenderPacket");
    expect(serialized).not.toContain("GPU");
  });

  it("preserves replay diagnostics without serializing raw entities", () => {
    const replay = replayGltfEcsAuthoringCommands({
      world: createWorld(),
      plan: missingParentPlan(),
    });
    const json = gltfEcsCommandReplayReportToJsonValue(replay);

    expect(json).toMatchObject({
      valid: false,
      entityKeys: ["gltf:node:0"],
      skipped: [
        {
          commandIndex: 1,
          entityKey: "gltf:node:0",
          component: "Parent",
          reason: "gltfEcsReplay.missingParentEntityKey",
          diagnostics: [
            {
              code: "gltfEcsReplay.missingParentEntityKey",
              entityKey: "gltf:node:0",
              parentEntityKey: "gltf:missing",
            },
          ],
        },
      ],
      diagnostics: [
        {
          code: "gltfEcsReplay.missingParentEntityKey",
          entityKey: "gltf:node:0",
          parentEntityKey: "gltf:missing",
        },
      ],
    });
    expect(JSON.stringify(json)).not.toContain("entitiesByKey");
  });
});

function validPlan(): GltfEcsAuthoringCommandPlan {
  return {
    valid: true,
    sceneIndex: 0,
    rootEntityKeys: ["gltf:scene:0"],
    commands: [
      { type: "createEntity", entityKey: "gltf:scene:0", label: "Scene0" },
    ],
    dependencies: [],
    skipped: [],
    diagnostics: [],
  };
}

function missingParentPlan(): GltfEcsAuthoringCommandPlan {
  return {
    valid: true,
    sceneIndex: 0,
    rootEntityKeys: ["gltf:node:0"],
    commands: [
      { type: "createEntity", entityKey: "gltf:node:0", label: "Node0" },
      {
        type: "addComponent",
        entityKey: "gltf:node:0",
        component: "Parent",
        value: { parentEntityKey: "gltf:missing" },
      },
    ],
    dependencies: [],
    skipped: [],
    diagnostics: [],
  };
}
