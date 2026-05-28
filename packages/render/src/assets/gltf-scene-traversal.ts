import {
  gltfRootValidationReportToJsonValue,
  validateGltfRootForAssetMapping,
} from "./gltf-root.js";
import {
  nodeArray,
  sceneRootNodeIndices,
  selectScene,
} from "./gltf-scene-traversal-selection.js";
import { readLocalTransform } from "./gltf-scene-traversal-transforms.js";
import type {
  GltfSceneTraversalDiagnostic,
  GltfSceneTraversalOptions,
  GltfSceneTraversalReport,
  GltfSceneTraversalState as TraversalState,
} from "./gltf-scene-traversal-types.js";
import {
  createGltfSceneTraversalResult as result,
  isRecord,
  mapOptionalIndex,
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
    traverseNode({
      state,
      nodeIndex,
      parentEntityKey: sceneEntityKey,
      parentNodeIndex: null,
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

function traverseNode(input: {
  readonly state: TraversalState;
  readonly nodeIndex: number;
  readonly parentEntityKey: string;
  readonly parentNodeIndex: number | null;
  readonly parentMarker: number | "scene";
  readonly depth: number;
}): void {
  const cycleStart = input.state.visiting.indexOf(input.nodeIndex);
  if (cycleStart !== -1) {
    const path = [...input.state.visiting.slice(cycleStart), input.nodeIndex];
    input.state.diagnostics.push({
      code: "gltfScene.nodeCycle",
      severity: "error",
      sceneIndex: input.state.sceneIndex,
      nodeIndex: input.nodeIndex,
      entityKey: nodeKey(input.state.keyPrefix, input.nodeIndex),
      path,
      message: `glTF scene ${input.state.sceneIndex} contains a node cycle: ${path.join(" -> ")}.`,
    });
    return;
  }

  const existingParent = input.state.parentByNode.get(input.nodeIndex);
  if (existingParent !== undefined && existingParent !== input.parentMarker) {
    input.state.diagnostics.push({
      code: "gltfScene.nodeMultipleParents",
      severity: "error",
      sceneIndex: input.state.sceneIndex,
      nodeIndex: input.nodeIndex,
      ...(typeof input.parentMarker === "number"
        ? { parentNodeIndex: input.parentMarker }
        : {}),
      entityKey: nodeKey(input.state.keyPrefix, input.nodeIndex),
      message: `glTF node ${input.nodeIndex} has multiple parents in selected scene ${input.state.sceneIndex}.`,
    });
    return;
  }

  if (input.state.visited.has(input.nodeIndex)) {
    return;
  }

  input.state.parentByNode.set(input.nodeIndex, input.parentMarker);
  const rawNode = input.state.nodesArray[input.nodeIndex];
  if (!isRecord(rawNode)) {
    input.state.diagnostics.push({
      code: "gltfScene.malformedNode",
      severity: "error",
      sceneIndex: input.state.sceneIndex,
      nodeIndex: input.nodeIndex,
      field: `nodes[${input.nodeIndex}]`,
      value: toDiagnosticValue(rawNode),
      message: `glTF node ${input.nodeIndex} must be an object.`,
    });
    return;
  }

  const childNodeIndices = readChildNodeIndices({
    state: input.state,
    node: rawNode,
    nodeIndex: input.nodeIndex,
  });
  const entityKey = nodeKey(input.state.keyPrefix, input.nodeIndex);
  input.state.traversed.push({
    nodeIndex: input.nodeIndex,
    entityKey,
    parentEntityKey: input.parentEntityKey,
    depth: input.depth,
    label:
      typeof rawNode.name === "string" && rawNode.name.length > 0
        ? rawNode.name
        : `Node${input.nodeIndex}`,
    localTransform: readLocalTransform({
      state: input.state,
      node: rawNode,
      nodeIndex: input.nodeIndex,
      entityKey,
    }),
    meshIndex: mapOptionalIndex(rawNode.mesh),
    childNodeIndices,
  });

  input.state.visiting.push(input.nodeIndex);
  for (const childNodeIndex of childNodeIndices) {
    if (!validNodeReference(input.state.nodesArray, childNodeIndex)) {
      input.state.diagnostics.push({
        code: "gltfScene.invalidNodeIndex",
        severity: "error",
        sceneIndex: input.state.sceneIndex,
        nodeIndex: input.nodeIndex,
        childNodeIndex,
        field: `nodes[${input.nodeIndex}].children`,
        value: childNodeIndex,
        message: `glTF node ${input.nodeIndex} references invalid child node ${childNodeIndex}.`,
      });
      continue;
    }

    traverseNode({
      state: input.state,
      nodeIndex: childNodeIndex,
      parentEntityKey: entityKey,
      parentNodeIndex: input.nodeIndex,
      parentMarker: input.nodeIndex,
      depth: input.depth + 1,
    });
  }
  input.state.visiting.pop();
  input.state.visited.add(input.nodeIndex);
}

function readChildNodeIndices(input: {
  readonly state: TraversalState;
  readonly node: Record<string, unknown>;
  readonly nodeIndex: number;
}): readonly number[] {
  const children = input.node.children;
  if (children === undefined) {
    return [];
  }

  if (!Array.isArray(children)) {
    input.state.diagnostics.push({
      code: "gltfScene.malformedChildren",
      severity: "error",
      sceneIndex: input.state.sceneIndex,
      nodeIndex: input.nodeIndex,
      field: `nodes[${input.nodeIndex}].children`,
      value: toDiagnosticValue(children),
      message: `glTF node ${input.nodeIndex} children must be an array when present.`,
    });
    return [];
  }

  const childNodeIndices: number[] = [];
  for (const child of children) {
    if (!Number.isInteger(child) || typeof child !== "number" || child < 0) {
      input.state.diagnostics.push({
        code: "gltfScene.invalidNodeIndex",
        severity: "error",
        sceneIndex: input.state.sceneIndex,
        nodeIndex: input.nodeIndex,
        field: `nodes[${input.nodeIndex}].children`,
        value: toDiagnosticValue(child),
        message: `glTF node ${input.nodeIndex} has an invalid child node reference '${String(child)}'.`,
      });
      continue;
    }
    childNodeIndices.push(child);
  }

  return childNodeIndices;
}
