import {
  planRenderPassCommands,
  type RenderPassCommand,
  type RenderPassCommandDiagnostic,
} from "../render/passes/render-pass-commands.js";
import type { ResolvedRenderPassDraw } from "../render/passes/render-pass-resources.js";
import type { ShadowCasterCommandPlanReadinessReport } from "./shadow-caster-command-plan-readiness.js";
import type { ShadowCasterFrameResourceReadinessReport } from "./shadow-caster-frame-resource-readiness.js";

export type ShadowCasterCommandRecordPlanStatus =
  | "ready"
  | "missing"
  | "not-required";

export type ShadowCasterCommandRecordPlanDiagnosticCode =
  | "shadowCasterCommandRecord.frameResourcesNotReady"
  | "shadowCasterCommandRecord.missingCommandPlan"
  | "shadowCasterCommandRecord.missingPipelineResource"
  | "shadowCasterCommandRecord.missingMatrixBindGroupResource"
  | "shadowCasterCommandRecord.missingMeshResource"
  | "shadowCasterCommandRecord.missingVertexBufferResource"
  | "shadowCasterCommandRecord.missingIndexBufferResource"
  | "shadowCasterCommandRecord.invalidMatrixOffset"
  | "shadowCasterCommandRecord.commandPlanningFailed"
  | "shadowCasterCommandRecord.passSubmissionDeferred"
  | "shadowCasterCommandRecord.shaderSamplingDeferred";

export interface ShadowCasterCommandRecordPlanDiagnostic {
  readonly code: ShadowCasterCommandRecordPlanDiagnosticCode;
  readonly severity: "warning" | "error";
  readonly message: string;
  readonly passKey?: string;
  readonly renderId?: number;
  readonly resourceKey?: string;
}

export interface ShadowCasterPipelineResourceView {
  readonly pipelineKey: string;
  readonly resourceKey: string;
  readonly pipeline: unknown;
}

export interface ShadowCasterMatrixBindGroupResourceView {
  readonly matrixResourceKey: string;
  readonly passKey?: string;
  readonly worldTransformResourceKey?: string;
  readonly resourceKey: string;
  readonly group: number;
  readonly bindGroup: unknown;
}

export interface ShadowCasterExecutableVertexBufferView {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly vertexCount: number;
}

export interface ShadowCasterExecutableIndexBufferView {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly format: string;
  readonly indexCount: number;
}

export interface ShadowCasterExecutableMeshResourceView {
  readonly meshKey: string;
  readonly meshResourceKey: string;
  readonly vertexBuffers: readonly ShadowCasterExecutableVertexBufferView[];
  readonly indexBuffer: ShadowCasterExecutableIndexBufferView | null;
}

export interface ShadowCasterExecutableCommandRecord {
  readonly passKey: string;
  readonly commandKey: string;
  readonly commands: readonly RenderPassCommand[];
}

export interface ShadowCasterCommandRecordPlanRecord {
  readonly passKey: string;
  readonly commandKey: string;
  readonly renderIds: readonly number[];
  readonly commandCount: number;
  readonly drawCalls: number;
  readonly indexedDrawCalls: number;
  readonly pipelineKeys: readonly string[];
  readonly pipelineResourceKeys: readonly string[];
  readonly bindGroupResourceKeys: readonly string[];
  readonly vertexBufferResourceKeys: readonly string[];
  readonly indexBufferResourceKeys: readonly string[];
  readonly drawCommandKeys: readonly string[];
}

