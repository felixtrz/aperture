import type { GltfSceneTraversalDiagnostic, GltfSceneTraversalDiagnosticValue, GltfSceneTraversalOptions, GltfSceneTraversalReport, GltfTraversedNode } from "./gltf-scene-traversal-types.js";
import type { GltfRootValidationReportJsonValue } from "./gltf-root.js";
export declare function validNodeReference(nodes: readonly unknown[], nodeIndex: unknown): nodeIndex is number;
export declare function mapOptionalIndex(value: unknown): number | null;
export declare function sceneKey(options: Pick<GltfSceneTraversalOptions, "keyPrefix">, sceneIndex: number): string;
export declare function nodeKey(keyPrefix: string, nodeIndex: number): string;
export declare function createGltfSceneTraversalResult(input: {
    readonly root: GltfRootValidationReportJsonValue;
    readonly diagnostics: readonly GltfSceneTraversalDiagnostic[];
    readonly sceneIndex: number | null;
    readonly sceneEntityKey: string | null;
    readonly rootNodeKeys: readonly string[];
    readonly nodes: readonly GltfTraversedNode[];
}): GltfSceneTraversalReport;
export declare function isRecord(value: unknown): value is Record<string, unknown>;
export declare function toDiagnosticValue(value: unknown): GltfSceneTraversalDiagnosticValue;
//# sourceMappingURL=gltf-scene-traversal-utils.d.ts.map