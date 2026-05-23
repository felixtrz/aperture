import type { MeshGpuBufferResource } from "./mesh-buffer-resources.js";
import type { GetOrCreateRenderPipelineResult } from "./pipeline-cache-integration.js";
import type { InstanceAttributeGpuBufferResource } from "./instance-attribute-buffer.js";
import type { InstanceTintGpuBufferResource } from "./instance-tint-buffer.js";
import type {
  RenderPassDrawListDiagnostic,
  RenderPassDrawListRecord,
} from "./render-pass-draw-list.js";
import type {
  UnlitBindGroupResource,
  UnlitBindGroupResourceDiagnostic,
} from "./unlit-bind-group.js";

export type RenderPassResourceDiagnosticCode =
  | "renderPassResource.missingPipeline"
  | "renderPassResource.missingBindGroup"
  | "renderPassResource.missingVertexBuffer"
  | "renderPassResource.missingIndexBuffer";

export interface RenderPassResourceDiagnostic {
  readonly code: RenderPassResourceDiagnosticCode;
  readonly message: string;
  readonly renderId: number;
  readonly resourceKey: string;
}

export interface ResolvedRenderPassBindGroup {
  readonly group: number;
  readonly resourceKey: string;
  readonly bindGroup: unknown;
}

export interface ResolvedRenderPassVertexBuffer {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly vertexCount: number;
}

export interface ResolvedRenderPassIndexBuffer {
  readonly resourceKey: string;
  readonly buffer: unknown;
  readonly format: string;
  readonly indexCount: number;
}

export interface ResolvedRenderPassDraw {
  readonly renderId: number;
  readonly pipelineKey: string;
  readonly pipeline: unknown;
  readonly bindGroups: readonly ResolvedRenderPassBindGroup[];
  readonly vertexBuffers: readonly ResolvedRenderPassVertexBuffer[];
  readonly vertexCount: number;
  readonly indexBuffer: ResolvedRenderPassIndexBuffer | null;
  readonly indexCount: number | null;
  readonly instanceCount: number;
  readonly transformPackedOffset: number;
  readonly occlusionQuery?: boolean;
}

export interface ResolveRenderPassResourcesOptions {
  readonly drawList: readonly RenderPassDrawListRecord[];
  readonly pipelines: readonly GetOrCreateRenderPipelineResult[];
  readonly bindGroups: readonly UnlitBindGroupResource[];
  readonly meshResources: readonly MeshGpuBufferResource[];
  readonly instanceTintResources?: readonly InstanceTintGpuBufferResource[];
  readonly instanceAttributeResources?: readonly InstanceAttributeGpuBufferResource[];
}

export interface ResolveRenderPassResourcesResult {
  readonly valid: boolean;
  readonly draws: readonly ResolvedRenderPassDraw[];
  readonly diagnostics: readonly (
    | RenderPassDrawListDiagnostic
    | UnlitBindGroupResourceDiagnostic
    | RenderPassResourceDiagnostic
  )[];
}

export interface ResolveRenderPassResourcesScratch {
  readonly draws: ResolvedRenderPassDraw[];
  readonly diagnostics: RenderPassResourceDiagnostic[];
  readonly drawPool: ResolvedRenderPassDraw[];
  readonly bindGroupPool: ResolvedRenderPassBindGroup[];
  readonly vertexBufferPool: ResolvedRenderPassVertexBuffer[];
  readonly indexBufferPool: ResolvedRenderPassIndexBuffer[];
  readonly pipelines: Map<string, unknown>;
  readonly bindGroups: Map<string, UnlitBindGroupResource>;
  readonly vertexBuffers: Map<
    string,
    MeshGpuBufferResource["vertexBuffers"][number]
  >;
  readonly indexBuffers: Map<
    string,
    NonNullable<MeshGpuBufferResource["indexBuffer"]>
  >;
  readonly plan: ResolveRenderPassResourcesResult;
  bindGroupCursor: number;
  vertexBufferCursor: number;
  indexBufferCursor: number;
}

