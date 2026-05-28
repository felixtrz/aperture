import {
  gltfRootValidationReportToJsonValue,
  validateGltfRootForAssetMapping,
} from "./gltf-root.js";
import {
  nodeArray,
  sceneRootNodeIndices,
  selectScene,
} from "./gltf-scene-traversal-selection.js";
import { traverseGltfSceneNode } from "./gltf-scene-traversal-nodes.js";
import type {
  GltfSceneTraversalDiagnostic,
  GltfSceneTraversalOptions,
  GltfSceneTraversalReport,
  GltfSceneTraversalState as TraversalState,
} from "./gltf-scene-traversal-types.js";
import {
  createGltfSceneTraversalResult as result,
  isRecord,
  nodeKey,
  sceneKey,
  toDiagnosticValue,
  validNodeReference,
} from "./gltf-scene-traversal-utils.js";

export {
  gltfSceneTraversalReportToJson,
  gltfSceneTraversalReportToJsonValue,
} from "./gltf-scene-traversal-report.js";
export type {
  GltfNodeLocalTransform,
  GltfSceneTraversalDiagnostic,
  GltfSceneTraversalDiagnosticCode,
  GltfSceneTraversalDiagnosticSeverity,
  GltfSceneTraversalDiagnosticValue,
  GltfSceneTraversalOptions,
  GltfSceneTraversalReport,
  GltfSceneTraversalReportJsonValue,
  GltfTraversedNode,
} from "./gltf-scene-traversal-types.js";

export function createGltfSceneTraversalReport(
  options: GltfSceneTraversalOptions,
): GltfSceneTraversalReport {
  const rootValidation = validateGltfRootForAssetMapping(options.root);
  const root = gltfRootValidationReportToJsonValue(rootValidation);
  const diagnostics: GltfSceneTraversalDiagnostic[] =
    rootValidation.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      ...(diagnostic.field === undefined ? {} : { field: diagnostic.field }),
      ...(diagnostic.value === undefined ? {} : { value: diagnostic.value }),
    }));

  if (!isRecord(options.root)) {
    return result({
      root,
      diagnostics,
      sceneIndex: null,
      sceneEntityKey: null,
      rootNodeKeys: [],
      nodes: [],
    });
  }

  const selected = selectScene({
    root: options.root,
    sceneIndex: options.sceneIndex,
    diagnostics,
  });
  if (selected === null) {
    return result({
      root,
      diagnostics,
      sceneIndex: null,
      sceneEntityKey: null,
      rootNodeKeys: [],
      nodes: [],
    });
  }

  const sceneEntityKey = sceneKey(options, selected.sceneIndex);
  const sceneNodeIndices = sceneRootNodeIndices({
    scene: selected.scene,
    sceneIndex: selected.sceneIndex,
    diagnostics,
  });
  const nodesArray = nodeArray(options.root, diagnostics);
  if (sceneNodeIndices === null || nodesArray === null) {
    return result({
      root,
      diagnostics,
      sceneIndex: selected.sceneIndex,
      sceneEntityKey,
      rootNodeKeys: [],
      nodes: [],
    });
  }

  const state: TraversalState = {
    root: options.root,
    nodesArray,
    sceneIndex: selected.sceneIndex,
    diagnostics,
    traversed: [],
    parentByNode: new Map(),
    visiting: [],
    visited: new Set(),
    keyPrefix: options.keyPrefix ?? "gltf",
  };

  const rootNodeKeys: string[] = [];
  for (const nodeIndex of sceneNodeIndices) {
    if (!validNodeReference(nodesArray, nodeIndex)) {
      diagnostics.push({
        code: "gltfScene.invalidNodeIndex",
        severity: "error",
        sceneIndex: selected.sceneIndex,
        ...(typeof nodeIndex === "number" ? { childNodeIndex: nodeIndex } : {}),
        field: `scenes[${selected.sceneIndex}].nodes`,
        value: toDiagnosticValue(nodeIndex),
        message: `glTF scene ${selected.sceneIndex} references invalid root node '${String(nodeIndex)}'.`,
      });
      continue;
    }

    rootNodeKeys.push(nodeKey(state.keyPrefix, nodeIndex));
    traverseGltfSceneNode({
      state,
      nodeIndex,
      parentEntityKey: sceneEntityKey,
      parentMarker: "scene",
      depth: 0,
    });
  }

  return result({
    root,
    diagnostics,
    sceneIndex: selected.sceneIndex,
    sceneEntityKey,
    rootNodeKeys,
    nodes: state.traversed,
  });
}