export interface ShadowCasterCommandRecordPlanReport {
  readonly ready: boolean;
  readonly status: ShadowCasterCommandRecordPlanStatus;
  readonly counts: {
    readonly frameResourceDraws: number;
    readonly readyFrameResourceDraws: number;
    readonly pipelineResources: number;
    readonly matrixBindGroups: number;
    readonly meshResources: number;
    readonly commandRecords: number;
    readonly commandCount: number;
    readonly drawCalls: number;
    readonly indexedDrawCalls: number;
  };
  readonly sections: {
    readonly frameResources: boolean;
    readonly commandPlans: boolean;
    readonly pipelineResources: boolean;
    readonly matrixBindGroups: boolean;
    readonly meshBuffers: boolean;
    readonly commandRecords: boolean;
    readonly commandBufferFinish: false;
    readonly queueSubmission: false;
    readonly shaderSampling: false;
  };
  readonly records: readonly ShadowCasterCommandRecordPlanRecord[];
  readonly commandRecords: readonly ShadowCasterExecutableCommandRecord[];
  readonly diagnostics: readonly ShadowCasterCommandRecordPlanDiagnostic[];
}

export type ShadowCasterCommandRecordPlanReportJsonValue = Omit<
  ShadowCasterCommandRecordPlanReport,
  "commandRecords"
> & {
  readonly commandRecords: readonly {
    readonly passKey: string;
    readonly commandKey: string;
    readonly commandCount: number;
  }[];
};

export interface CreateShadowCasterCommandRecordPlanReportOptions {
  readonly frameResources: ShadowCasterFrameResourceReadinessReport;
  readonly commandPlan: ShadowCasterCommandPlanReadinessReport;
  readonly pipelines?: readonly ShadowCasterPipelineResourceView[];
  readonly matrixBindGroups?: readonly ShadowCasterMatrixBindGroupResourceView[];
  readonly meshes?: readonly ShadowCasterExecutableMeshResourceView[];
  /** Legacy per-`${passKey}:${renderId}` baked-entry index fallback. */
  readonly bakedMatrixIndexByPassDraw?: ReadonlyMap<string, number>;
  /** Legacy group-0 bind group over the baked caster matrix fallback buffer. */
  readonly bakedMatrixBindGroup?: ShadowCasterMatrixBindGroupResourceView;
  /**
   * Per-`${passKey}:${renderId}` entry index into the shadow caster WORLD
   * transform buffer. When supplied with pass-keyed matrix bind groups, the
   * caster shader computes `passLightVP * worldTransforms[instance] * local`.
   */
  readonly worldTransformIndexByPassDraw?: ReadonlyMap<string, number>;
}

interface ShadowCasterResolvedDraw extends ResolvedRenderPassDraw {
  readonly renderIds: number[];
}

interface MutableShadowCasterResolvedDraw extends ShadowCasterResolvedDraw {
  instanceCount: number;
}

