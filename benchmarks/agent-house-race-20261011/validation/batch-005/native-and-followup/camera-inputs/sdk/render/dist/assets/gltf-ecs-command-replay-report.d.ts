import type { Entity } from "@aperture-engine/simulation";
import type { GltfAppliedEcsComponent, GltfCreatedEcsEntity, GltfEcsCommandReplayDiagnostic, GltfEcsCommandReplayReport, GltfEcsCommandReplayReportJsonValue, GltfSkippedEcsCommand } from "./gltf-ecs-command-replay-types.js";
export declare function gltfEcsCommandReplayReportToJsonValue(report: GltfEcsCommandReplayReport): GltfEcsCommandReplayReportJsonValue;
export declare function gltfEcsCommandReplayReportToJson(report: GltfEcsCommandReplayReport): string;
export declare function createGltfEcsCommandReplayReport(input: {
    readonly entitiesByKey: ReadonlyMap<string, Entity>;
    readonly created: readonly GltfCreatedEcsEntity[];
    readonly appliedComponents: readonly GltfAppliedEcsComponent[];
    readonly skipped: readonly GltfSkippedEcsCommand[];
    readonly diagnostics: readonly GltfEcsCommandReplayDiagnostic[];
}): GltfEcsCommandReplayReport;
//# sourceMappingURL=gltf-ecs-command-replay-report.d.ts.map