import type { GltfSceneTraversalDiagnostic, GltfSelectedScene } from "./gltf-scene-traversal-types.js";
export declare function selectScene(input: {
    readonly root: Record<string, unknown>;
    readonly sceneIndex: number | undefined;
    readonly diagnostics: GltfSceneTraversalDiagnostic[];
}): GltfSelectedScene | null;
export declare function sceneRootNodeIndices(input: {
    readonly scene: Record<string, unknown>;
    readonly sceneIndex: number;
    readonly diagnostics: GltfSceneTraversalDiagnostic[];
}): readonly unknown[] | null;
export declare function nodeArray(root: Record<string, unknown>, diagnostics: GltfSceneTraversalDiagnostic[]): readonly unknown[] | null;
//# sourceMappingURL=gltf-scene-traversal-selection.d.ts.map