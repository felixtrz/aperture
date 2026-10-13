import type { GltfTraversedNode } from "./gltf-scene-traversal.js";
import type { GltfEcsAuthoringCommand, GltfEcsAuthoringCommandPlanOptions, GltfEcsAuthoringDiagnostic, GltfSkippedEcsAuthoringEntry } from "./gltf-ecs-authoring-command-plan-types.js";
import { type GltfEcsMeshReadiness } from "./gltf-ecs-authoring-command-plan-primitive-readiness.js";
export { createGltfEcsMeshReadiness, type GltfEcsMeshReadiness, } from "./gltf-ecs-authoring-command-plan-primitive-readiness.js";
export declare function appendGltfEcsPrimitiveCommands(input: {
    readonly node: GltfTraversedNode;
    readonly options: GltfEcsAuthoringCommandPlanOptions;
    readonly commands: GltfEcsAuthoringCommand[];
    readonly diagnostics: GltfEcsAuthoringDiagnostic[];
    readonly skipped: GltfSkippedEcsAuthoringEntry[];
    readonly seenEntityKeys: Set<string>;
    readonly dependencies: Set<string>;
    readonly meshReadiness: GltfEcsMeshReadiness;
    readonly nodeEntityKeyByIndex: ReadonlyMap<number, string>;
}): void;
//# sourceMappingURL=gltf-ecs-authoring-command-plan-primitives.d.ts.map