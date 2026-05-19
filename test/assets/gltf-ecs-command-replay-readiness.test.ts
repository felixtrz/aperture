import { describe, expect, it } from "vitest";

import {
  createGltfEcsReplayReadinessSummaryJsonValue,
  type GltfEcsAuthoringCommandPlan,
} from "@aperture-engine/render";

describe("glTF ECS command replay readiness", () => {
  it("reports absent readiness without requiring a live world", () => {
    expect(createGltfEcsReplayReadinessSummaryJsonValue(null)).toEqual({
      status: "absent",
      ready: null,
      reason: "No ECS command plan was provided.",
      requiredWorld: true,
      wouldRegisterComponents: true,
      expectedCreateEntityCount: 0,
      expectedAddComponentCount: 0,
      requiredComponents: [],
      blockerCount: 0,
      blockers: [],
    });
  });

  it("reports ready command plans with aggregate component requirements", () => {
    const summary = createGltfEcsReplayReadinessSummaryJsonValue(validPlan(), {
      registerComponents: false,
    });
    const serialized = JSON.stringify(summary);

    expect(summary).toEqual({
      status: "ready",
      ready: true,
      reason: null,
      requiredWorld: true,
      wouldRegisterComponents: false,
      expectedCreateEntityCount: 2,
      expectedAddComponentCount: 3,
      requiredComponents: ["Name", "Parent", "Mesh"],
      blockerCount: 0,
      blockers: [],
    });
    expect(serialized).not.toContain("entityKey");
    expect(serialized).not.toContain("Scene0");
    expect(serialized).not.toContain("entitiesByKey");
    expect(serialized).not.toContain("GPU");
  });

  it("blocks invalid command plans", () => {
    const summary = createGltfEcsReplayReadinessSummaryJsonValue({
      ...validPlan(),
      valid: false,
    });

    expect(summary).toMatchObject({
      status: "blocked",
      ready: false,
      blockerCount: 1,
      blockers: [
        {
          code: "gltfEcsReplayReadiness.invalidPlan",
          count: 1,
        },
      ],
    });
  });

  it("blocks duplicate entity creation", () => {
    const summary = createGltfEcsReplayReadinessSummaryJsonValue({
      ...validPlan(),
      commands: [
        { type: "createEntity", entityKey: "gltf:node:0", label: "First" },
        { type: "createEntity", entityKey: "gltf:node:0", label: "Second" },
      ],
    });

    expect(summary).toMatchObject({
      status: "blocked",
      blockerCount: 1,
      blockers: [
        {
          code: "gltfEcsReplayReadiness.duplicateEntityKey",
          count: 1,
        },
      ],
    });
  });

  it("blocks addComponent commands for uncreated entities", () => {
    const summary = createGltfEcsReplayReadinessSummaryJsonValue({
      ...validPlan(),
      commands: [
        {
          type: "addComponent",
          entityKey: "gltf:missing",
          component: "Name",
          value: { value: "Missing" },
        },
      ],
    });

    expect(summary).toMatchObject({
      status: "blocked",
      expectedCreateEntityCount: 0,
      expectedAddComponentCount: 1,
      requiredComponents: ["Name"],
      blockerCount: 1,
      blockers: [
        {
          code: "gltfEcsReplayReadiness.missingEntityKey",
          count: 1,
        },
      ],
    });
  });

  it("blocks parent references to uncreated entities", () => {
    const summary = createGltfEcsReplayReadinessSummaryJsonValue({
      ...validPlan(),
      commands: [
        { type: "createEntity", entityKey: "gltf:node:0", label: "Node" },
        {
          type: "addComponent",
          entityKey: "gltf:node:0",
          component: "Parent",
          value: { parentEntityKey: "gltf:missing" },
        },
      ],
    });

    expect(summary).toMatchObject({
      status: "blocked",
      requiredComponents: ["Parent"],
      blockerCount: 1,
      blockers: [
        {
          code: "gltfEcsReplayReadiness.missingParentEntityKey",
          count: 1,
        },
      ],
    });
  });

  it("blocks unsupported component names without exposing command payloads", () => {
    const summary = createGltfEcsReplayReadinessSummaryJsonValue({
      ...validPlan(),
      commands: [
        { type: "createEntity", entityKey: "gltf:node:0", label: "Node" },
        {
          type: "addComponent",
          entityKey: "gltf:node:0",
          component: "UnsupportedComponent",
          value: { secretPayload: true },
        },
      ],
    } as unknown as GltfEcsAuthoringCommandPlan);
    const serialized = JSON.stringify(summary);

    expect(summary).toMatchObject({
      status: "blocked",
      requiredComponents: [],
      blockerCount: 1,
      blockers: [
        {
          code: "gltfEcsReplayReadiness.unknownComponent",
          count: 1,
        },
      ],
    });
    expect(serialized).not.toContain("UnsupportedComponent");
    expect(serialized).not.toContain("secretPayload");
    expect(serialized).not.toContain("entityKey");
  });
});

function validPlan(): GltfEcsAuthoringCommandPlan {
  return {
    valid: true,
    sceneIndex: 0,
    rootEntityKeys: ["gltf:scene:0"],
    commands: [
      { type: "createEntity", entityKey: "gltf:scene:0", label: "Scene0" },
      { type: "createEntity", entityKey: "gltf:node:0", label: "Node0" },
      {
        type: "addComponent",
        entityKey: "gltf:scene:0",
        component: "Name",
        value: { value: "Scene0" },
      },
      {
        type: "addComponent",
        entityKey: "gltf:node:0",
        component: "Parent",
        value: { parentEntityKey: "gltf:scene:0" },
      },
      {
        type: "addComponent",
        entityKey: "gltf:node:0",
        component: "Mesh",
        value: {
          meshId: "gltf:mesh:0:primitive:0",
          handleKey: "mesh:gltf:mesh:0:primitive:0",
        },
      },
    ],
    dependencies: ["mesh:gltf:mesh:0:primitive:0"],
    skipped: [],
    diagnostics: [],
  };
}
