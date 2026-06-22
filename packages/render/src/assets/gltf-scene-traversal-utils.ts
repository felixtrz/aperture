import type {
  GltfSceneTraversalDiagnostic,
  GltfSceneTraversalDiagnosticValue,
  GltfSceneTraversalOptions,
  GltfSceneTraversalReport,
  GltfTraversedNode,
} from "./gltf-scene-traversal-types.js";
import type { GltfRootValidationReportJsonValue } from "./gltf-root.js";

export function validNodeReference(
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

export function mapOptionalIndex(value: unknown): number | null {
  return Number.isInteger(value) && typeof value === "number" && value >= 0
    ? value
    : null;
}

export function sceneKey(
  options: Pick<GltfSceneTraversalOptions, "keyPrefix">,
  sceneIndex: number,
): string {
  return `${options.keyPrefix ?? "gltf"}:scene:${sceneIndex}`;
}

export function nodeKey(keyPrefix: string, nodeIndex: number): string {
  return `${keyPrefix}:node:${nodeIndex}`;
}

export function createGltfSceneTraversalResult(input: {
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toDiagnosticValue(
  value: unknown,
): GltfSceneTraversalDiagnosticValue {
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
