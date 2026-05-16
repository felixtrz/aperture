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

export interface RenderPassCommandScratch {
  readonly commands: RenderPassCommand[];
  readonly diagnostics: RenderPassCommandDiagnostic[];
  readonly commandPool: RenderPassCommand[];
  readonly sortedBindGroups: ResolvedRenderPassDraw["bindGroups"][number][];
  readonly plan: RenderPassCommandPlan;
}

interface MutableRenderPassCommand {
  kind: RenderPassCommandKind;
  renderId: number;
  pipelineKey?: string;
  pipeline?: unknown;
  index?: number;
  resourceKey?: string;
  bindGroup?: unknown;
  slot?: number;
  buffer?: unknown;
  format?: string;
  vertexCount?: number;
  indexCount?: number;
  instanceCount?: number;
  firstVertex?: number;
  firstIndex?: number;
  baseVertex?: number;
  firstInstance?: number;
}

export function planRenderPassCommands(
  options: RenderPassCommandPlanOptions,
): RenderPassCommandPlan {
  const scratch = createRenderPassCommandScratch();

  writeRenderPassCommands(options, scratch);

  return scratch.plan;
}

export function createRenderPassCommandScratch(
  capacity = 0,
): RenderPassCommandScratch {
  const commands: RenderPassCommand[] = [];
  const diagnostics: RenderPassCommandDiagnostic[] = [];
  const commandPool: RenderPassCommand[] = [];

  for (let i = 0; i < capacity; i += 1) {
    commandPool.push(createEmptyCommand() as RenderPassCommand);
  }

  return {
    commands,
    diagnostics,
    commandPool,
    sortedBindGroups: [],
    plan: {
      valid: true,
      commands,
      drawCount: 0,
      indexedDrawCount: 0,
      nonIndexedDrawCount: 0,
      diagnostics,
    },
  };
}

export function writeRenderPassCommands(
  options: RenderPassCommandPlanOptions,
  scratch: RenderPassCommandScratch,
): RenderPassCommandPlan {
  scratch.commands.length = 0;
  scratch.diagnostics.length = 0;

  let indexedDrawCount = 0;
  let nonIndexedDrawCount = 0;

  for (const draw of options.draws) {
    const firstInstance = transformPackedOffsetToInstance(
      draw.transformPackedOffset,
    );

    if (firstInstance === null) {
      scratch.diagnostics.push({
        code: "renderPassCommand.invalidTransformOffset",
        renderId: draw.renderId,
        message: `Render id ${draw.renderId} has invalid transform packed offset '${String(draw.transformPackedOffset)}'.`,
      });
      continue;
    }

    pushSetPipelineCommand(scratch, draw);

    scratch.sortedBindGroups.length = 0;

    for (const bindGroup of draw.bindGroups) {
      scratch.sortedBindGroups.push(bindGroup);
    }

    scratch.sortedBindGroups.sort((a, b) => a.group - b.group);

    for (const bindGroup of scratch.sortedBindGroups) {
      pushSetBindGroupCommand(scratch, draw.renderId, bindGroup);
    }

    for (let slot = 0; slot < draw.vertexBuffers.length; slot += 1) {
      const vertexBuffer = draw.vertexBuffers[slot];

      if (vertexBuffer !== undefined) {
        pushSetVertexBufferCommand(scratch, draw.renderId, slot, vertexBuffer);
      }
    }

    if (draw.indexBuffer !== null) {
      const indexCount = draw.indexCount ?? draw.indexBuffer.indexCount;

      pushSetIndexBufferCommand(scratch, draw);

      if (!isPositiveInteger(indexCount)) {
        scratch.diagnostics.push({
          code: "renderPassCommand.invalidIndexCount",
          renderId: draw.renderId,
          message: `Render id ${draw.renderId} has invalid indexed draw count '${String(indexCount)}'.`,
        });
        continue;
      }

      pushDrawIndexedCommand(scratch, draw, indexCount, firstInstance);
      indexedDrawCount += 1;
      continue;
    }

    if (!isPositiveInteger(draw.vertexCount)) {
      scratch.diagnostics.push({
        code: "renderPassCommand.invalidVertexCount",
        renderId: draw.renderId,
        message: `Render id ${draw.renderId} has invalid vertex draw count '${String(draw.vertexCount)}'.`,
      });
      continue;
    }

    pushDrawCommand(scratch, draw, firstInstance);
    nonIndexedDrawCount += 1;
  }

  const plan = scratch.plan as MutableRenderPassCommandPlan;

  plan.valid = scratch.diagnostics.length === 0;
  plan.drawCount = indexedDrawCount + nonIndexedDrawCount;
  plan.indexedDrawCount = indexedDrawCount;
  plan.nonIndexedDrawCount = nonIndexedDrawCount;

  return scratch.plan;
}

