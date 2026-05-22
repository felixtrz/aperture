import { decomposeTrsMatrix } from "@aperture-engine/simulation";

import {
  gltfRootValidationReportToJsonValue,
  validateGltfRootForAssetMapping,
  type GltfRootValidationReportJsonValue,
} from "./gltf-root.js";

export type GltfSceneTraversalDiagnosticSeverity = "error" | "warning";

export type GltfSceneTraversalDiagnosticCode =
  | "gltfScene.malformedScenes"
  | "gltfScene.invalidSceneIndex"
  | "gltfScene.malformedScene"
  | "gltfScene.malformedSceneNodes"
  | "gltfScene.malformedNodes"
  | "gltfScene.invalidNodeIndex"
  | "gltfScene.malformedNode"
  | "gltfScene.malformedChildren"
  | "gltfScene.nodeCycle"
  | "gltfScene.nodeMultipleParents"
  | "gltfScene.malformedTransform"
  | "gltfScene.unsupportedMatrixDecomposition";

export type GltfSceneTraversalDiagnosticValue =
  | string
  | number
  | boolean
  | null;

export interface GltfSceneTraversalDiagnostic {
  readonly code: string;
  readonly severity: GltfSceneTraversalDiagnosticSeverity;
  readonly message: string;
  readonly sceneIndex?: number;
  readonly nodeIndex?: number;
  readonly parentNodeIndex?: number;
  readonly childNodeIndex?: number;
  readonly entityKey?: string;
  readonly field?: string;
  readonly value?: GltfSceneTraversalDiagnosticValue;
  readonly path?: readonly number[];
}

export interface GltfSceneTraversalOptions {
  readonly root: unknown;
  readonly sceneIndex?: number;
  readonly keyPrefix?: string;
}

export type GltfNodeLocalTransform = {
  readonly kind: "trs";
  readonly translation: readonly [number, number, number];
  readonly rotation: readonly [number, number, number, number];
  readonly scale: readonly [number, number, number];
};

export interface GltfTraversedNode {
  readonly nodeIndex: number;
  readonly entityKey: string;
  readonly parentEntityKey: string;
  readonly depth: number;
  readonly label: string;
  readonly localTransform: GltfNodeLocalTransform | null;
  readonly meshIndex: number | null;
  readonly childNodeIndices: readonly number[];
}

export interface GltfSceneTraversalReport {
  readonly valid: boolean;
  readonly root: GltfRootValidationReportJsonValue;
  readonly sceneIndex: number | null;
  readonly sceneEntityKey: string | null;
  readonly rootNodeKeys: readonly string[];
  readonly nodes: readonly GltfTraversedNode[];
  readonly diagnostics: readonly GltfSceneTraversalDiagnostic[];
}

export type GltfSceneTraversalReportJsonValue = GltfSceneTraversalReport;

interface SelectedScene {
  readonly sceneIndex: number;
  readonly scene: Record<string, unknown>;
}

interface TraversalState {
  readonly root: Record<string, unknown>;
  readonly nodesArray: readonly unknown[];
  readonly sceneIndex: number;
  readonly diagnostics: GltfSceneTraversalDiagnostic[];
  readonly traversed: GltfTraversedNode[];
  readonly parentByNode: Map<number, number | "scene">;
  readonly visiting: number[];
  readonly visited: Set<number>;
  readonly keyPrefix: string;
}

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

export function gltfSceneTraversalReportToJsonValue(
  report: GltfSceneTraversalReport,
): GltfSceneTraversalReportJsonValue {
  return {
    valid: report.valid,
    root: report.root,
    sceneIndex: report.sceneIndex,
    sceneEntityKey: report.sceneEntityKey,
    rootNodeKeys: [...report.rootNodeKeys],
    nodes: report.nodes.map((node) => ({
      ...node,
      childNodeIndices: [...node.childNodeIndices],
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      ...(diagnostic.path === undefined ? {} : { path: [...diagnostic.path] }),
    })),
  };
}

export function gltfSceneTraversalReportToJson(
  report: GltfSceneTraversalReport,
): string {
  return JSON.stringify(gltfSceneTraversalReportToJsonValue(report));
}

