import type { ResolvedRenderPassDraw } from "./render-pass-resources.js";

export type RenderPassCommandKind =
  | "setPipeline"
  | "setBindGroup"
  | "setVertexBuffer"
  | "setIndexBuffer"
  | "draw"
  | "drawIndexed";

export type RenderPassCommandDiagnosticCode =
  | "renderPassCommand.invalidVertexCount"
  | "renderPassCommand.invalidIndexCount"
  | "renderPassCommand.invalidTransformOffset";

export interface RenderPassCommandDiagnostic {
  readonly code: RenderPassCommandDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
}

export interface SetPipelineCommand {
  readonly kind: "setPipeline";
  readonly renderId: number;
  readonly pipelineKey: string;
  readonly pipeline: unknown;
}

export interface SetBindGroupCommand {
  readonly kind: "setBindGroup";
  readonly renderId: number;
  readonly index: number;
  readonly resourceKey: string;
  readonly bindGroup: unknown;
}

export interface SetVertexBufferCommand {
  readonly kind: "setVertexBuffer";
  readonly renderId: number;
  readonly slot: number;
  readonly resourceKey: string;
  readonly buffer: unknown;
}

export interface SetIndexBufferCommand {
  readonly kind: "setIndexBuffer";
  readonly renderId: number;
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly format: string;
}

export interface DrawCommand {
  readonly kind: "draw";
  readonly renderId: number;
  readonly vertexCount: number;
  readonly instanceCount: number;
  readonly firstVertex: number;
  readonly firstInstance: number;
}

export interface DrawIndexedCommand {
  readonly kind: "drawIndexed";
  readonly renderId: number;
  readonly indexCount: number;
  readonly instanceCount: number;
  readonly firstIndex: number;
  readonly baseVertex: number;
  readonly firstInstance: number;
}

export type RenderPassCommand =
  | SetPipelineCommand
  | SetBindGroupCommand
  | SetVertexBufferCommand
  | SetIndexBufferCommand
  | DrawCommand
  | DrawIndexedCommand;

export interface RenderPassCommandPlanOptions {
  readonly draws: readonly ResolvedRenderPassDraw[];
}

export interface RenderPassCommandPlan {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly drawCount: number;
  readonly indexedDrawCount: number;
  readonly nonIndexedDrawCount: number;
  readonly diagnostics: readonly RenderPassCommandDiagnostic[];
}

export function planRenderPassCommands(
  options: RenderPassCommandPlanOptions,
): RenderPassCommandPlan {
  const commands: RenderPassCommand[] = [];
  const diagnostics: RenderPassCommandDiagnostic[] = [];
  let indexedDrawCount = 0;
  let nonIndexedDrawCount = 0;

  for (const draw of [...options.draws].sort(
    (a, b) => a.renderId - b.renderId,
  )) {
    const firstInstance = transformPackedOffsetToInstance(
      draw.transformPackedOffset,
    );

    if (firstInstance === null) {
      diagnostics.push({
        code: "renderPassCommand.invalidTransformOffset",
        renderId: draw.renderId,
        message: `Render id ${draw.renderId} has invalid transform packed offset '${String(draw.transformPackedOffset)}'.`,
      });
      continue;
    }

    commands.push({
      kind: "setPipeline",
      renderId: draw.renderId,
      pipelineKey: draw.pipelineKey,
      pipeline: draw.pipeline,
    });

    for (const bindGroup of [...draw.bindGroups].sort(
      (a, b) => a.group - b.group,
    )) {
      commands.push({
        kind: "setBindGroup",
        renderId: draw.renderId,
        index: bindGroup.group,
        resourceKey: bindGroup.resourceKey,
        bindGroup: bindGroup.bindGroup,
      });
    }

    draw.vertexBuffers.forEach((vertexBuffer, slot) => {
      commands.push({
        kind: "setVertexBuffer",
        renderId: draw.renderId,
        slot,
        resourceKey: vertexBuffer.resourceKey,
        buffer: vertexBuffer.buffer,
      });
    });

    if (draw.indexBuffer !== null) {
      const indexCount = draw.indexCount ?? draw.indexBuffer.indexCount;

      commands.push({
        kind: "setIndexBuffer",
        renderId: draw.renderId,
        resourceKey: draw.indexBuffer.resourceKey,
        buffer: draw.indexBuffer.buffer,
        format: draw.indexBuffer.format,
      });

      if (!isPositiveInteger(indexCount)) {
        diagnostics.push({
          code: "renderPassCommand.invalidIndexCount",
          renderId: draw.renderId,
          message: `Render id ${draw.renderId} has invalid indexed draw count '${String(indexCount)}'.`,
        });
        continue;
      }

      commands.push({
        kind: "drawIndexed",
        renderId: draw.renderId,
        indexCount,
        instanceCount: draw.instanceCount,
        firstIndex: 0,
        baseVertex: 0,
        firstInstance,
      });
      indexedDrawCount += 1;
      continue;
    }

    if (!isPositiveInteger(draw.vertexCount)) {
      diagnostics.push({
        code: "renderPassCommand.invalidVertexCount",
        renderId: draw.renderId,
        message: `Render id ${draw.renderId} has invalid vertex draw count '${String(draw.vertexCount)}'.`,
      });
      continue;
    }

    commands.push({
      kind: "draw",
      renderId: draw.renderId,
      vertexCount: draw.vertexCount,
      instanceCount: draw.instanceCount,
      firstVertex: 0,
      firstInstance,
    });
    nonIndexedDrawCount += 1;
  }

  return {
    valid: diagnostics.length === 0,
    commands,
    drawCount: indexedDrawCount + nonIndexedDrawCount,
    indexedDrawCount,
    nonIndexedDrawCount,
    diagnostics,
  };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function transformPackedOffsetToInstance(offset: number): number | null {
  if (!Number.isInteger(offset) || offset < 0 || offset % 16 !== 0) {
    return null;
  }

  return offset / 16;
}
