import type { GltfNodeLocalTransform, GltfSceneTraversalState } from "./gltf-scene-traversal-types.js";
export declare function readLocalTransform(input: {
    readonly state: GltfSceneTraversalState;
    readonly node: Record<string, unknown>;
    readonly nodeIndex: number;
    readonly entityKey: string;
}): GltfNodeLocalTransform | null;
//# sourceMappingURL=gltf-scene-traversal-transforms.d.ts.map