export function createShadowCasterCommandRecordPlanReport(
  options: CreateShadowCasterCommandRecordPlanReportOptions,
): ShadowCasterCommandRecordPlanReport {
  if (options.frameResources.status === "not-required") {
    return report({
      status: "not-required",
      frameResources: options.frameResources,
      pipelines: options.pipelines ?? [],
      matrixBindGroups: options.matrixBindGroups ?? [],
      meshes: options.meshes ?? [],
      records: [],
      commandRecords: [],
      diagnostics: [],
    });
  }

  const pipelines = new Map(
    (options.pipelines ?? []).map((pipeline) => [
      pipeline.pipelineKey,
      pipeline,
    ]),
  );
  const matrixBindGroups = new Map(
    (options.matrixBindGroups ?? []).map((bindGroup) => [
      bindGroup.matrixResourceKey,
      bindGroup,
    ]),
  );
  const matrixBindGroupsByPass = new Map(
    (options.matrixBindGroups ?? []).flatMap((bindGroup) =>
      bindGroup.passKey === undefined ? [] : [[bindGroup.passKey, bindGroup]],
    ),
  );
  const meshes = new Map(
    (options.meshes ?? []).map((mesh) => [mesh.meshResourceKey, mesh]),
  );
  const commandPlans = new Map(
    options.commandPlan.commands.map((command) => [command.passKey, command]),
  );
  const diagnostics: ShadowCasterCommandRecordPlanDiagnostic[] = [];
  const resolvedDrawsByPass = new Map<string, ShadowCasterResolvedDraw[]>();

  if (options.frameResources.counts.readyDraws === 0) {
    diagnostics.push({
      code: "shadowCasterCommandRecord.frameResourcesNotReady",
      severity: "warning",
      message:
        "Shadow caster command records require at least one ready caster frame-resource record.",
    });
  }

  for (const record of options.frameResources.records) {
    if (!record.ready) {
      diagnostics.push({
        code: "shadowCasterCommandRecord.frameResourcesNotReady",
        severity: "warning",
        passKey: record.passKey,
        renderId: record.renderId,
        message: `Shadow caster '${record.renderId}' does not have ready frame resources for executable command records.`,
      });
      continue;
    }

    const commandPlan = commandPlans.get(record.passKey);
    const pipeline =
      record.pipelineKey === null
        ? undefined
        : pipelines.get(record.pipelineKey);
    const matrixBindGroup =
      matrixBindGroupsByPass.get(record.passKey) ??
      (record.matrixResourceKey === null
        ? undefined
        : matrixBindGroups.get(record.matrixResourceKey));
    const mesh =
      record.meshResourceKey === null
        ? undefined
        : meshes.get(record.meshResourceKey);

    if (commandPlan === undefined) {
      diagnostics.push({
        code: "shadowCasterCommandRecord.missingCommandPlan",
        severity: "warning",
        passKey: record.passKey,
        renderId: record.renderId,
        message: `Shadow caster '${record.renderId}' has no command plan for pass '${record.passKey}'.`,
      });
    }

    if (record.pipelineKey === null || pipeline === undefined) {
      const diagnostic: ShadowCasterCommandRecordPlanDiagnostic = {
        code: "shadowCasterCommandRecord.missingPipelineResource",
        severity: "warning",
        passKey: record.passKey,
        renderId: record.renderId,
        message: `Shadow caster '${record.renderId}' requires a live depth-only pipeline resource.`,
      };

      if (record.pipelineKey !== null) {
        diagnostics.push({ ...diagnostic, resourceKey: record.pipelineKey });
      } else {
        diagnostics.push(diagnostic);
      }
    }

    if (record.matrixResourceKey === null || matrixBindGroup === undefined) {
      const diagnostic: ShadowCasterCommandRecordPlanDiagnostic = {
        code: "shadowCasterCommandRecord.missingMatrixBindGroupResource",
        severity: "warning",
        passKey: record.passKey,
        renderId: record.renderId,
        message: `Shadow caster '${record.renderId}' requires a live shadow matrix bind group resource.`,
      };

      if (record.matrixResourceKey !== null) {
        diagnostics.push({
          ...diagnostic,
          resourceKey: record.matrixResourceKey,
        });
      } else {
        diagnostics.push(diagnostic);
      }
    }

    if (record.meshResourceKey === null || mesh === undefined) {
      const diagnostic: ShadowCasterCommandRecordPlanDiagnostic = {
        code: "shadowCasterCommandRecord.missingMeshResource",
        severity: "warning",
        passKey: record.passKey,
        renderId: record.renderId,
        message: `Shadow caster '${record.renderId}' requires a live prepared mesh resource.`,
      };

      if (record.meshResourceKey !== null) {
        diagnostics.push({
          ...diagnostic,
          resourceKey: record.meshResourceKey,
        });
      } else {
        diagnostics.push(diagnostic);
      }
    }

    if (
      commandPlan === undefined ||
      pipeline === undefined ||
      matrixBindGroup === undefined ||
      mesh === undefined
    ) {
      continue;
    }

    const vertexBuffers = resolveVertexBuffers(record, mesh, diagnostics);
    const indexBuffer = resolveIndexBuffer(record, mesh, diagnostics);
    // Preferred path: firstInstance selects this caster's draw-list-order WORLD
    // matrix while the pass-keyed bind group selects the light view-projection.
    // The baked matrix path remains a legacy fallback for older low-level tests.
    const passDrawKey = `${record.passKey}:${record.renderId}`;
    const worldTransformIndex =
      options.worldTransformIndexByPassDraw?.get(passDrawKey);
    const useWorldTransform =
      worldTransformIndex !== undefined &&
      matrixBindGroup?.worldTransformResourceKey !== undefined;
    const bakedIndex = options.bakedMatrixIndexByPassDraw?.get(passDrawKey);
    const useBaked =
      !useWorldTransform &&
      bakedIndex !== undefined &&
      options.bakedMatrixBindGroup !== undefined;
    const transformPackedOffset = useBaked
      ? bakedIndex * 16
      : useWorldTransform
        ? worldTransformIndex * 16
        : matrixOffsetBytesToPackedOffset(commandPlan.matrixOffsetBytes);

    if (transformPackedOffset === null) {
      diagnostics.push({
        code: "shadowCasterCommandRecord.invalidMatrixOffset",
        severity: "warning",
        passKey: record.passKey,
        renderId: record.renderId,
        message: `Shadow caster '${record.renderId}' has invalid matrix byte offset '${String(commandPlan.matrixOffsetBytes)}'.`,
      });
    }

    if (
      vertexBuffers.length !== record.vertexBufferResourceKeys.length ||
      indexBuffer === null ||
      transformPackedOffset === null
    ) {
      continue;
    }

    const activeBindGroup =
      useBaked && options.bakedMatrixBindGroup !== undefined
        ? options.bakedMatrixBindGroup
        : matrixBindGroup;
    const draw: ShadowCasterResolvedDraw = {
      renderId: record.renderId,
      renderIds: [record.renderId],
      pipelineKey: pipeline.pipelineKey,
      pipeline: pipeline.pipeline,
      bindGroups: [
        {
          group: activeBindGroup.group,
          resourceKey: activeBindGroup.resourceKey,
          bindGroup: activeBindGroup.bindGroup,
        },
      ],
      vertexBuffers,
      vertexCount: record.vertexCount ?? meshVertexCount(vertexBuffers),
      vertexStart: record.vertexStart ?? 0,
      indexBuffer,
      indexCount: record.indexCount ?? indexBuffer.indexCount,
      indexStart: record.indexStart ?? 0,
      instanceCount: 1,
      transformPackedOffset,
    };
    const draws = resolvedDrawsByPass.get(record.passKey);

    if (draws === undefined) {
      resolvedDrawsByPass.set(record.passKey, [draw]);
    } else {
      pushShadowCasterResolvedDraw(draws, draw);
    }
  }

  const records: ShadowCasterCommandRecordPlanRecord[] = [];
  const commandRecords: ShadowCasterExecutableCommandRecord[] = [];

  for (const [passKey, draws] of resolvedDrawsByPass) {
    const plan = planRenderPassCommands({ draws });

    diagnostics.push(...mapCommandDiagnostics(passKey, plan.diagnostics));

    if (!plan.valid) {
      continue;
    }

    const commandKey =
      commandPlans.get(passKey)?.commandKey ??
      `${passKey}:executable-caster-commands`;
    commandRecords.push({
      passKey,
      commandKey,
      commands: [...plan.commands],
    });
    records.push(createRecord(passKey, commandKey, draws, plan.commands));
  }

  if (records.length > 0) {
    diagnostics.push({
      code: "shadowCasterCommandRecord.passSubmissionDeferred",
      severity: "warning",
      message:
        "Shadow caster command records are executable, but command-buffer finish and queue submission are deferred.",
    });
    diagnostics.push({
      code: "shadowCasterCommandRecord.shaderSamplingDeferred",
      severity: "warning",
      message:
        "Shadow caster command records are executable, but StandardMaterial shadow sampling remains deferred.",
    });
  }

  const hasBlockingDiagnostics = diagnostics.some(
    (diagnostic) =>
      diagnostic.code !== "shadowCasterCommandRecord.passSubmissionDeferred" &&
      diagnostic.code !== "shadowCasterCommandRecord.shaderSamplingDeferred",
  );

  return report({
    status:
      hasBlockingDiagnostics || commandRecords.length === 0
        ? "missing"
        : "ready",
    frameResources: options.frameResources,
    pipelines: options.pipelines ?? [],
    matrixBindGroups: options.matrixBindGroups ?? [],
    meshes: options.meshes ?? [],
    records,
    commandRecords,
    diagnostics,
  });
}

