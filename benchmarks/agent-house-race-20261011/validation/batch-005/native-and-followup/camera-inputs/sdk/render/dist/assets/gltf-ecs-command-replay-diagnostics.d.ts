import type { GltfEcsAuthoringCommand } from "./gltf-ecs-authoring-command-plan.js";
import type { GltfEcsCommandReplayDiagnostic, GltfEcsCommandReplayDiagnosticCode, GltfSkippedEcsCommand } from "./gltf-ecs-command-replay-types.js";
export declare function skipGltfEcsReplayCommand(input: {
    readonly diagnostics: GltfEcsCommandReplayDiagnostic[];
    readonly skipped: GltfSkippedEcsCommand[];
    readonly commandIndex: number;
    readonly entityKey?: string;
    readonly component?: string;
    readonly code: GltfEcsCommandReplayDiagnosticCode;
    readonly message: string;
    readonly parentEntityKey?: string | null;
}): void;
export declare function skipInvalidGltfEcsReplayComponentValue(input: {
    readonly command: Extract<GltfEcsAuthoringCommand, {
        type: "addComponent";
    }>;
    readonly commandIndex: number;
    readonly diagnostics: GltfEcsCommandReplayDiagnostic[];
    readonly skipped: GltfSkippedEcsCommand[];
}, message: string): void;
//# sourceMappingURL=gltf-ecs-command-replay-diagnostics.d.ts.map