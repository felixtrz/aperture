// Sibling of render-pass-commands.ts for first-class compute graph nodes (M3).
// A compute pass node carries a flat ComputePassCommand[] that the single-encoder
// graph executor replays inside one GPUComputePassEncoder. The command objects
// mirror the render-pass command shape: serializable metadata (kind/keys/counts)
// plus opaque GPU handles (`pipeline`/`bindGroup`/`buffer`) that are never put in
// a JSON report.

export type ComputePassCommandKind =
  | "setComputePipeline"
  | "setComputeBindGroup"
  | "dispatchWorkgroups"
  | "dispatchWorkgroupsIndirect";

export type ComputePassStateCommandKind =
  | "setComputePipeline"
  | "setComputeBindGroup";

export interface SetComputePipelineCommand {
  readonly kind: "setComputePipeline";
  readonly pipelineKey: string;
  readonly pipeline: unknown;
}

export interface SetComputeBindGroupCommand {
  readonly kind: "setComputeBindGroup";
  readonly index: number;
  readonly resourceKey: string;
  readonly bindGroup: unknown;
}

export interface DispatchWorkgroupsCommand {
  readonly kind: "dispatchWorkgroups";
  readonly workgroupCountX: number;
  readonly workgroupCountY: number;
  readonly workgroupCountZ: number;
}

export interface DispatchWorkgroupsIndirectCommand {
  readonly kind: "dispatchWorkgroupsIndirect";
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly offset: number;
}

export type ComputePassCommand =
  | SetComputePipelineCommand
  | SetComputeBindGroupCommand
  | DispatchWorkgroupsCommand
  | DispatchWorkgroupsIndirectCommand;

export type ComputePassCommandDiagnosticCode =
  | "computePassCommand.invalidWorkgroupCount"
  | "computePassCommand.missingPipeline";

export interface ComputePassCommandDiagnostic {
  readonly code: ComputePassCommandDiagnosticCode;
  readonly message: string;
}

/**
 * Validate a flat compute command list without touching the GPU. Used by the
 * graph compiler (headless-safe) to surface malformed dispatches before the
 * executor runs them. A list is valid when it begins by binding a pipeline
 * before any dispatch and every dispatch has positive integer workgroup counts.
 */
export function validateComputePassCommands(
  commands: readonly ComputePassCommand[],
): readonly ComputePassCommandDiagnostic[] {
  const diagnostics: ComputePassCommandDiagnostic[] = [];
  let hasPipeline = false;

  for (const command of commands) {
    switch (command.kind) {
      case "setComputePipeline":
        hasPipeline = true;
        break;
      case "dispatchWorkgroups":
        if (!hasPipeline) {
          diagnostics.push({
            code: "computePassCommand.missingPipeline",
            message: "Compute dispatch issued before a pipeline was bound.",
          });
        }
        if (
          !isPositiveInteger(command.workgroupCountX) ||
          !isNonNegativeInteger(command.workgroupCountY) ||
          !isNonNegativeInteger(command.workgroupCountZ)
        ) {
          diagnostics.push({
            code: "computePassCommand.invalidWorkgroupCount",
            message: `Compute dispatch has invalid workgroup counts (${command.workgroupCountX}, ${command.workgroupCountY}, ${command.workgroupCountZ}).`,
          });
        }
        break;
      case "dispatchWorkgroupsIndirect":
        if (!hasPipeline) {
          diagnostics.push({
            code: "computePassCommand.missingPipeline",
            message:
              "Indirect compute dispatch issued before a pipeline was bound.",
          });
        }
        break;
      case "setComputeBindGroup":
        break;
    }
  }

  return diagnostics;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