export function shadowCasterCommandRecordPlanReportToJsonValue(
  value: ShadowCasterCommandRecordPlanReport,
): ShadowCasterCommandRecordPlanReportJsonValue {
  return {
    ready: value.ready,
    status: value.status,
    counts: { ...value.counts },
    sections: { ...value.sections },
    records: value.records.map((record) => ({
      ...record,
      renderIds: [...record.renderIds],
      pipelineKeys: [...record.pipelineKeys],
      pipelineResourceKeys: [...record.pipelineResourceKeys],
      bindGroupResourceKeys: [...record.bindGroupResourceKeys],
      vertexBufferResourceKeys: [...record.vertexBufferResourceKeys],
      indexBufferResourceKeys: [...record.indexBufferResourceKeys],
      drawCommandKeys: [...record.drawCommandKeys],
    })),
    commandRecords: value.commandRecords.map((record) => ({
      passKey: record.passKey,
      commandKey: record.commandKey,
      commandCount: record.commands.length,
    })),
    diagnostics: value.diagnostics.map((diagnostic) => ({ ...diagnostic })),
  };
}

export function shadowCasterCommandRecordPlanReportToJson(
  value: ShadowCasterCommandRecordPlanReport,
): string {
  return JSON.stringify(shadowCasterCommandRecordPlanReportToJsonValue(value));
}