function selectScene(input: {
  readonly root: Record<string, unknown>;
  readonly sceneIndex: number | undefined;
  readonly diagnostics: GltfSceneTraversalDiagnostic[];
}): SelectedScene | null {
  const scenes = input.root.scenes;
  if (!Array.isArray(scenes)) {
    input.diagnostics.push({
      code: "gltfScene.malformedScenes",
      severity: "error",
      field: "scenes",
      value: toDiagnosticValue(scenes),
      message: "glTF scenes must be an array for scene traversal.",
    });
    return null;
  }

  const selectedIndex = chooseSceneIndex(input.root, scenes, input.sceneIndex);
  if (selectedIndex === null) {
    input.diagnostics.push({
      code: "gltfScene.invalidSceneIndex",
      severity: "error",
      field: input.sceneIndex === undefined ? "scene" : "sceneIndex",
      value: toDiagnosticValue(input.sceneIndex ?? input.root.scene),
      message: "No deterministic glTF scene could be selected for traversal.",
    });
    return null;
  }

  const scene = scenes[selectedIndex];
  if (!isRecord(scene)) {
    input.diagnostics.push({
      code: "gltfScene.malformedScene",
      severity: "error",
      sceneIndex: selectedIndex,
      field: `scenes[${selectedIndex}]`,
      value: toDiagnosticValue(scene),
      message: `glTF scene ${selectedIndex} must be an object.`,
    });
    return null;
  }

  return { sceneIndex: selectedIndex, scene };
}

function chooseSceneIndex(
  root: Record<string, unknown>,
  scenes: readonly unknown[],
  requestedSceneIndex: number | undefined,
): number | null {
  if (requestedSceneIndex !== undefined) {
    return validSceneIndex(scenes, requestedSceneIndex)
      ? requestedSceneIndex
      : null;
  }

  if (root.scene !== undefined) {
    return validSceneIndex(scenes, root.scene) ? root.scene : null;
  }

  return scenes.length === 1 ? 0 : null;
}

function validSceneIndex(
  scenes: readonly unknown[],
  sceneIndex: unknown,
): sceneIndex is number {
  return (
    Number.isInteger(sceneIndex) &&
    typeof sceneIndex === "number" &&
    sceneIndex >= 0 &&
    sceneIndex < scenes.length
  );
}

function sceneRootNodeIndices(input: {
  readonly scene: Record<string, unknown>;
  readonly sceneIndex: number;
  readonly diagnostics: GltfSceneTraversalDiagnostic[];
}): readonly unknown[] | null {
  const nodes = input.scene.nodes;
  if (nodes === undefined) {
    return [];
  }

  if (!Array.isArray(nodes)) {
    input.diagnostics.push({
      code: "gltfScene.malformedSceneNodes",
      severity: "error",
      sceneIndex: input.sceneIndex,
      field: `scenes[${input.sceneIndex}].nodes`,
      value: toDiagnosticValue(nodes),
      message: `glTF scene ${input.sceneIndex} nodes must be an array when present.`,
    });
    return null;
  }

  return nodes;
}

