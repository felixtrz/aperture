import type { GltfNodeLocalTransform, GltfSceneTraversalReport, GltfTraversedNode } from "./gltf-scene-traversal.js";
import type { GltfEcsAuthoringCommand, GltfEcsAuthoringCommandPlan, GltfEcsAuthoringDiagnostic, GltfLocalTransformCommandValue, GltfSkippedEcsAuthoringEntry } from "./gltf-ecs-authoring-command-plan-types.js";
export declare function appendGltfEcsEntityCommands(input: {
    readonly commands: GltfEcsAuthoringCommand[];
    readonly diagnostics: GltfEcsAuthoringDiagnostic[];
    readonly seenEntityKeys: Set<string>;
    readonly entityKey: string;
    readonly label: string;
    readonly parentEntityKey: string | null;
    readonly localTransform: GltfLocalTransformCommandValue;
    readonly sceneIndex: number | null;
    readonly nodeIndex?: number;
}): boolean;
export declare function skipGltfEcsNodeByAncestor(input: {
    readonly node: GltfTraversedNode;
    readonly diagnostics: GltfEcsAuthoringDiagnostic[];
    readonly skipped: GltfSkippedEcsAuthoringEntry[];
    readonly skippedEntityKeys: Set<string>;
}): void;
export declare function gltfLocalTransformCommandValue(transform: GltfNodeLocalTransform | null): GltfLocalTransformCommandValue;
export declare function gltfIdentityLocalTransformCommandValue(): GltfLocalTransformCommandValue;
export declare function gltfSceneLabel(sceneIndex: number | null): string;
export declare function createGltfEcsAuthoringCommandPlanResult(traversalReport: GltfSceneTraversalReport, commands: readonly GltfEcsAuthoringCommand[], diagnostics: readonly GltfEcsAuthoringDiagnostic[], skipped: readonly GltfSkippedEcsAuthoringEntry[], dependencies: readonly string[]): GltfEcsAuthoringCommandPlan;
//# sourceMappingURL=gltf-ecs-authoring-command-plan-entities.d.ts.map