function resolveVertexBuffers(
  record: ShadowCasterFrameResourceReadinessReport["records"][number],
  mesh: ShadowCasterExecutableMeshResourceView,
  diagnostics: ShadowCasterCommandRecordPlanDiagnostic[],
): ResolvedRenderPassDraw["vertexBuffers"] {
  const byKey = new Map(
    mesh.vertexBuffers.map((buffer) => [buffer.resourceKey, buffer]),
  );
  const vertexBuffers: ResolvedRenderPassDraw["vertexBuffers"][number][] = [];

  if (record.vertexBufferResourceKeys.length === 0) {
    diagnostics.push({
      code: "shadowCasterCommandRecord.missingVertexBufferResource",
      severity: "warning",
      passKey: record.passKey,
      renderId: record.renderId,
      message: `Shadow caster '${record.renderId}' requires at least one vertex buffer resource.`,
    });
  }

  for (const resourceKey of record.vertexBufferResourceKeys) {
    const buffer = byKey.get(resourceKey);

    if (buffer === undefined) {
      diagnostics.push({
        code: "shadowCasterCommandRecord.missingVertexBufferResource",
        severity: "warning",
        passKey: record.passKey,
        renderId: record.renderId,
        resourceKey,
        message: `Shadow caster '${record.renderId}' is missing vertex buffer resource '${resourceKey}'.`,
      });
      continue;
    }

    vertexBuffers.push(buffer);
  }

  return vertexBuffers;
}

function resolveIndexBuffer(
  record: ShadowCasterFrameResourceReadinessReport["records"][number],
  mesh: ShadowCasterExecutableMeshResourceView,
  diagnostics: ShadowCasterCommandRecordPlanDiagnostic[],
): ResolvedRenderPassDraw["indexBuffer"] {
  if (
    record.indexBufferResourceKey === null ||
    mesh.indexBuffer === null ||
    mesh.indexBuffer.resourceKey !== record.indexBufferResourceKey
  ) {
    const diagnostic: ShadowCasterCommandRecordPlanDiagnostic = {
      code: "shadowCasterCommandRecord.missingIndexBufferResource",
      severity: "warning",
      passKey: record.passKey,
      renderId: record.renderId,
      message: `Shadow caster '${record.renderId}' requires an index buffer resource for depth-only shadow drawing.`,
    };

    if (record.indexBufferResourceKey !== null) {
      diagnostics.push({
        ...diagnostic,
        resourceKey: record.indexBufferResourceKey,
      });
    } else {
      diagnostics.push(diagnostic);
    }
    return null;
  }

  return mesh.indexBuffer;
}

