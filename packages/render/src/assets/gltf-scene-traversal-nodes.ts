import { readLocalTransform } from "./gltf-scene-traversal-transforms.js";
import type { GltfSceneTraversalState as TraversalState } from "./gltf-scene-traversal-types.js";
import {
  isRecord,
  mapOptionalIndex,
  nodeKey,
  toDiagnosticValue,
  validNodeReference,
} from "./gltf-scene-traversal-utils.js";

export function traverseGltfSceneNode(input: {
  readonly state: TraversalState;
  readonly nodeIndex: number;
  readonly parentEntityKey: string;
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

    traverseGltfSceneNode({
      state: input.state,
      nodeIndex: childNodeIndex,
      parentEntityKey: entityKey,
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
