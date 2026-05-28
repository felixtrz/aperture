import { decomposeTrsMatrix } from "@aperture-engine/simulation";
import type {
  GltfNodeLocalTransform,
  GltfSceneTraversalState,
} from "./gltf-scene-traversal-types.js";
import { toDiagnosticValue } from "./gltf-scene-traversal-utils.js";

export function readLocalTransform(input: {
  readonly state: GltfSceneTraversalState;
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
