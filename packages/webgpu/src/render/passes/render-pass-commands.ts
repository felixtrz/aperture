import type { ResolvedRenderPassDraw } from "./render-pass-resources.js";

export type RenderPassCommandKind =
  | "setPipeline"
  | "setBindGroup"
  | "setVertexBuffer"
  | "setIndexBuffer"
  | "beginOcclusionQuery"
  | "endOcclusionQuery"
  | "draw"
  | "drawIndexed"
  | "drawIndirect"
  | "drawIndexedIndirect";

export type RenderPassStateCommandKind =
  | "setPipeline"
  | "setBindGroup"
  | "setVertexBuffer"
  | "setIndexBuffer";

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

export interface BeginOcclusionQueryCommand {
  readonly kind: "beginOcclusionQuery";
  readonly renderId: number;
  readonly queryIndex: number;
}

export interface EndOcclusionQueryCommand {
  readonly kind: "endOcclusionQuery";
  readonly renderId: number;
  readonly queryIndex: number;
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

export interface DrawIndirectCommand {
  readonly kind: "drawIndirect";
  readonly renderId: number;
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly offset: number;
  readonly vertexCount: number;
  readonly instanceCount: number;
  readonly firstVertex: number;
  readonly firstInstance: number;
}

export interface DrawIndexedIndirectCommand {
  readonly kind: "drawIndexedIndirect";
  readonly renderId: number;
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly offset: number;
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
  | BeginOcclusionQueryCommand
  | EndOcclusionQueryCommand
  | DrawCommand
  | DrawIndexedCommand
  | DrawIndirectCommand
  | DrawIndexedIndirectCommand;

export interface RenderPassCommandPlanOptions {
  readonly draws: readonly ResolvedRenderPassDraw[];
}

export interface RenderPassCommandPlan {
  readonly valid: boolean;
  readonly commands: readonly RenderPassCommand[];
  readonly drawCount: number;
  readonly indexedDrawCount: number;
  readonly nonIndexedDrawCount: number;
  readonly occlusionQueryCount: number;
  readonly occlusionQueryRenderIds: readonly number[];
  readonly pressure: RenderPassCommandPressureReport;
  readonly diagnostics: readonly RenderPassCommandDiagnostic[];
}

export interface RenderPassStateCommandPressure {
  readonly planned: number;
  readonly emitted: number;
  readonly elided: number;
}

export interface RenderPassStateCommandPressureReport extends RenderPassStateCommandPressure {
  readonly setPipeline: RenderPassStateCommandPressure;
  readonly setBindGroup: RenderPassStateCommandPressure;
  readonly setVertexBuffer: RenderPassStateCommandPressure;
  readonly setIndexBuffer: RenderPassStateCommandPressure;
}

export interface RenderPassCommandPressureReport {
  readonly resolvedDraws: number;
  readonly drawCommands: number;
  readonly stateCommands: RenderPassStateCommandPressureReport;
}

export interface RenderPassCommandScratch {
  readonly commands: RenderPassCommand[];
  readonly diagnostics: RenderPassCommandDiagnostic[];
  readonly commandPool: RenderPassCommand[];
  readonly sortedBindGroups: ResolvedRenderPassDraw["bindGroups"][number][];
  readonly activeBindGroupResourceKeys: Map<number, string>;
  readonly activeBindGroups: Map<number, unknown>;
  readonly activeVertexBufferResourceKeys: Map<number, string>;
  readonly activeVertexBuffers: Map<number, unknown>;
  readonly occlusionQueryRenderIds: number[];
  readonly pressure: RenderPassCommandPressureReport;
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
  queryIndex?: number;
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
  const occlusionQueryRenderIds: number[] = [];
  const pressure = createRenderPassCommandPressureReport();

  for (let i = 0; i < capacity; i += 1) {
    commandPool.push(createEmptyCommand() as RenderPassCommand);
  }

