import type { GltfTraversedNode } from "./gltf-scene-traversal.js";
import type { GltfResolvedPrimitiveMaterial, GltfUnresolvedPrimitiveMaterial } from "./gltf-primitive-material-resolution.js";
import type { GltfEcsAuthoringDiagnostic, GltfSkippedEcsAuthoringEntry } from "./gltf-ecs-authoring-command-plan-types.js";
import type { GltfEcsMeshReadinessStatus } from "./gltf-ecs-authoring-command-plan-primitive-readiness.js";
export declare function skipGltfEcsMissingPrimitiveMaterialResolution(input: {
    readonly node: GltfTraversedNode;
    readonly meshIndex: number;
    readonly diagnostics: GltfEcsAuthoringDiagnostic[];
    readonly skipped: GltfSkippedEcsAuthoringEntry[];
}): void;
export declare function skipGltfEcsMeshNotReady(input: {
    readonly node: GltfTraversedNode;
    readonly material: GltfResolvedPrimitiveMaterial;
    readonly meshStatus: Exclude<GltfEcsMeshReadinessStatus, {
        readonly kind: "ready";
    }>;
    readonly diagnostics: GltfEcsAuthoringDiagnostic[];
    readonly skipped: GltfSkippedEcsAuthoringEntry[];
}): void;
export declare function skipGltfEcsUnresolvedPrimitiveMaterial(input: {
    readonly node: GltfTraversedNode;
    readonly unresolved: GltfUnresolvedPrimitiveMaterial;
    readonly diagnostics: GltfEcsAuthoringDiagnostic[];
    readonly skipped: GltfSkippedEcsAuthoringEntry[];
}): void;
export declare function gltfEcsPrimitiveEntityKey(node: GltfTraversedNode, primitive: {
    readonly meshIndex: number;
    readonly primitiveIndex: number;
}): string;
//# sourceMappingURL=gltf-ecs-authoring-command-plan-primitive-skips.d.ts.map