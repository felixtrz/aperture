import type { RenderPassCommand } from "./render-pass-commands.js";

export type RenderPassCommandExecutorDiagnosticCode =
  "renderPassCommandExecutor.missingMethod";

export type RenderPassEncoderMethod =
  | "setPipeline"
  | "setBindGroup"
  | "setVertexBuffer"
  | "setIndexBuffer"
  | "draw"
  | "drawIndexed";

export interface RenderPassCommandExecutorDiagnostic {
  readonly code: RenderPassCommandExecutorDiagnosticCode;
  readonly message: string;
  readonly method: RenderPassEncoderMethod;
  readonly renderId: number;
}

export interface RenderPassEncoderLike {
  setPipeline?: (pipeline: unknown) => void;
  setBindGroup?: (index: number, bindGroup: unknown) => void;
  setVertexBuffer?: (slot: number, buffer: unknown) => void;
  setIndexBuffer?: (buffer: unknown, format: string) => void;
  draw?: (
    vertexCount: number,
    instanceCount: number,
    firstVertex: number,
    firstInstance: number,
  ) => void;
  drawIndexed?: (
    indexCount: number,
    instanceCount: number,
    firstIndex: number,
    baseVertex: number,
    firstInstance: number,
  ) => void;
}

export interface ExecuteRenderPassCommandsOptions {
  readonly pass: RenderPassEncoderLike;
  readonly commands: readonly RenderPassCommand[];
}

export interface RenderPassCommandExecutionReport {
  readonly valid: boolean;
  readonly commandCount: number;
  readonly executedCommands: number;
  readonly skippedCommands: number;
  readonly drawCalls: number;
  readonly indexedDrawCalls: number;
  readonly nonIndexedDrawCalls: number;
  readonly diagnostics: readonly RenderPassCommandExecutorDiagnostic[];
}

export function executeRenderPassCommands(
  options: ExecuteRenderPassCommandsOptions,
): RenderPassCommandExecutionReport {
  const diagnostics: RenderPassCommandExecutorDiagnostic[] = [];
  let executedCommands = 0;
  let indexedDrawCalls = 0;
  let nonIndexedDrawCalls = 0;

  for (const command of options.commands) {
    switch (command.kind) {
      case "setPipeline": {
        if (options.pass.setPipeline === undefined) {
          diagnostics.push(missingMethod("setPipeline", command.renderId));
          break;
        }

        options.pass.setPipeline(command.pipeline);
        executedCommands += 1;
        break;
      }
      case "setBindGroup": {
        if (options.pass.setBindGroup === undefined) {
          diagnostics.push(missingMethod("setBindGroup", command.renderId));
          break;
        }

        options.pass.setBindGroup(command.index, command.bindGroup);
        executedCommands += 1;
        break;
      }
      case "setVertexBuffer": {
        if (options.pass.setVertexBuffer === undefined) {
          diagnostics.push(missingMethod("setVertexBuffer", command.renderId));
          break;
        }

        options.pass.setVertexBuffer(command.slot, command.buffer);
        executedCommands += 1;
        break;
      }
      case "setIndexBuffer": {
        if (options.pass.setIndexBuffer === undefined) {
          diagnostics.push(missingMethod("setIndexBuffer", command.renderId));
          break;
        }

        options.pass.setIndexBuffer(command.buffer, command.format);
        executedCommands += 1;
        break;
      }
      case "draw": {
        if (options.pass.draw === undefined) {
          diagnostics.push(missingMethod("draw", command.renderId));
          break;
        }

        options.pass.draw(
          command.vertexCount,
          command.instanceCount,
          command.firstVertex,
          command.firstInstance,
        );
        executedCommands += 1;
        nonIndexedDrawCalls += 1;
        break;
      }
      case "drawIndexed": {
        if (options.pass.drawIndexed === undefined) {
          diagnostics.push(missingMethod("drawIndexed", command.renderId));
          break;
        }

        options.pass.drawIndexed(
          command.indexCount,
          command.instanceCount,
          command.firstIndex,
          command.baseVertex,
          command.firstInstance,
        );
        executedCommands += 1;
        indexedDrawCalls += 1;
        break;
      }
    }
  }

  return {
    valid: diagnostics.length === 0,
    commandCount: options.commands.length,
    executedCommands,
    skippedCommands: options.commands.length - executedCommands,
    drawCalls: indexedDrawCalls + nonIndexedDrawCalls,
    indexedDrawCalls,
    nonIndexedDrawCalls,
    diagnostics,
  };
}

function missingMethod(
  method: RenderPassEncoderMethod,
  renderId: number,
): RenderPassCommandExecutorDiagnostic {
  return {
    code: "renderPassCommandExecutor.missingMethod",
    method,
    renderId,
    message: `Render pass encoder is missing '${method}' for render id ${renderId}.`,
  };
}
