import type {
  DrawCommandDescriptor,
  DrawCommandDescriptorDiagnostic,
} from "./draw-command.js";
import type { GetOrCreateRenderPipelineResult } from "./pipeline-cache-integration.js";
import type { UnlitBindGroupResource } from "./unlit-bind-group.js";

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

export function planRenderPassDrawList(
  options: RenderPassDrawListOptions,
): RenderPassDrawListPlan {
  const pipelineKeys = new Set(
    options.pipelines.flatMap((pipeline) =>
      pipeline.ok ? [pipeline.key] : [],
    ),
  );
  const diagnostics: RenderPassDrawListDiagnostic[] = [];
  const draws: RenderPassDrawListRecord[] = [];
  const requiredGroups = options.requiredBindGroupGroups ?? [0, 1, 2];

  for (const command of [...options.drawCommands].sort(
    (a, b) => a.renderId - b.renderId,
  )) {
    let ready = true;

    if (!pipelineKeys.has(command.pipelineKey)) {
      diagnostics.push({
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
      diagnostics,
    );

    if (bindGroups.length !== requiredGroups.length) {
      ready = false;
    }

    if (!ready) {
      continue;
    }

    draws.push({
      renderId: command.renderId,
      pipelineKey: command.pipelineKey,
      bindGroupKeys: bindGroups.map((bindGroup) => bindGroup.resourceKey),
      meshResourceKey: command.meshResourceKey,
      materialResourceKey: command.materialResourceKey,
      vertexBufferKeys: command.vertexBufferKeys,
      vertexCount: command.vertexCount,
      indexBufferKey: command.indexBufferKey,
      indexCount: command.indexCount,
      instanceCount: 1,
      transformPackedOffset: command.transformPackedOffset,
    });
  }

  return {
    valid: diagnostics.length === 0,
    draws,
    diagnostics,
  };
}

function resolveBindGroups(
  command: DrawCommandDescriptor,
  bindGroups: readonly UnlitBindGroupResource[],
  requiredGroups: readonly number[],
  diagnostics: RenderPassDrawListDiagnostic[],
): readonly UnlitBindGroupResource[] {
  const resolved: UnlitBindGroupResource[] = [];

  for (const group of requiredGroups) {
    const bindGroup = findBindGroup(command, bindGroups, group);

    if (bindGroup === undefined) {
      diagnostics.push({
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

    resolved.push(bindGroup);
  }

  return resolved;
}

function findBindGroup(
  command: DrawCommandDescriptor,
  bindGroups: readonly UnlitBindGroupResource[],
  group: number,
): UnlitBindGroupResource | undefined {
  const candidates = bindGroups.filter(
    (bindGroup) => bindGroup.group === group,
  );

  if (group === 2) {
    return candidates.find((bindGroup) =>
      bindGroup.entryResourceKeys.includes(command.materialResourceKey),
    );
  }

  return candidates[0];
}
