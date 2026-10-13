import { type Entity } from "@aperture-engine/simulation";
import type { GltfEcsCommandReplayDiagnostic, GltfSkippedEcsCommand } from "./gltf-ecs-command-replay-types.js";
import type { GltfEcsAuthoringCommand } from "./gltf-ecs-authoring-command-plan.js";
export declare function applyGltfEcsReplayComponent(input: {
    readonly entity: Entity;
    readonly command: Extract<GltfEcsAuthoringCommand, {
        type: "addComponent";
    }>;
    readonly commandIndex: number;
    readonly entitiesByKey: ReadonlyMap<string, Entity>;
    readonly diagnostics: GltfEcsCommandReplayDiagnostic[];
    readonly skipped: GltfSkippedEcsCommand[];
}): boolean;
//# sourceMappingURL=gltf-ecs-command-replay-components.d.ts.map