function nodeArray(
  root: Record<string, unknown>,
  diagnostics: GltfSceneTraversalDiagnostic[],
): readonly unknown[] | null {
  const nodes = root.nodes;
  if (!Array.isArray(nodes)) {
    diagnostics.push({
      code: "gltfScene.malformedNodes",
      severity: "error",
      field: "nodes",
      value: toDiagnosticValue(nodes),
      message: "glTF nodes must be an array for scene traversal.",
    });
    return null;
  }

  return nodes;
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

function readLocalTransform(input: {
  readonly state: TraversalState;
  readonly node: Record<string, unknown>;
  readonly nodeIndex: number;
  readonly entityKey: string;
}): GltfNodeLocalTransform | null {
  const hasMatrix = input.node.matrix !== undefined;
  const hasTrs =
    input.node.translation !== undefined ||
    input.node.rotation !== undefined ||
    input.node.scale !== undefined;

  if (hasMatrix && hasTrs) {
    input.state.diagnostics.push({
      code: "gltfScene.malformedTransform",
      severity: "error",
      sceneIndex: input.state.sceneIndex,
      nodeIndex: input.nodeIndex,
      entityKey: input.entityKey,
      field: `nodes[${input.nodeIndex}]`,
      message: `glTF node ${input.nodeIndex} cannot mix matrix and TRS transform fields.`,
    });
    return null;
  }

  if (hasMatrix) {
    const matrix = tuple16(input.node.matrix);
    if (matrix === null) {
      input.state.diagnostics.push({
        code: "gltfScene.malformedTransform",
        severity: "error",
        sceneIndex: input.state.sceneIndex,
        nodeIndex: input.nodeIndex,
        entityKey: input.entityKey,
        field: `nodes[${input.nodeIndex}].matrix`,
        value: toDiagnosticValue(input.node.matrix),
        message: `glTF node ${input.nodeIndex} matrix must contain 16 finite numbers.`,
      });
      return null;
    }

    const decomposed = decomposeTrsMatrix(matrix);
    if (decomposed === null) {
      input.state.diagnostics.push({
        code: "gltfScene.unsupportedMatrixDecomposition",
        severity: "error",
        sceneIndex: input.state.sceneIndex,
        nodeIndex: input.nodeIndex,
        entityKey: input.entityKey,
        field: `nodes[${input.nodeIndex}].matrix`,
        message: `glTF node ${input.nodeIndex} matrix must be decomposable to an affine TRS transform.`,
      });
      return null;
    }

    return {
      kind: "trs",
      translation: tuple3FromArray(decomposed.translation),
      rotation: tuple4FromArray(decomposed.rotation),
      scale: tuple3FromArray(decomposed.scale),
    };
  }

  const translation = tuple3(input.node.translation, [0, 0, 0]);
  const rotation = tuple4(input.node.rotation, [0, 0, 0, 1]);
  const scale = tuple3(input.node.scale, [1, 1, 1]);
  if (translation === null || rotation === null || scale === null) {
    input.state.diagnostics.push({
      code: "gltfScene.malformedTransform",
      severity: "error",
      sceneIndex: input.state.sceneIndex,
      nodeIndex: input.nodeIndex,
      entityKey: input.entityKey,
      field: `nodes[${input.nodeIndex}]`,
      message: `glTF node ${input.nodeIndex} TRS transform fields must be finite numeric tuples.`,
    });
    return null;
  }

  return { kind: "trs", translation, rotation, scale };
}

function validNodeReference(
  nodes: readonly unknown[],
  nodeIndex: unknown,
): nodeIndex is number {
  return (
    Number.isInteger(nodeIndex) &&
    typeof nodeIndex === "number" &&
    nodeIndex >= 0 &&
    nodeIndex < nodes.length
  );
}

function mapOptionalIndex(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : null;
}

function sceneKey(
  options: Pick<GltfSceneTraversalOptions, "keyPrefix">,
  sceneIndex: number,
): string {
  return `${options.keyPrefix ?? "gltf"}:scene:${sceneIndex}`;
}

function nodeKey(keyPrefix: string, nodeIndex: number): string {
  return `${keyPrefix}:node:${nodeIndex}`;
}

function result(input: {
  readonly root: GltfRootValidationReportJsonValue;
  readonly diagnostics: readonly GltfSceneTraversalDiagnostic[];
  readonly sceneIndex: number | null;
  readonly sceneEntityKey: string | null;
  readonly rootNodeKeys: readonly string[];
  readonly nodes: readonly GltfTraversedNode[];
}): GltfSceneTraversalReport {
  return {
    valid: input.diagnostics.every(
      (diagnostic) => diagnostic.severity !== "error",
    ),
    root: input.root,
    sceneIndex: input.sceneIndex,
    sceneEntityKey: input.sceneEntityKey,
    rootNodeKeys: input.rootNodeKeys,
    nodes: input.nodes,
    diagnostics: input.diagnostics,
  };
}

function tuple3(
  value: unknown,
  fallback: readonly [number, number, number],
): readonly [number, number, number] | null {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every(isFiniteNumber)
  ) {
    return null;
  }

  return [value[0] as number, value[1] as number, value[2] as number];
}

function tuple4(
  value: unknown,
  fallback: readonly [number, number, number, number],
): readonly [number, number, number, number] | null {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    !value.every(isFiniteNumber)
  ) {
    return null;
  }

  return [
    value[0] as number,
    value[1] as number,
    value[2] as number,
    value[3] as number,
  ];
}

function tuple16(
  value: unknown,
):
  | readonly [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ]
  | null {
  if (
    !Array.isArray(value) ||
    value.length !== 16 ||
    !value.every(isFiniteNumber)
  ) {
    return null;
  }

  return [
    value[0] as number,
    value[1] as number,
    value[2] as number,
    value[3] as number,
    value[4] as number,
    value[5] as number,
    value[6] as number,
    value[7] as number,
    value[8] as number,
    value[9] as number,
    value[10] as number,
    value[11] as number,
    value[12] as number,
    value[13] as number,
    value[14] as number,
    value[15] as number,
  ];
}

function tuple3FromArray(
  value: ArrayLike<number>,
): readonly [number, number, number] {
  return [
    readArrayNumber(value, 0),
    readArrayNumber(value, 1),
    readArrayNumber(value, 2),
  ];
}

function tuple4FromArray(
  value: ArrayLike<number>,
): readonly [number, number, number, number] {
  return [
    readArrayNumber(value, 0),
    readArrayNumber(value, 1),
    readArrayNumber(value, 2),
    readArrayNumber(value, 3),
  ];
}

function readArrayNumber(value: ArrayLike<number>, index: number): number {
  const item = value[index];

  if (item === undefined) {
    throw new RangeError(`Expected numeric value at index ${index}.`);
  }

  return item;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDiagnosticValue(value: unknown): GltfSceneTraversalDiagnosticValue {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      return Number.isFinite(value) ? value : String(value);
    case "undefined":
      return "undefined";
    case "bigint":
    case "symbol":
    case "function":
    case "object":
      return Object.prototype.toString.call(value);
  }

  return String(value);
}
