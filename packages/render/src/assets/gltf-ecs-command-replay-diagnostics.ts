import type { GltfEcsAuthoringCommand } from "./gltf-ecs-authoring-command-plan.js";
import type {
  GltfEcsCommandReplayDiagnostic,
  GltfEcsCommandReplayDiagnosticCode,
  GltfSkippedEcsCommand,
} from "./gltf-ecs-command-replay-types.js";

export function skipGltfEcsReplayCommand(input: {
  readonly diagnostics: GltfEcsCommandReplayDiagnostic[];
  readonly skipped: GltfSkippedEcsCommand[];
  readonly commandIndex: number;
  readonly entityKey?: string;
  readonly component?: string;
  readonly code: GltfEcsCommandReplayDiagnosticCode;
  readonly message: string;
  readonly parentEntityKey?: string | null;
}): void {
  const diagnostic: GltfEcsCommandReplayDiagnostic = {
    code: input.code,
    severity: "error",
    message: input.message,
    commandIndex: input.commandIndex,
    ...(input.entityKey === undefined ? {} : { entityKey: input.entityKey }),
    ...(input.component === undefined ? {} : { component: input.component }),
    ...(input.parentEntityKey === undefined
      ? {}
      : { parentEntityKey: input.parentEntityKey }),
  };
  input.diagnostics.push(diagnostic);
  input.skipped.push({
    commandIndex: input.commandIndex,
    ...(input.entityKey === undefined ? {} : { entityKey: input.entityKey }),
    ...(input.component === undefined ? {} : { component: input.component }),
    reason: input.code,
    diagnostics: [diagnostic],
  });
}

export function skipInvalidGltfEcsReplayComponentValue(
  input: {
    readonly command: Extract<
      GltfEcsAuthoringCommand,
      { type: "addComponent" }
    >;
    readonly commandIndex: number;
    readonly diagnostics: GltfEcsCommandReplayDiagnostic[];
    readonly skipped: GltfSkippedEcsCommand[];
  },
  message: string,
): void {
  skipGltfEcsReplayCommand({
    diagnostics: input.diagnostics,
    skipped: input.skipped,
    commandIndex: input.commandIndex,
    entityKey: input.command.entityKey,
    component: input.command.component,
    code: "gltfEcsReplay.invalidComponentValue",
    message,
  });
}
