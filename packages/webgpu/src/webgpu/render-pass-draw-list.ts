import type {
  DrawCommandDescriptor,
  DrawCommandDescriptorDiagnostic,
} from "./draw-command.js";
import type { GetOrCreateRenderPipelineResult } from "./pipeline-cache-integration.js";
import type { UnlitBindGroupResource } from "./unlit-bind-group.js";
import { requiredBindGroupGroupsForPipelineKey } from "./material-pipeline-selection.js";

export type RenderPassDrawListDiagnosticCode =
  | "renderPassDrawList.missingPipelineResource"
  | "renderPassDrawList.missingBindGroupResource";

export interface RenderPassDrawListDiagnostic {
  readonly code: RenderPassDrawListDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly pipelineKey?: string;
  readonly bindGroup?: {
    readonly group: number;
    readonly materialResourceKey?: string;
  };
}

export interface RenderPassDrawListRecord {
  readonly renderId: number;
  readonly pipelineKey: string;
  readonly bindGroupKeys: readonly string[];
  readonly meshResourceKey: string;
  readonly materialResourceKey: string;
  readonly vertexBufferKeys: readonly string[];
  readonly vertexCount: number;
  readonly indexBufferKey: string | null;
  readonly indexCount: number | null;
  readonly instanceCount: number;
  readonly transformPackedOffset: number;
}

export interface RenderPassDrawListOptions {
  readonly drawCommands: readonly DrawCommandDescriptor[];
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
  readonly bindGroups: readonly UnlitBindGroupResource[];
  readonly requiredBindGroupGroups?: readonly number[];
}

export interface RenderPassDrawListPlan {
  readonly valid: boolean;
  readonly draws: readonly RenderPassDrawListRecord[];
  readonly diagnostics: readonly (
    | DrawCommandDescriptorDiagnostic
    | RenderPassDrawListDiagnostic
  )[];
}

export interface RenderPassDrawListScratch {
  readonly draws: RenderPassDrawListRecord[];
  readonly diagnostics: RenderPassDrawListDiagnostic[];
  readonly drawPool: RenderPassDrawListRecord[];
  readonly pipelineKeys: Set<string>;
  readonly resolvedBindGroups: UnlitBindGroupResource[];
  readonly plan: RenderPassDrawListPlan;
}

interface MutableRenderPassDrawListRecord {
  renderId: number;
  pipelineKey: string;
  bindGroupKeys: string[];
  meshResourceKey: string;
  materialResourceKey: string;
  vertexBufferKeys: string[];
  vertexCount: number;
  indexBufferKey: string | null;
  indexCount: number | null;
  instanceCount: number;
  transformPackedOffset: number;
}

export function planRenderPassDrawList(
  options: RenderPassDrawListOptions,
): RenderPassDrawListPlan {
  const scratch = createRenderPassDrawListScratch();

  writeRenderPassDrawList(options, scratch);

  return scratch.plan;
}

export function createRenderPassDrawListScratch(
  capacity = 0,
): RenderPassDrawListScratch {
  const draws: RenderPassDrawListRecord[] = [];
  const diagnostics: RenderPassDrawListDiagnostic[] = [];
  const drawPool: RenderPassDrawListRecord[] = [];

  for (let i = 0; i < capacity; i += 1) {
    drawPool.push(createEmptyDrawListRecord());
  }

  return {
    draws,
    diagnostics,
    drawPool,
    pipelineKeys: new Set(),
    resolvedBindGroups: [],
    plan: { valid: true, draws, diagnostics },
  };
}

export function writeRenderPassDrawList(
  options: RenderPassDrawListOptions,
  scratch: RenderPassDrawListScratch,
): RenderPassDrawListPlan {
  scratch.draws.length = 0;
  scratch.diagnostics.length = 0;
  scratch.pipelineKeys.clear();

  for (const pipeline of options.pipelines) {
    if (pipeline.ok) {
      scratch.pipelineKeys.add(pipeline.key);
    }
  }

  for (const command of options.drawCommands) {
    let ready = true;
    const requiredGroups =
      options.requiredBindGroupGroups ??
      requiredBindGroupGroupsForPipelineKey(command.pipelineKey);

    if (!scratch.pipelineKeys.has(command.pipelineKey)) {
      scratch.diagnostics.push({
        code: "renderPassDrawList.missingPipelineResource",
        renderId: command.renderId,
        pipelineKey: command.pipelineKey,
        message: `Missing render pipeline resource '${command.pipelineKey}' for render id ${command.renderId}.`,
      });
      ready = false;
    }

    const bindGroups = resolveBindGroups(
      command,
      options.bindGroups,
      requiredGroups,
      scratch,
    );

    if (bindGroups.length !== requiredGroups.length) {
      ready = false;
    }

    if (!ready) {
      continue;
    }

    const record = drawListRecordAt(scratch, scratch.draws.length);

    record.renderId = command.renderId;
    record.pipelineKey = command.pipelineKey;
    record.bindGroupKeys.length = 0;

    for (const bindGroup of bindGroups) {
      record.bindGroupKeys.push(bindGroup.resourceKey);
    }

    record.meshResourceKey = command.meshResourceKey;
    record.materialResourceKey = command.materialResourceKey;
    record.vertexBufferKeys.length = 0;

    for (const vertexBufferKey of command.vertexBufferKeys) {
      record.vertexBufferKeys.push(vertexBufferKey);
    }

    record.vertexCount = command.vertexCount;
    record.indexBufferKey = command.indexBufferKey;
    record.indexCount = command.indexCount;
    record.instanceCount = 1;
    record.transformPackedOffset = command.transformPackedOffset;
    scratch.draws.push(record);
  }

  (scratch.plan as MutableRenderPassDrawListPlan).valid =
    scratch.diagnostics.length === 0;

  return scratch.plan;
}

