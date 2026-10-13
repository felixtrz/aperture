import type { GltfSceneTraversalState as TraversalState } from "./gltf-scene-traversal-types.js";
export declare function traverseGltfSceneNode(input: {
    readonly state: TraversalState;
    readonly nodeIndex: number;
    readonly parentEntityKey: string;
    readonly parentMarker: number | "scene";
    readonly depth: number;
}): void;
//# sourceMappingURL=gltf-scene-traversal-nodes.d.ts.map