function pushSetPipelineCommand(
  scratch: RenderPassCommandScratch,
  draw: ResolvedRenderPassDraw,
): void {
  const command = commandAt(scratch);

  command.kind = "setPipeline";
  command.renderId = draw.renderId;
  command.pipelineKey = draw.pipelineKey;
  command.pipeline = draw.pipeline;
  scratch.commands.push(command as SetPipelineCommand);
}

function pushSetBindGroupCommand(
  scratch: RenderPassCommandScratch,
  renderId: number,
  bindGroup: ResolvedRenderPassDraw["bindGroups"][number],
): void {
  const command = commandAt(scratch);

  command.kind = "setBindGroup";
  command.renderId = renderId;
  command.index = bindGroup.group;
  command.resourceKey = bindGroup.resourceKey;
  command.bindGroup = bindGroup.bindGroup;
  scratch.commands.push(command as SetBindGroupCommand);
}

function pushSetVertexBufferCommand(
  scratch: RenderPassCommandScratch,
  renderId: number,
  slot: number,
  vertexBuffer: ResolvedRenderPassDraw["vertexBuffers"][number],
): void {
  const command = commandAt(scratch);

  command.kind = "setVertexBuffer";
  command.renderId = renderId;
  command.slot = slot;
  command.resourceKey = vertexBuffer.resourceKey;
  command.buffer = vertexBuffer.buffer;
  scratch.commands.push(command as SetVertexBufferCommand);
}

function pushSetIndexBufferCommand(
  scratch: RenderPassCommandScratch,
  draw: ResolvedRenderPassDraw,
): void {
  const command = commandAt(scratch);

  command.kind = "setIndexBuffer";
  command.renderId = draw.renderId;
  command.resourceKey = draw.indexBuffer?.resourceKey ?? "";
  command.buffer = draw.indexBuffer?.buffer;
  command.format = draw.indexBuffer?.format ?? "";
  scratch.commands.push(command as SetIndexBufferCommand);
}

function pushDrawIndexedCommand(
  scratch: RenderPassCommandScratch,
  draw: ResolvedRenderPassDraw,
  indexCount: number,
  firstInstance: number,
): void {
  const command = commandAt(scratch);

  command.kind = "drawIndexed";
  command.renderId = draw.renderId;
  command.indexCount = indexCount;
  command.instanceCount = draw.instanceCount;
  command.firstIndex = 0;
  command.baseVertex = 0;
  command.firstInstance = firstInstance;
  scratch.commands.push(command as DrawIndexedCommand);
}

function pushDrawCommand(
  scratch: RenderPassCommandScratch,
  draw: ResolvedRenderPassDraw,
  firstInstance: number,
): void {
  const command = commandAt(scratch);

  command.kind = "draw";
  command.renderId = draw.renderId;
  command.vertexCount = draw.vertexCount;
  command.instanceCount = draw.instanceCount;
  command.firstVertex = 0;
  command.firstInstance = firstInstance;
  scratch.commands.push(command as DrawCommand);
}

function commandAt(
  scratch: RenderPassCommandScratch,
): MutableRenderPassCommand {
  const existing = scratch.commandPool[scratch.commands.length] as
    | MutableRenderPassCommand
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const command = createEmptyCommand();

  scratch.commandPool.push(command as RenderPassCommand);
  return command;
}

function createEmptyCommand(): MutableRenderPassCommand {
  return {
    kind: "draw",
    renderId: 0,
  };
}

type MutableRenderPassCommandPlan = {
  -readonly [Key in keyof RenderPassCommandPlan]: RenderPassCommandPlan[Key];
};

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function transformPackedOffsetToInstance(offset: number): number | null {
  if (!Number.isInteger(offset) || offset < 0 || offset % 16 !== 0) {
    return null;
  }

  return offset / 16;
}