interface MutableResolvedRenderPassDraw {
  renderId: number;
  pipelineKey: string;
  pipeline: unknown;
  bindGroups: ResolvedRenderPassBindGroup[];
  vertexBuffers: ResolvedRenderPassVertexBuffer[];
  vertexCount: number;
  indexBuffer: ResolvedRenderPassIndexBuffer | null;
  indexCount: number | null;
  instanceCount: number;
  transformPackedOffset: number;
  occlusionQuery?: boolean;
}

interface MutableResolvedRenderPassBindGroup {
  group: number;
  resourceKey: string;
  bindGroup: unknown;
}

interface MutableResolvedRenderPassVertexBuffer {
  resourceKey: string;
  buffer: unknown;
  vertexCount: number;
}

interface MutableResolvedRenderPassIndexBuffer {
  resourceKey: string;
  buffer: unknown;
  format: string;
  indexCount: number;
}

export function resolveRenderPassResources(
  options: ResolveRenderPassResourcesOptions,
): ResolveRenderPassResourcesResult {
  const scratch = createResolveRenderPassResourcesScratch();

  writeResolveRenderPassResources(options, scratch);

  return scratch.plan;
}

export function createResolveRenderPassResourcesScratch(
  capacity = 0,
): ResolveRenderPassResourcesScratch {
  const draws: ResolvedRenderPassDraw[] = [];
  const diagnostics: RenderPassResourceDiagnostic[] = [];
  const drawPool: ResolvedRenderPassDraw[] = [];

  for (let i = 0; i < capacity; i += 1) {
    drawPool.push(createEmptyResolvedDraw());
  }

  return {
    draws,
    diagnostics,
    drawPool,
    bindGroupPool: [],
    vertexBufferPool: [],
    indexBufferPool: [],
    pipelines: new Map(),
    bindGroups: new Map(),
    vertexBuffers: new Map(),
    indexBuffers: new Map(),
    plan: { valid: true, draws, diagnostics },
    bindGroupCursor: 0,
    vertexBufferCursor: 0,
    indexBufferCursor: 0,
  };
}

export function writeResolveRenderPassResources(
  options: ResolveRenderPassResourcesOptions,
  scratch: ResolveRenderPassResourcesScratch,
): ResolveRenderPassResourcesResult {
  resetResolveScratch(scratch);
  indexResources(options, scratch);

  for (const draw of options.drawList) {
    const pipeline = scratch.pipelines.get(draw.pipelineKey);
    const resolvedDraw = resolvedDrawAt(scratch, scratch.draws.length);

    resolvedDraw.renderId = draw.renderId;
    resolvedDraw.pipelineKey = draw.pipelineKey;
    resolvedDraw.pipeline = pipeline;
    resolvedDraw.bindGroups.length = 0;
    resolvedDraw.vertexBuffers.length = 0;
    resolvedDraw.vertexCount = draw.vertexCount;
    resolvedDraw.indexBuffer = null;
    resolvedDraw.indexCount = draw.indexCount;
    resolvedDraw.instanceCount = draw.instanceCount;
    resolvedDraw.transformPackedOffset = draw.transformPackedOffset;
    if (draw.occlusionQuery === true) {
      resolvedDraw.occlusionQuery = true;
    } else {
      delete resolvedDraw.occlusionQuery;
    }

    const bindGroupsReady = resolveBindGroups(draw, scratch, resolvedDraw);
    const vertexBuffersReady = resolveVertexBuffers(
      draw,
      scratch,
      resolvedDraw,
    );
    const resolvedIndexBuffer = resolveIndexBuffer(draw, scratch);

    if (
      pipeline === undefined ||
      !bindGroupsReady ||
      !vertexBuffersReady ||
      (draw.indexBufferKey !== null && resolvedIndexBuffer === null)
    ) {
      if (pipeline === undefined) {
        scratch.diagnostics.push({
          code: "renderPassResource.missingPipeline",
          renderId: draw.renderId,
          resourceKey: draw.pipelineKey,
          message: `Missing render pipeline handle '${draw.pipelineKey}' for render id ${draw.renderId}.`,
        });
      }

      continue;
    }

    resolvedDraw.indexBuffer = resolvedIndexBuffer;
    scratch.draws.push(resolvedDraw);
  }

  (scratch.plan as MutableResolveRenderPassResourcesResult).valid =
    scratch.diagnostics.length === 0;

  return scratch.plan;
}

