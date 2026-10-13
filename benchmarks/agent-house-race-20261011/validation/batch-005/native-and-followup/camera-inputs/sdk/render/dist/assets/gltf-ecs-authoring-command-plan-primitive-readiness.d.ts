import type { GltfResolvedPrimitiveMaterial } from "./gltf-primitive-material-resolution.js";
import type { GltfEcsAuthoringCommandPlanOptions } from "./gltf-ecs-authoring-command-plan-types.js";
export interface GltfEcsMeshReadiness {
    readonly ready: ReadonlySet<string>;
    readonly skippedReasons: ReadonlyMap<string, string>;
}
export type GltfEcsMeshReadinessStatus = {
    readonly kind: "ready";
} | {
    readonly kind: "skipped";
    readonly reason: string;
} | {
    readonly kind: "missing";
};
export declare function createGltfEcsMeshReadiness(options: GltfEcsAuthoringCommandPlanOptions): GltfEcsMeshReadiness;
export declare function gltfEcsMeshReadinessStatus(readiness: GltfEcsMeshReadiness, material: GltfResolvedPrimitiveMaterial): GltfEcsMeshReadinessStatus;
//# sourceMappingURL=gltf-ecs-authoring-command-plan-primitive-readiness.d.ts.map