import type { EcsWorld, Entity } from "@aperture-engine/simulation";

import type {
  GltfEcsAuthoringCommandPlan,
  GltfEcsAuthoringComponentName,
} from "./gltf-ecs-authoring-command-plan.js";

export type GltfEcsCommandReplayDiagnosticCode =
  | "gltfEcsReplay.invalidPlan"
  | "gltfEcsReplay.duplicateEntityKey"
  | "gltfEcsReplay.missingEntityKey"
  | "gltfEcsReplay.missingParentEntityKey"
  | "gltfEcsReplay.unknownComponent"
  | "gltfEcsReplay.invalidComponentValue"
  | "gltfEcsReplay.componentApplyFailed";

export interface GltfEcsCommandReplayDiagnostic {
  readonly code: GltfEcsCommandReplayDiagnosticCode;
  readonly severity: "error";
  readonly message: string;
  readonly entityKey?: string;
  readonly parentEntityKey?: string | null;
  readonly component?: string;
  readonly commandIndex?: number;
  readonly sourceReason?: string;
}

export interface GltfCreatedEcsEntity {
  readonly entityKey: string;
  readonly label: string;
  readonly entityIndex: number;
  readonly entityGeneration: number;
}

export interface GltfAppliedEcsComponent {
  readonly entityKey: string;
  readonly component: GltfEcsAuthoringComponentName;
  readonly commandIndex: number;
}

export interface GltfSkippedEcsCommand {
  readonly commandIndex: number;
  readonly entityKey?: string;
  readonly component?: string;
  readonly reason: GltfEcsCommandReplayDiagnosticCode;
  readonly diagnostics: readonly GltfEcsCommandReplayDiagnostic[];
}

export interface GltfEcsCommandReplayOptions {
  readonly world: EcsWorld;
  readonly plan: GltfEcsAuthoringCommandPlan;
  readonly registerComponents?: boolean;
}

export interface GltfEcsCommandReplayReport {
  readonly valid: boolean;
  readonly entitiesByKey: ReadonlyMap<string, Entity>;
  readonly created: readonly GltfCreatedEcsEntity[];
  readonly appliedComponents: readonly GltfAppliedEcsComponent[];
  readonly skipped: readonly GltfSkippedEcsCommand[];
  readonly diagnostics: readonly GltfEcsCommandReplayDiagnostic[];
}

export interface GltfEcsCommandReplayReportJsonValue extends Omit<
  GltfEcsCommandReplayReport,
  "entitiesByKey"
> {
  readonly entityKeys: readonly string[];
}