  return {
    commands,
    diagnostics,
    commandPool,
    sortedBindGroups: [],
    activeBindGroupResourceKeys: new Map(),
    activeBindGroups: new Map(),
    activeVertexBufferResourceKeys: new Map(),
    activeVertexBuffers: new Map(),
    occlusionQueryRenderIds,
    pressure,
    plan: {
      valid: true,
      commands,
      drawCount: 0,
      indexedDrawCount: 0,
      nonIndexedDrawCount: 0,
      occlusionQueryCount: 0,
      occlusionQueryRenderIds,
      pressure,
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
  scratch.activeBindGroupResourceKeys.clear();
  scratch.activeBindGroups.clear();
  scratch.activeVertexBufferResourceKeys.clear();
  scratch.activeVertexBuffers.clear();
  scratch.occlusionQueryRenderIds.length = 0;
  resetRenderPassCommandPressure(scratch.pressure);

  let indexedDrawCount = 0;
  let nonIndexedDrawCount = 0;
  let occlusionQueryCount = 0;
  let activePipelineKey = "";
  let activePipeline: unknown = null;
  let hasActivePipeline = false;
  let activeIndexBufferResourceKey = "";
  let activeIndexBuffer: unknown = null;
  let activeIndexBufferFormat = "";
  let hasActiveIndexBuffer = false;

  (scratch.pressure as MutableRenderPassCommandPressureReport).resolvedDraws =
    options.draws.length;

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

    if (
      hasActivePipeline &&
      activePipelineKey === draw.pipelineKey &&
      activePipeline === draw.pipeline
    ) {
      recordStateCommandPressure(scratch.pressure, "setPipeline", "elided");
    } else {
      pushSetPipelineCommand(scratch, draw);
      recordStateCommandPressure(scratch.pressure, "setPipeline", "emitted");
      activePipelineKey = draw.pipelineKey;
      activePipeline = draw.pipeline;
      hasActivePipeline = true;
    }

    scratch.sortedBindGroups.length = 0;

    for (const bindGroup of draw.bindGroups) {
      scratch.sortedBindGroups.push(bindGroup);
    }

    scratch.sortedBindGroups.sort((a, b) => a.group - b.group);

    for (const bindGroup of scratch.sortedBindGroups) {
      if (
        scratch.activeBindGroupResourceKeys.get(bindGroup.group) ===
          bindGroup.resourceKey &&
        scratch.activeBindGroups.get(bindGroup.group) === bindGroup.bindGroup
      ) {
        recordStateCommandPressure(scratch.pressure, "setBindGroup", "elided");
      } else {
        pushSetBindGroupCommand(scratch, draw.renderId, bindGroup);
        recordStateCommandPressure(scratch.pressure, "setBindGroup", "emitted");
        scratch.activeBindGroupResourceKeys.set(
          bindGroup.group,
          bindGroup.resourceKey,
        );
        scratch.activeBindGroups.set(bindGroup.group, bindGroup.bindGroup);
      }
    }

    for (let slot = 0; slot < draw.vertexBuffers.length; slot += 1) {
      const vertexBuffer = draw.vertexBuffers[slot];

      if (vertexBuffer !== undefined) {
        if (
          scratch.activeVertexBufferResourceKeys.get(slot) ===
            vertexBuffer.resourceKey &&
          scratch.activeVertexBuffers.get(slot) === vertexBuffer.buffer
        ) {
          recordStateCommandPressure(
            scratch.pressure,
            "setVertexBuffer",
            "elided",
          );
        } else {
          pushSetVertexBufferCommand(
            scratch,
            draw.renderId,
            slot,
            vertexBuffer,
          );
          recordStateCommandPressure(
            scratch.pressure,
            "setVertexBuffer",
            "emitted",
          );
          scratch.activeVertexBufferResourceKeys.set(
            slot,
            vertexBuffer.resourceKey,
          );
          scratch.activeVertexBuffers.set(slot, vertexBuffer.buffer);
        }
      }
    }

    if (draw.indexBuffer !== null) {
      const indexCount = draw.indexCount ?? draw.indexBuffer.indexCount;

      if (
        hasActiveIndexBuffer &&
        activeIndexBufferResourceKey === draw.indexBuffer.resourceKey &&
        activeIndexBuffer === draw.indexBuffer.buffer &&
        activeIndexBufferFormat === draw.indexBuffer.format
      ) {
        recordStateCommandPressure(
          scratch.pressure,
          "setIndexBuffer",
          "elided",
        );
      } else {
        pushSetIndexBufferCommand(scratch, draw);
        recordStateCommandPressure(
          scratch.pressure,
          "setIndexBuffer",
          "emitted",
        );
        activeIndexBufferResourceKey = draw.indexBuffer.resourceKey;
        activeIndexBuffer = draw.indexBuffer.buffer;
        activeIndexBufferFormat = draw.indexBuffer.format;
        hasActiveIndexBuffer = true;
      }

      if (!isPositiveInteger(indexCount)) {
        scratch.diagnostics.push({
          code: "renderPassCommand.invalidIndexCount",
          renderId: draw.renderId,
          message: `Render id ${draw.renderId} has invalid indexed draw count '${String(indexCount)}'.`,
        });
        continue;
      }

      if (draw.occlusionQuery === true) {
        pushBeginOcclusionQueryCommand(scratch, draw, occlusionQueryCount);
      }

      pushDrawIndexedCommand(scratch, draw, indexCount, firstInstance);

      if (draw.occlusionQuery === true) {
        pushEndOcclusionQueryCommand(scratch, draw, occlusionQueryCount);
        scratch.occlusionQueryRenderIds.push(draw.renderId);
        occlusionQueryCount += 1;
      }

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

    if (draw.occlusionQuery === true) {
      pushBeginOcclusionQueryCommand(scratch, draw, occlusionQueryCount);
    }

    pushDrawCommand(scratch, draw, firstInstance);

    if (draw.occlusionQuery === true) {
      pushEndOcclusionQueryCommand(scratch, draw, occlusionQueryCount);
      scratch.occlusionQueryRenderIds.push(draw.renderId);
      occlusionQueryCount += 1;
    }

    nonIndexedDrawCount += 1;
  }

  const plan = scratch.plan as MutableRenderPassCommandPlan;

  plan.valid = scratch.diagnostics.length === 0;
  plan.drawCount = indexedDrawCount + nonIndexedDrawCount;
  plan.indexedDrawCount = indexedDrawCount;
  plan.nonIndexedDrawCount = nonIndexedDrawCount;
  plan.occlusionQueryCount = occlusionQueryCount;
  (scratch.pressure as MutableRenderPassCommandPressureReport).drawCommands =
    plan.drawCount;

  return scratch.plan;
}

function pushBeginOcclusionQueryCommand(
  scratch: RenderPassCommandScratch,
  draw: ResolvedRenderPassDraw,
  queryIndex: number,
): void {
  const command = commandAt(scratch);

  command.kind = "beginOcclusionQuery";
  command.renderId = draw.renderId;
  command.queryIndex = queryIndex;
  scratch.commands.push(command as BeginOcclusionQueryCommand);
}

function pushEndOcclusionQueryCommand(
  scratch: RenderPassCommandScratch,
  draw: ResolvedRenderPassDraw,
  queryIndex: number,
): void {
  const command = commandAt(scratch);

  command.kind = "endOcclusionQuery";
  command.renderId = draw.renderId;
  command.queryIndex = queryIndex;
  scratch.commands.push(command as EndOcclusionQueryCommand);
}

function createRenderPassCommandPressureReport(): RenderPassCommandPressureReport {
  const setPipeline = createRenderPassStateCommandPressure();
  const setBindGroup = createRenderPassStateCommandPressure();
  const setVertexBuffer = createRenderPassStateCommandPressure();
  const setIndexBuffer = createRenderPassStateCommandPressure();

  return {
    resolvedDraws: 0,
    drawCommands: 0,
    stateCommands: {
      planned: 0,
      emitted: 0,
      elided: 0,
      setPipeline,
      setBindGroup,
      setVertexBuffer,
      setIndexBuffer,
    },
  };
}

function createRenderPassStateCommandPressure(): RenderPassStateCommandPressure {
  return {
    planned: 0,
    emitted: 0,
    elided: 0,
  };
}

function resetRenderPassCommandPressure(
  pressure: RenderPassCommandPressureReport,
): void {
  const mutablePressure = pressure as MutableRenderPassCommandPressureReport;

  mutablePressure.resolvedDraws = 0;
  mutablePressure.drawCommands = 0;
  resetRenderPassStateCommandPressure(mutablePressure.stateCommands);
  resetRenderPassStateCommandPressure(
    mutablePressure.stateCommands.setPipeline,
  );
  resetRenderPassStateCommandPressure(
    mutablePressure.stateCommands.setBindGroup,
  );
  resetRenderPassStateCommandPressure(
    mutablePressure.stateCommands.setVertexBuffer,
  );
  resetRenderPassStateCommandPressure(
    mutablePressure.stateCommands.setIndexBuffer,
  );
}

function resetRenderPassStateCommandPressure(
  pressure: RenderPassStateCommandPressure,
): void {
  const mutable = pressure as MutableRenderPassStateCommandPressure;

  mutable.planned = 0;
  mutable.emitted = 0;
  mutable.elided = 0;
}

function recordStateCommandPressure(
  pressure: RenderPassCommandPressureReport,
  kind: RenderPassStateCommandKind,
  result: "emitted" | "elided",
): void {
  const stateCommands =
    pressure.stateCommands as MutableRenderPassStateCommandPressureReport;
  const commandPressure = stateCommands[
    kind
  ] as MutableRenderPassStateCommandPressure;

  stateCommands.planned += 1;
  commandPressure.planned += 1;

  if (result === "emitted") {
    stateCommands.emitted += 1;
    commandPressure.emitted += 1;
    return;
  }

  stateCommands.elided += 1;
  commandPressure.elided += 1;
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
  command.firstIndex = draw.indexStart ?? 0;
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
  command.firstVertex = draw.vertexStart ?? 0;
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

type MutableRenderPassCommandPressureReport = {
  -readonly [Key in keyof RenderPassCommandPressureReport]: RenderPassCommandPressureReport[Key];
};

type MutableRenderPassStateCommandPressure = {
  -readonly [Key in keyof RenderPassStateCommandPressure]: RenderPassStateCommandPressure[Key];
};

type MutableRenderPassStateCommandPressureReport =
  MutableRenderPassStateCommandPressure & {
    -readonly [Key in RenderPassStateCommandKind]: RenderPassStateCommandPressureReport[Key];
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
