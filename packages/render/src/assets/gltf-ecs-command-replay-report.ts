import type { Entity } from "@aperture-engine/simulation";

import type {
  GltfAppliedEcsComponent,
  GltfCreatedEcsEntity,
  GltfEcsCommandReplayDiagnostic,
  GltfEcsCommandReplayReport,
  GltfEcsCommandReplayReportJsonValue,
  GltfSkippedEcsCommand,
} from "./gltf-ecs-command-replay-types.js";

export function gltfEcsCommandReplayReportToJsonValue(
  report: GltfEcsCommandReplayReport,
): GltfEcsCommandReplayReportJsonValue {
  return {
    valid: report.valid,
    entityKeys: [...report.entitiesByKey.keys()],
    created: report.created.map((entry) => ({ ...entry })),
    appliedComponents: report.appliedComponents.map((entry) => ({ ...entry })),
    skipped: report.skipped.map((entry) => ({
      ...entry,
      diagnostics: entry.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    })),
    diagnostics: report.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function gltfEcsCommandReplayReportToJson(
  report: GltfEcsCommandReplayReport,
): string {
  return JSON.stringify(gltfEcsCommandReplayReportToJsonValue(report));
}

export function createGltfEcsCommandReplayReport(input: {
  readonly entitiesByKey: ReadonlyMap<string, Entity>;
  readonly created: readonly GltfCreatedEcsEntity[];
  readonly appliedComponents: readonly GltfAppliedEcsComponent[];
  readonly skipped: readonly GltfSkippedEcsCommand[];
  readonly diagnostics: readonly GltfEcsCommandReplayDiagnostic[];
}): GltfEcsCommandReplayReport {
  return {
    valid: input.diagnostics.length === 0,
    entitiesByKey: input.entitiesByKey,
    created: input.created,
    appliedComponents: input.appliedComponents,
    skipped: input.skipped,
    diagnostics: input.diagnostics,
  };
}
