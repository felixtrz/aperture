import type { GltfRootValidationReportJsonValue } from "./gltf-root.js";

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
  readonly skinIndex: number | null;
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

export interface GltfSelectedScene {
  readonly sceneIndex: number;
  readonly scene: Record<string, unknown>;
}

export interface GltfSceneTraversalState {
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