function resolveBindGroups(
  command: DrawCommandDescriptor,
  bindGroups: readonly UnlitBindGroupResource[],
  requiredGroups: readonly number[],
  scratch: RenderPassDrawListScratch,
): readonly UnlitBindGroupResource[] {
  scratch.resolvedBindGroups.length = 0;

  for (const group of requiredGroups) {
    const bindGroup = findBindGroup(command, bindGroups, group, scratch);

    if (bindGroup === undefined) {
      scratch.diagnostics.push({
        code: "renderPassDrawList.missingBindGroupResource",
        renderId: command.renderId,
        bindGroup:
          group === 2
            ? { group, materialResourceKey: command.materialResourceKey }
            : { group },
        message:
          group === 2
            ? `Missing material bind group resource for material '${command.materialResourceKey}' on render id ${command.renderId}.`
            : `Missing bind group resource for group ${group} on render id ${command.renderId}.`,
      });
      continue;
    }

    scratch.resolvedBindGroups.push(bindGroup);
  }

  return scratch.resolvedBindGroups;
}

function findBindGroup(
  command: DrawCommandDescriptor,
  bindGroups: readonly UnlitBindGroupResource[],
  group: number,
  scratch: RenderPassDrawListScratch,
): UnlitBindGroupResource | undefined {
  if (group === 2) {
    return findMaterialBindGroup(command, bindGroups, group, scratch);
  }

  let firstCandidate: UnlitBindGroupResource | undefined;
  let hasPipelineScopedCandidate = false;

  for (const bindGroup of bindGroups) {
    if (bindGroup.group !== group) {
      continue;
    }

    firstCandidate ??= bindGroup;

    if (!hasPipelineScopedKey(bindGroup, scratch.pipelineKeys)) {
      continue;
    }

    hasPipelineScopedCandidate = true;

    if (bindGroup.entryResourceKeys.includes(command.pipelineKey)) {
      return bindGroup;
    }
  }

  return hasPipelineScopedCandidate ? undefined : firstCandidate;
}

function findMaterialBindGroup(
  command: DrawCommandDescriptor,
  bindGroups: readonly UnlitBindGroupResource[],
  group: number,
  scratch: RenderPassDrawListScratch,
): UnlitBindGroupResource | undefined {
  let firstCandidate: UnlitBindGroupResource | undefined;
  let hasPipelineScopedCandidate = false;

  for (const bindGroup of bindGroups) {
    if (bindGroup.group !== group) {
      continue;
    }

    if (!bindGroup.entryResourceKeys.includes(command.materialResourceKey)) {
      continue;
    }

    firstCandidate ??= bindGroup;

    if (!hasPipelineScopedKey(bindGroup, scratch.pipelineKeys)) {
      continue;
    }

    hasPipelineScopedCandidate = true;

    if (bindGroup.entryResourceKeys.includes(command.pipelineKey)) {
      return bindGroup;
    }
  }

  return hasPipelineScopedCandidate ? undefined : firstCandidate;
}

function hasPipelineScopedKey(
  bindGroup: UnlitBindGroupResource,
  pipelineKeys: ReadonlySet<string>,
): boolean {
  for (const resourceKey of bindGroup.entryResourceKeys) {
    if (pipelineKeys.has(resourceKey)) {
      return true;
    }
  }

  return false;
}

function drawListRecordAt(
  scratch: RenderPassDrawListScratch,
  index: number,
): MutableRenderPassDrawListRecord {
  const existing = scratch.drawPool[index] as
    | MutableRenderPassDrawListRecord
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const record = createEmptyDrawListRecord();

  scratch.drawPool.push(record);
  return record;
}

function createEmptyDrawListRecord(): MutableRenderPassDrawListRecord {
  return {
    renderId: 0,
    pipelineKey: "",
    bindGroupKeys: [],
    meshResourceKey: "",
    materialResourceKey: "",
    vertexBufferKeys: [],
    vertexCount: 0,
    indexBufferKey: null,
    indexCount: null,
    instanceCount: 1,
    transformPackedOffset: 0,
  };
}

type MutableRenderPassDrawListPlan = {
  -readonly [Key in keyof RenderPassDrawListPlan]: RenderPassDrawListPlan[Key];
};