function resolveBindGroups(
  draw: RenderPassDrawListRecord,
  scratch: ResolveRenderPassResourcesScratch,
  resolvedDraw: MutableResolvedRenderPassDraw,
): boolean {
  for (const resourceKey of draw.bindGroupKeys) {
    const bindGroup = scratch.bindGroups.get(resourceKey);

    if (bindGroup === undefined) {
      scratch.diagnostics.push({
        code: "renderPassResource.missingBindGroup",
        renderId: draw.renderId,
        resourceKey,
        message: `Missing bind group handle '${resourceKey}' for render id ${draw.renderId}.`,
      });
      continue;
    }

    const resolved = bindGroupAt(scratch);

    resolved.group = bindGroup.group;
    resolved.resourceKey = bindGroup.resourceKey;
    resolved.bindGroup = bindGroup.bindGroup;
    resolvedDraw.bindGroups.push(resolved);
  }

  return resolvedDraw.bindGroups.length === draw.bindGroupKeys.length;
}

function resolveVertexBuffers(
  draw: RenderPassDrawListRecord,
  scratch: ResolveRenderPassResourcesScratch,
  resolvedDraw: MutableResolvedRenderPassDraw,
): boolean {
  for (const resourceKey of draw.vertexBufferKeys) {
    const vertexBuffer = scratch.vertexBuffers.get(resourceKey);

    if (vertexBuffer === undefined) {
      scratch.diagnostics.push({
        code: "renderPassResource.missingVertexBuffer",
        renderId: draw.renderId,
        resourceKey,
        message: `Missing vertex buffer handle '${resourceKey}' for render id ${draw.renderId}.`,
      });
      continue;
    }

    const resolved = vertexBufferAt(scratch);

    resolved.resourceKey = vertexBuffer.resourceKey;
    resolved.buffer = vertexBuffer.buffer;
    resolved.vertexCount = vertexBuffer.vertexCount;
    resolvedDraw.vertexBuffers.push(resolved);
  }

  return resolvedDraw.vertexBuffers.length === draw.vertexBufferKeys.length;
}

function resolveIndexBuffer(
  draw: RenderPassDrawListRecord,
  scratch: ResolveRenderPassResourcesScratch,
): ResolvedRenderPassIndexBuffer | null {
  if (draw.indexBufferKey === null) {
    return null;
  }

  const indexBuffer = scratch.indexBuffers.get(draw.indexBufferKey);

  if (indexBuffer === undefined) {
    scratch.diagnostics.push({
      code: "renderPassResource.missingIndexBuffer",
      renderId: draw.renderId,
      resourceKey: draw.indexBufferKey,
      message: `Missing index buffer handle '${draw.indexBufferKey}' for render id ${draw.renderId}.`,
    });
    return null;
  }

  const resolved = indexBufferAt(scratch);

  resolved.resourceKey = indexBuffer.resourceKey;
  resolved.buffer = indexBuffer.buffer;
  resolved.format = indexBuffer.format;
  resolved.indexCount = indexBuffer.indexCount;

  return resolved;
}

function resetResolveScratch(scratch: ResolveRenderPassResourcesScratch): void {
  scratch.draws.length = 0;
  scratch.diagnostics.length = 0;
  scratch.pipelines.clear();
  scratch.bindGroups.clear();
  scratch.vertexBuffers.clear();
  scratch.indexBuffers.clear();
  scratch.bindGroupCursor = 0;
  scratch.vertexBufferCursor = 0;
  scratch.indexBufferCursor = 0;
}

