import { describe, expect, it } from "vitest";

import { createGltfSceneTraversalReport } from "@aperture-engine/core";

describe("glTF scene traversal report", () => {
  it("plans deterministic scene and node entity keys without ECS mutation", () => {
    const report = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [
          {
            name: "Root",
            translation: [1, 2, 3],
            children: [1],
          },
          {
            name: "Child",
            rotation: [0, 0, 0, 1],
            scale: [2, 2, 2],
            mesh: 4,
          },
        ],
      },
    });

    expect(report.valid).toBe(true);
    expect(report.sceneIndex).toBe(0);
    expect(report.sceneEntityKey).toBe("gltf:scene:0");
    expect(report.rootNodeKeys).toEqual(["gltf:node:0"]);
    expect(report.diagnostics).toEqual([]);
    expect(report.nodes).toMatchObject([
      {
        nodeIndex: 0,
        entityKey: "gltf:node:0",
        parentEntityKey: "gltf:scene:0",
        depth: 0,
        label: "Root",
        localTransform: {
          kind: "trs",
          translation: [1, 2, 3],
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
        label: "Child",
        localTransform: {
          kind: "trs",
          translation: [0, 0, 0],
          rotation: [0, 0, 0, 1],
          scale: [2, 2, 2],
        },
        meshIndex: 4,
        childNodeIndices: [],
      },
    ]);
  });

  it("reports invalid scene indices", () => {
    const report = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [] }],
        nodes: [],
      },
      sceneIndex: 2,
    });

    expect(report.valid).toBe(false);
    expect(report.sceneIndex).toBeNull();
    expect(report.diagnostics).toMatchObject([
      {
        code: "gltfScene.invalidSceneIndex",
        severity: "error",
        field: "sceneIndex",
      },
    ]);
  });

  it("reports invalid node references and cycles", () => {
    const invalidChild = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }],
        nodes: [{ children: [2] }],
      },
    });
    const cycle = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }],
        nodes: [{ children: [1] }, { children: [0] }],
      },
    });

    expect(invalidChild.valid).toBe(false);
    expect(invalidChild.diagnostics).toMatchObject([
      {
        code: "gltfScene.invalidNodeIndex",
        severity: "error",
        nodeIndex: 0,
        childNodeIndex: 2,
      },
    ]);
    expect(cycle.valid).toBe(false);
    expect(cycle.diagnostics).toMatchObject([
      {
        code: "gltfScene.nodeCycle",
        severity: "error",
        path: [0, 1, 0],
      },
    ]);
  });

  it("reports malformed transforms and deferred matrix decomposition", () => {
    const malformed = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }],
        nodes: [{ translation: [1, 2] }],
      },
    });
    const matrix = createGltfSceneTraversalReport({
      root: {
        asset: { version: "2.0" },
        scenes: [{ nodes: [0] }],
        nodes: [
          {
            matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 4, 5, 6, 1],
          },
        ],
      },
    });

    expect(malformed.valid).toBe(false);
    expect(malformed.nodes[0]).toMatchObject({ localTransform: null });
    expect(malformed.diagnostics).toMatchObject([
      {
        code: "gltfScene.malformedTransform",
        severity: "error",
        nodeIndex: 0,
      },
    ]);
    expect(matrix.valid).toBe(true);
    expect(matrix.nodes[0]).toMatchObject({
      localTransform: {
        kind: "matrix",
        decomposed: false,
      },
    });
    expect(matrix.diagnostics).toMatchObject([
      {
        code: "gltfScene.unsupportedMatrixDecomposition",
        severity: "warning",
        nodeIndex: 0,
      },
    ]);
  });
});
