import { describe, expect, it } from "vitest";
import {
  createGltfSceneTraversalReport,
  gltfSceneTraversalReportToJson,
  gltfSceneTraversalReportToJsonValue,
} from "@aperture-engine/render";

describe("glTF scene traversal report JSON", () => {
  it("preserves scene keys, node keys, transforms, and diagnostics", () => {
    const report = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }],
        nodes: [
          {
            name: "MatrixRoot",
            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1],
            children: [1],
          },
          {
            name: "Leaf",
            translation: [1, 2, 3],
            rotation: [0, 0, 0, 1],
            scale: [1, 2, 3],
          },
        ],
      },
    });

    expect(gltfSceneTraversalReportToJsonValue(report)).toEqual({
      valid: true,
      root: { valid: true, diagnostics: [] },
      sceneIndex: 0,
      sceneEntityKey: "gltf:scene:0",
      rootNodeKeys: ["gltf:node:0"],
      nodes: [
        {
          nodeIndex: 0,
          entityKey: "gltf:node:0",
          parentEntityKey: "gltf:scene:0",
          depth: 0,
          label: "MatrixRoot",
          localTransform: {
            kind: "trs",
            translation: [7, 8, 9],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          meshIndex: null,
          childNodeIndices: [1],
        },
        {
          nodeIndex: 1,
          entityKey: "gltf:node:1",
          parentEntityKey: "gltf:node:0",
          depth: 1,
          label: "Leaf",
          localTransform: {
            kind: "trs",
            translation: [1, 2, 3],
            rotation: [0, 0, 0, 1],
            scale: [1, 2, 3],
          },
          meshIndex: null,
          childNodeIndices: [],
        },
      ],
      diagnostics: [],
    });
    expect(JSON.parse(gltfSceneTraversalReportToJson(report))).toEqual(
      gltfSceneTraversalReportToJsonValue(report),
    );
  });

  it("keeps traversal diagnostics JSON-safe", () => {
    const report = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }],
        nodes: [{ children: [1] }, { children: [0] }],
      },
    });
    const json = gltfSceneTraversalReportToJsonValue(report);

    expect(json.valid).toBe(false);
    expect(json.diagnostics).toMatchObject([
      {
        code: "gltfScene.nodeCycle",
        severity: "error",
        path: [0, 1, 0],
      },
    ]);
    expect(JSON.stringify(json)).not.toContain("EcsWorld");
    expect(JSON.stringify(json)).not.toContain("GPU");
    expect(JSON.stringify(json)).not.toContain("addComponent");
    expect(JSON.stringify(json)).not.toContain("vertexStreams");
  });
});