function mapCommandDiagnostics(
  passKey: string,
  diagnostics: readonly RenderPassCommandDiagnostic[],
): readonly ShadowCasterCommandRecordPlanDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    code: "shadowCasterCommandRecord.commandPlanningFailed",
    severity: "warning",
    passKey,
    renderId: diagnostic.renderId,
    message: diagnostic.message,
  }));
}

function createRecord(
  passKey: string,
  commandKey: string,
  draws: readonly ShadowCasterResolvedDraw[],
  commands: readonly RenderPassCommand[],
): ShadowCasterCommandRecordPlanRecord {
  return {
    passKey,
    commandKey,
    renderIds: draws.flatMap((draw) => draw.renderIds),
    commandCount: commands.length,
    drawCalls: commands.filter(
      (command) => command.kind === "draw" || command.kind === "drawIndexed",
    ).length,
    indexedDrawCalls: commands.filter(
      (command) => command.kind === "drawIndexed",
    ).length,
    pipelineKeys: unique(draws.map((draw) => draw.pipelineKey)),
    pipelineResourceKeys: unique(
      commands.flatMap((command) =>
        command.kind === "setPipeline" ? [command.pipelineKey] : [],
      ),
    ),
    bindGroupResourceKeys: unique(
      commands.flatMap((command) =>
        command.kind === "setBindGroup" ? [command.resourceKey] : [],
      ),
    ),
    vertexBufferResourceKeys: unique(
      commands.flatMap((command) =>
        command.kind === "setVertexBuffer" ? [command.resourceKey] : [],
      ),
    ),
    indexBufferResourceKeys: unique(
      commands.flatMap((command) =>
        command.kind === "setIndexBuffer" ? [command.resourceKey] : [],
      ),
    ),
    drawCommandKeys: draws.flatMap((draw) =>
      draw.renderIds.map((renderId) => `${passKey}:draw:${renderId}`),
    ),
  };
}

function pushShadowCasterResolvedDraw(
  draws: ShadowCasterResolvedDraw[],
  draw: ShadowCasterResolvedDraw,
): void {
  const previous = draws[draws.length - 1];

  if (canCoalesceShadowCasterDraw(previous, draw)) {
    const mutable = previous as MutableShadowCasterResolvedDraw;

    mutable.instanceCount += draw.instanceCount;
    mutable.renderIds.push(...draw.renderIds);
    return;
  }

  draws.push(draw);
}

function canCoalesceShadowCasterDraw(
  previous: ShadowCasterResolvedDraw | undefined,
  draw: ShadowCasterResolvedDraw,
): boolean {
  if (previous === undefined) {
    return false;
  }

  return (
    previous.pipelineKey === draw.pipelineKey &&
    previous.pipeline === draw.pipeline &&
    previous.occlusionQuery !== true &&
    draw.occlusionQuery !== true &&
    previous.vertexStart === draw.vertexStart &&
    previous.vertexCount === draw.vertexCount &&
    previous.indexStart === draw.indexStart &&
    previous.indexCount === draw.indexCount &&
    shadowCasterResolvedDrawResourcesMatch(previous, draw) &&
    previous.transformPackedOffset + previous.instanceCount * 16 ===
      draw.transformPackedOffset
  );
}