function indexResources(
  options: ResolveRenderPassResourcesOptions,
  scratch: ResolveRenderPassResourcesScratch,
): void {
  for (const pipeline of options.pipelines) {
    if (pipeline.ok) {
      scratch.pipelines.set(pipeline.key, pipeline.pipeline);
    }
  }

  for (const bindGroup of options.bindGroups) {
    scratch.bindGroups.set(bindGroup.resourceKey, bindGroup);
  }

  for (const mesh of options.meshResources) {
    for (const buffer of mesh.vertexBuffers) {
      scratch.vertexBuffers.set(buffer.resourceKey, buffer);
    }

    if (mesh.indexBuffer !== undefined) {
      scratch.indexBuffers.set(mesh.indexBuffer.resourceKey, mesh.indexBuffer);
    }
  }

  for (const buffer of options.instanceTintResources ?? []) {
    scratch.vertexBuffers.set(buffer.resourceKey, buffer);
  }

  for (const buffer of options.instanceAttributeResources ?? []) {
    scratch.vertexBuffers.set(buffer.resourceKey, buffer);
  }
}

function resolvedDrawAt(
  scratch: ResolveRenderPassResourcesScratch,
  index: number,
): MutableResolvedRenderPassDraw {
  const existing = scratch.drawPool[index] as
    | MutableResolvedRenderPassDraw
    | undefined;

  if (existing !== undefined) {
    return existing;
  }

  const draw = createEmptyResolvedDraw();

  scratch.drawPool.push(draw);
  return draw;
}

function bindGroupAt(
  scratch: ResolveRenderPassResourcesScratch,
): MutableResolvedRenderPassBindGroup {
  const existing = scratch.bindGroupPool[scratch.bindGroupCursor] as
    | MutableResolvedRenderPassBindGroup
    | undefined;

  scratch.bindGroupCursor += 1;

  if (existing !== undefined) {
    return existing;
  }

  const bindGroup = { group: 0, resourceKey: "", bindGroup: null };

  scratch.bindGroupPool.push(bindGroup);
  return bindGroup;
}

function vertexBufferAt(
  scratch: ResolveRenderPassResourcesScratch,
): MutableResolvedRenderPassVertexBuffer {
  const existing = scratch.vertexBufferPool[scratch.vertexBufferCursor] as
    | MutableResolvedRenderPassVertexBuffer
    | undefined;

  scratch.vertexBufferCursor += 1;

  if (existing !== undefined) {
    return existing;
  }

  const vertexBuffer = { resourceKey: "", buffer: null, vertexCount: 0 };

  scratch.vertexBufferPool.push(vertexBuffer);
  return vertexBuffer;
}

function indexBufferAt(
  scratch: ResolveRenderPassResourcesScratch,
): MutableResolvedRenderPassIndexBuffer {
  const existing = scratch.indexBufferPool[scratch.indexBufferCursor] as
    | MutableResolvedRenderPassIndexBuffer
    | undefined;

  scratch.indexBufferCursor += 1;

  if (existing !== undefined) {
    return existing;
  }

  const indexBuffer = {
    resourceKey: "",
    buffer: null,
    format: "",
    indexCount: 0,
  };

  scratch.indexBufferPool.push(indexBuffer);
  return indexBuffer;
}

function createEmptyResolvedDraw(): MutableResolvedRenderPassDraw {
  return {
    renderId: 0,
    pipelineKey: "",
    pipeline: null,
    bindGroups: [],
    vertexBuffers: [],
    vertexCount: 0,
    indexBuffer: null,
    indexCount: null,
    instanceCount: 1,
    transformPackedOffset: 0,
  };
}

type MutableResolveRenderPassResourcesResult = {
  -readonly [Key in keyof ResolveRenderPassResourcesResult]: ResolveRenderPassResourcesResult[Key];
};