function shadowCasterResolvedDrawResourcesMatch(
  a: ShadowCasterResolvedDraw,
  b: ShadowCasterResolvedDraw,
): boolean {
  if (
    a.bindGroups.length !== b.bindGroups.length ||
    a.vertexBuffers.length !== b.vertexBuffers.length
  ) {
    return false;
  }

  for (let index = 0; index < a.bindGroups.length; index += 1) {
    const left = a.bindGroups[index];
    const right = b.bindGroups[index];

    if (
      left === undefined ||
      right === undefined ||
      left.group !== right.group ||
      left.resourceKey !== right.resourceKey ||
      left.bindGroup !== right.bindGroup
    ) {
      return false;
    }
  }

  for (let index = 0; index < a.vertexBuffers.length; index += 1) {
    const left = a.vertexBuffers[index];
    const right = b.vertexBuffers[index];

    if (
      left === undefined ||
      right === undefined ||
      left.resourceKey !== right.resourceKey ||
      left.vertexCount !== right.vertexCount ||
      left.buffer !== right.buffer
    ) {
      return false;
    }
  }

  if (a.indexBuffer === null || b.indexBuffer === null) {
    return a.indexBuffer === b.indexBuffer;
  }

  return (
    a.indexBuffer.resourceKey === b.indexBuffer.resourceKey &&
    a.indexBuffer.format === b.indexBuffer.format &&
    a.indexBuffer.indexCount === b.indexBuffer.indexCount &&
    a.indexBuffer.buffer === b.indexBuffer.buffer
  );
}

function matrixOffsetBytesToPackedOffset(offsetBytes: number): number | null {
  if (
    !Number.isInteger(offsetBytes) ||
    offsetBytes < 0 ||
    offsetBytes % 4 !== 0
  ) {
    return null;
  }

  return offsetBytes / 4;
}

function meshVertexCount(
  vertexBuffers: readonly ResolvedRenderPassDraw["vertexBuffers"][number][],
): number {
  if (vertexBuffers.length === 0) {
    return 0;
  }

  return Math.min(...vertexBuffers.map((buffer) => buffer.vertexCount));
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function report(input: {
  readonly status: ShadowCasterCommandRecordPlanStatus;
  readonly frameResources: ShadowCasterFrameResourceReadinessReport;
  readonly pipelines: readonly ShadowCasterPipelineResourceView[];
  readonly matrixBindGroups: readonly ShadowCasterMatrixBindGroupResourceView[];
  readonly meshes: readonly ShadowCasterExecutableMeshResourceView[];
  readonly records: readonly ShadowCasterCommandRecordPlanRecord[];
  readonly commandRecords: readonly ShadowCasterExecutableCommandRecord[];
  readonly diagnostics: readonly ShadowCasterCommandRecordPlanDiagnostic[];
}): ShadowCasterCommandRecordPlanReport {
  const commandCount = input.records.reduce(
    (sum, record) => sum + record.commandCount,
    0,
  );
  const drawCalls = input.records.reduce(
    (sum, record) => sum + record.drawCalls,
    0,
  );
  const indexedDrawCalls = input.records.reduce(
    (sum, record) => sum + record.indexedDrawCalls,
    0,
  );

  return {
    ready: input.status === "ready" || input.status === "not-required",
    status: input.status,
    counts: {
      frameResourceDraws: input.frameResources.counts.casterDraws,
      readyFrameResourceDraws: input.frameResources.counts.readyDraws,
      pipelineResources: input.pipelines.length,
      matrixBindGroups: input.matrixBindGroups.length,
      meshResources: input.meshes.length,
      commandRecords: input.commandRecords.length,
      commandCount,
      drawCalls,
      indexedDrawCalls,
    },
    sections: {
      frameResources:
        input.frameResources.status === "not-required" ||
        input.frameResources.counts.readyDraws > 0,
      commandPlans:
        input.frameResources.status === "not-required" ||
        input.records.length > 0,
      pipelineResources: input.pipelines.length > 0,
      matrixBindGroups: input.matrixBindGroups.length > 0,
      meshBuffers: input.meshes.length > 0,
      commandRecords: input.commandRecords.length > 0,
      commandBufferFinish: false,
      queueSubmission: false,
      shaderSampling: false,
    },
    records: input.records,
    commandRecords: input.commandRecords,
    diagnostics: input.diagnostics,
  };
}
